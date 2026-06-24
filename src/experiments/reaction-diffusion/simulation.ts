import { SIM_MAX } from "./constants";
import { paletteStops } from "./palettes";
import type { RDParams } from "./types";
import {
  COPY_FS,
  DISPLAY_FS,
  FULLSCREEN_VS,
  RESCALE_FS,
  SEED_FS,
  SIM_FS,
  SPLAT_FS,
} from "./shaders";

/** Edge of the square low-res buffer the field is read back into (debug stats). */
const READBACK = 96;

/** Aggregate field stats from a low-res GPU readback. */
export interface FieldStats {
  meanU: number;
  meanV: number;
  maxV: number;
  /** Fraction of cells with V above a small threshold. */
  active: number;
  /** Mean |V change| since the previous readback (0 = field not moving). */
  delta: number;
}

/**
 * Framework-free Gray-Scott engine. State (U, V) lives in two RG16F textures
 * that ping-pong: each pass reads the front texture and writes the back, then
 * they swap. The simulation, brush, and seed passes render into those textures;
 * the display pass renders the front texture to the canvas through a colour
 * ramp. No vertex buffers - every pass is a fullscreen triangle keyed off
 * gl_VertexID. Mirrors the lifecycle of the n-body renderer (context-loss
 * recovery via an availability callback, an isLost guard on every draw).
 */

export interface RDSimulator {
  /** GL renderer string (debug). */
  gpu: string;
  /** Extension that made the float render targets work (debug). */
  floatExt: string;
  /** Total Gray-Scott steps executed since creation (debug: is it advancing?). */
  readonly steps: number;
  /** Simulation grid width in texels. */
  readonly width: number;
  /** Simulation grid height in texels. */
  readonly height: number;
  /** Read the field back at low resolution for aggregate debug stats. */
  sampleField(): FieldStats;
  /** (Re)allocate the grid for a canvas of the given backing-store size. */
  resize(canvasW: number, canvasH: number): void;
  /** Set the grid resolution as a multiple of the canvas backing store; reseeds. */
  setResolution(scale: number): void;
  /** Reset to the initial condition (U = 1, V = 0) plus seed blobs of V. */
  seed(): void;
  /** Raise V under a soft brush at (u, v) in 0..1 with the given texel radius. */
  splat(u: number, v: number, radiusTexels: number): void;
  /** Advance the field `n` Gray-Scott steps. */
  step(params: RDParams, n: number): void;
  /** Paint the current field to the default framebuffer via the palette ramp. */
  render(params: RDParams): void;
  /** True while the GL context is lost (passes are skipped). */
  isLost(): boolean;
  dispose(): void;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("reaction-diffusion shader compile failed:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function link(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("reaction-diffusion program link failed:", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

function uniforms(gl: WebGL2RenderingContext, prog: WebGLProgram, names: string[]): Uniforms {
  const out: Uniforms = {};
  for (const n of names) out[n] = gl.getUniformLocation(prog, n);
  return out;
}

interface Programs {
  sim: WebGLProgram;
  simU: Uniforms;
  splat: WebGLProgram;
  splatU: Uniforms;
  seed: WebGLProgram;
  display: WebGLProgram;
  displayU: Uniforms;
  copy: WebGLProgram;
  copyU: Uniforms;
  rescale: WebGLProgram;
  rescaleU: Uniforms;
  /** Low-res RGBA8 target + framebuffer the field is read back from. */
  readTex: WebGLTexture;
  readFbo: WebGLFramebuffer;
  vao: WebGLVertexArrayObject;
}

interface Targets {
  tex: [WebGLTexture, WebGLTexture];
  fbo: [WebGLFramebuffer, WebGLFramebuffer];
  /** Index of the front (current) texture; back is `cur ^ 1`. */
  cur: number;
}

/** Pick a sim grid that fits the canvas but never exceeds SIM_MAX on a side. */
export function simSize(canvasW: number, canvasH: number): { w: number; h: number } {
  const longest = Math.max(canvasW, canvasH, 1);
  const scale = longest > SIM_MAX ? SIM_MAX / longest : 1;
  return {
    w: Math.max(2, Math.round(canvasW * scale)),
    h: Math.max(2, Math.round(canvasH * scale)),
  };
}

export function createSimulator(
  canvas: HTMLCanvasElement,
  onAvailability?: (ok: boolean) => void,
): RDSimulator | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  if (!gl || gl.isContextLost()) return null;
  // Gray-Scott needs more than 8-bit precision; RG16F render targets require a
  // float colour-buffer extension. Without one there is no usable path.
  // Gray-Scott accumulates tiny per-step increments; float16 (RG16F) rounds
  // them away and the delicate high-kill regimes (mitosis/worms/fingerprint)
  // die. RG32F renders need EXT_color_buffer_float; LINEAR sampling of a float32
  // texture needs OES_texture_float_linear. With both we get full precision and
  // a smooth display upscale. Without color_buffer_float there is no usable path.
  let floatExt = "";
  let useFloat32 = false;
  if (gl.getExtension("EXT_color_buffer_float")) {
    floatExt = "EXT_color_buffer_float";
    useFloat32 = !!gl.getExtension("OES_texture_float_linear");
  } else if (gl.getExtension("EXT_color_buffer_half_float")) {
    floatExt = "EXT_color_buffer_half_float";
  } else {
    return null;
  }
  floatExt += useFloat32 ? " rg32f" : " rg16f";

  let progs: Programs | null = null;
  let targets: Targets | null = null;
  let lost = false;
  let gpu = "";
  let simW = 0;
  let simH = 0;
  // Grid size = canvas backing store * scale, clamped to SIM_MAX (see gridFor).
  let scale = 1;
  const stopsBuf = new Float32Array(15);
  let stopsId = "";
  let stepCount = 0;
  const readPx = new Uint8Array(READBACK * READBACK * 4);
  const prevPx = new Uint8Array(READBACK * READBACK * 4);
  let havePrev = false;

  function buildPrograms(): boolean {
    if (!gl) return false;
    const sim = link(gl, FULLSCREEN_VS, SIM_FS);
    const splat = link(gl, FULLSCREEN_VS, SPLAT_FS);
    const seed = link(gl, FULLSCREEN_VS, SEED_FS);
    const display = link(gl, FULLSCREEN_VS, DISPLAY_FS);
    const copy = link(gl, FULLSCREEN_VS, COPY_FS);
    const rescale = link(gl, FULLSCREEN_VS, RESCALE_FS);
    const vao = gl.createVertexArray();
    // Always-readable RGBA8 target the field is downsampled into for stats.
    const readTex = gl.createTexture();
    const readFbo = gl.createFramebuffer();
    if (
      !sim || !splat || !seed || !display || !copy || !rescale ||
      !vao || !readTex || !readFbo
    ) {
      return false;
    }
    gl.bindTexture(gl.TEXTURE_2D, readTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, READBACK, READBACK);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, readFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, readTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    progs = {
      sim,
      simU: uniforms(gl, sim, ["uState", "uSize", "uFeed", "uKill", "uDu", "uDv", "uDt"]),
      splat,
      splatU: uniforms(gl, splat, ["uState", "uPoint", "uRadius", "uAspect", "uInner"]),
      seed,
      display,
      displayU: uniforms(gl, display, ["uState", "uStops"]),
      copy,
      copyU: uniforms(gl, copy, ["uState"]),
      rescale,
      rescaleU: uniforms(gl, rescale, ["uState"]),
      readTex,
      readFbo,
      vao,
    };
    const info = gl.getParameter(gl.RENDERER);
    gpu = typeof info === "string" ? info : "";
    return true;
  }

  function makeTexture(w: number, h: number): WebGLTexture | null {
    if (!gl) return null;
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, useFloat32 ? gl.RG32F : gl.RG16F, w, h);
    // The sim reads neighbours via texelFetch (filter-independent); LINEAR is for
    // the display upscale (float32 LINEAR via OES_texture_float_linear, else the
    // core half-float path). REPEAT makes the field a torus (no boundary seam).
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
  }

  /** Build a fresh ping-pong target pair (does not touch the live `targets`). */
  function buildTargets(w: number, h: number): Targets | null {
    if (!gl) return null;
    const t0 = makeTexture(w, h);
    const t1 = makeTexture(w, h);
    const f0 = gl.createFramebuffer();
    const f1 = gl.createFramebuffer();
    if (!t0 || !t1 || !f0 || !f1) return null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t0, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t1, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) {
      disposeTargetsObj({ tex: [t0, t1], fbo: [f0, f1], cur: 0 });
      return null;
    }
    return { tex: [t0, t1], fbo: [f0, f1], cur: 0 };
  }

  function disposeTargetsObj(t: Targets): void {
    if (!gl) return;
    gl.deleteTexture(t.tex[0]);
    gl.deleteTexture(t.tex[1]);
    gl.deleteFramebuffer(t.fbo[0]);
    gl.deleteFramebuffer(t.fbo[1]);
  }

  function disposeTargets(): void {
    if (!targets) return;
    disposeTargetsObj(targets);
    targets = null;
  }

  /** Draw the bound program's fullscreen triangle into the bound framebuffer. */
  function drawTriangle(): void {
    if (!gl || !progs) return;
    gl.bindVertexArray(progs.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Bind the back framebuffer at sim resolution; returns false if not ready. */
  function bindBack(): boolean {
    if (!gl || !targets) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.fbo[targets.cur ^ 1]);
    gl.viewport(0, 0, simW, simH);
    return true;
  }

  /** Bind the front texture to unit 0 (the read side of a ping-pong pass). */
  function bindFrontTexture(): void {
    if (!gl || !targets) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets.tex[targets.cur]);
  }

  function swap(): void {
    if (targets) targets.cur ^= 1;
  }

  function splatInternal(u: number, v: number, radiusTexels: number, inner: number): void {
    if (!gl || !progs || !targets) return;
    if (!bindBack()) return;
    gl.useProgram(progs.splat);
    bindFrontTexture();
    gl.uniform1i(progs.splatU.uState, 0);
    gl.uniform2f(progs.splatU.uPoint, u, v);
    gl.uniform1f(progs.splatU.uRadius, radiusTexels / simH);
    gl.uniform1f(progs.splatU.uAspect, simW / simH);
    gl.uniform1f(progs.splatU.uInner, inner);
    drawTriangle();
    swap();
  }

  if (!buildPrograms()) return null;

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    targets = null;
    onAvailability?.(false);
  };
  const onRestored = () => {
    // Rebuild programs and re-allocate the grid at the last known size; the
    // field itself is gone, so re-seed.
    let ok = buildPrograms();
    if (ok && simW > 0) {
      const next = buildTargets(simW, simH);
      if (next) {
        targets = next;
      } else {
        ok = false;
      }
    }
    lost = !ok;
    if (ok && simW > 0) api.seed();
    onAvailability?.(ok);
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const api: RDSimulator = {
    get gpu() {
      return gpu;
    },
    get floatExt() {
      return floatExt;
    },
    get steps() {
      return stepCount;
    },
    get width() {
      return simW;
    },
    get height() {
      return simH;
    },

    sampleField(): FieldStats {
      const empty = { meanU: 0, meanV: 0, maxV: 0, active: 0, delta: 0 };
      if (lost || !gl || !progs || !targets) return empty;
      // Downsample the field into the RGBA8 buffer, then read it back. readPixels
      // stalls the pipeline, so the caller throttles this to a few times a second.
      gl.bindFramebuffer(gl.FRAMEBUFFER, progs.readFbo);
      gl.viewport(0, 0, READBACK, READBACK);
      gl.useProgram(progs.copy);
      bindFrontTexture();
      gl.uniform1i(progs.copyU.uState, 0);
      drawTriangle();
      gl.readPixels(0, 0, READBACK, READBACK, gl.RGBA, gl.UNSIGNED_BYTE, readPx);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      let sumU = 0;
      let sumV = 0;
      let maxV = 0;
      let active = 0;
      let diff = 0;
      const n = READBACK * READBACK;
      for (let i = 0; i < n; i++) {
        const u = readPx[i * 4];
        const v = readPx[i * 4 + 1];
        sumU += u;
        sumV += v;
        if (v > maxV) maxV = v;
        if (v > 13) active++; // ~0.05 on the 0..255 scale
        if (havePrev) diff += Math.abs(v - prevPx[i * 4 + 1]);
      }
      prevPx.set(readPx);
      const delta = havePrev ? diff / n / 255 : 0;
      havePrev = true;
      return {
        meanU: sumU / n / 255,
        meanV: sumV / n / 255,
        maxV: maxV / 255,
        active: active / n,
        delta,
      };
    },

    resize(canvasW: number, canvasH: number): void {
      if (lost || !gl || !progs) return;
      const { w, h } = simSize(Math.round(canvasW * scale), Math.round(canvasH * scale));
      if (w === simW && h === simH && targets) return;
      const next = buildTargets(w, h);
      if (!next) return;
      const old = targets;
      if (old) {
        // Preserve the field across a resize: rescale the old front texture into
        // the new front, then drop the old pair. A reflow no longer wipes the
        // pattern (the previous reseed-on-resize made it look perpetually empty).
        gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo[next.cur]);
        gl.viewport(0, 0, w, h);
        gl.useProgram(progs.rescale);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, old.tex[old.cur]);
        gl.uniform1i(progs.rescaleU.uState, 0);
        drawTriangle();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      targets = next;
      simW = w;
      simH = h;
      if (old) disposeTargetsObj(old);
      else api.seed();
    },

    setResolution(s: number): void {
      if (s === scale) return;
      scale = s;
      // Before the grid exists, just record the scale; the first resize uses it.
      if (lost || !gl || !progs || !targets) return;
      const { w, h } = simSize(Math.round(canvas.width * scale), Math.round(canvas.height * scale));
      if (w === simW && h === simH) return;
      const next = buildTargets(w, h);
      if (!next) return;
      const old = targets;
      targets = next;
      simW = w;
      simH = h;
      disposeTargetsObj(old);
      // Reseed so the new resolution is visible immediately (finer/coarser
      // features) instead of a rescaled copy of the old pattern.
      api.seed();
    },

    seed(): void {
      if (lost || !gl || !progs || !targets) return;
      // Fill the front target with the steady U = 1, V = 0 substrate.
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.fbo[targets.cur]);
      gl.viewport(0, 0, simW, simH);
      gl.useProgram(progs.seed);
      drawTriangle();
      // Seed a JITTERED GRID of mixed-size soft nuclei (radii in absolute cells).
      // Two things matter and are both verified against the CPU reference:
      //  - Even coverage (a grid, not pure-random points) makes every reset fill
      //    reliably. Pure-random placement clumped by luck, so a regime would
      //    fill on one load and die on the next.
      //  - Mixed sizes serve both Gray-Scott families: low-feed regimes
      //    (mitosis/spots/maze) divide only from ~one-wavelength (small) nuclei
      //    and treat a big blob as a uniform patch that dies; high-feed regimes
      //    (coral/worms/u-skate) starve from a tiny nucleus and need a large one.
      //    Every 4th blob is large so each family finds a nucleus it can grow from.
      const area = simW * simH;
      const target = Math.max(24, Math.min(120, Math.round(area / 750)));
      const cols = Math.max(2, Math.round(Math.sqrt((target * simW) / simH)));
      const rows = Math.max(2, Math.round(target / cols));
      let n = 0;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const u = (i + 0.5 + (Math.random() - 0.5) * 0.9) / cols;
          const v = (j + 0.5 + (Math.random() - 0.5) * 0.9) / rows;
          const big = n % 4 === 0;
          // Near-hard disc (inner 0.8) so each nucleus carries the real seed
          // concentration - a soft dome of the same radius is too weak to nucleate.
          splatInternal(u, v, (big ? 18 : 6) * (0.8 + Math.random() * 0.4), 0.8);
          n++;
        }
      }
    },

    splat(u: number, v: number, radiusTexels: number): void {
      if (lost) return;
      // Soft dome for the brush (inner = 0): a gentle, smooth stroke.
      splatInternal(u, v, radiusTexels, 0);
    },

    step(params: RDParams, n: number): void {
      if (lost || !gl || !progs || !targets) return;
      gl.useProgram(progs.sim);
      gl.uniform2i(progs.simU.uSize, simW, simH);
      gl.uniform1f(progs.simU.uFeed, params.feed);
      gl.uniform1f(progs.simU.uKill, params.kill);
      gl.uniform1f(progs.simU.uDu, params.du);
      gl.uniform1f(progs.simU.uDv, params.dv);
      gl.uniform1f(progs.simU.uDt, params.dt);
      gl.uniform1i(progs.simU.uState, 0);
      for (let i = 0; i < n; i++) {
        if (!bindBack()) return;
        bindFrontTexture();
        drawTriangle();
        swap();
        stepCount++;
      }
    },

    render(params: RDParams): void {
      if (lost || !gl || !progs || !targets) return;
      if (gl.isContextLost()) {
        lost = true;
        onAvailability?.(false);
        return;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(progs.display);
      bindFrontTexture();
      gl.uniform1i(progs.displayU.uState, 0);
      if (stopsId !== params.palette) {
        stopsBuf.set(paletteStops(params.palette));
        stopsId = params.palette;
      }
      gl.uniform3fv(progs.displayU.uStops, stopsBuf);
      drawTriangle();
      gl.bindVertexArray(null);
    },

    isLost(): boolean {
      return lost;
    },

    dispose(): void {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      disposeTargets();
    },
  };

  return api;
}
