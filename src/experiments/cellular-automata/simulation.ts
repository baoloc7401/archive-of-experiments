import { SIM_MAX } from "./constants";
import { paletteColors } from "./palettes";
import type { BoundaryMode, BrushMode, CAFieldStats, PaletteId, RuleGenome } from "./types";
import {
  CLEAR_FS,
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

export interface CASimulator {
  /** GL renderer string (debug). */
  readonly gpu: string;
  /** Total simulation generations executed since the canvas mounted (debug: is it advancing?). */
  readonly generation: number;
  /** Simulation grid width in cells. */
  readonly width: number;
  /** Simulation grid height in cells. */
  readonly height: number;
  /** Read the field back at low resolution for aggregate debug stats. */
  sampleField(): CAFieldStats;
  /** (Re)allocate the grid for a canvas of the given backing-store size, preserving the field. */
  resize(canvasW: number, canvasH: number): void;
  /** Set the grid resolution as screen pixels per cell; preserves the field via a nearest remap. */
  setCellSize(px: number): void;
  /** Fill the field with random noise at the given density (0..1). */
  reseed(density: number): void;
  /** Wipe the field to all-dead. */
  clear(): void;
  /** Paint or erase under a soft-fizzy disc at (u, v) in 0..1, radius in cells. */
  splat(u: number, v: number, radiusCells: number, mode: BrushMode): void;
  /** Advance the field `n` generations under the given rule and boundary mode. */
  step(genome: RuleGenome, boundary: BoundaryMode, n: number): void;
  /** Paint the current field to the default framebuffer via the palette ramp. */
  render(genome: RuleGenome, palette: PaletteId): void;
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
    console.error("cellular-automata shader compile failed:", gl.getShaderInfoLog(sh));
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
    console.error("cellular-automata program link failed:", gl.getProgramInfoLog(prog));
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
  clear: WebGLProgram;
  seed: WebGLProgram;
  seedU: Uniforms;
  display: WebGLProgram;
  displayU: Uniforms;
  copy: WebGLProgram;
  copyU: Uniforms;
  rescale: WebGLProgram;
  rescaleU: Uniforms;
  /** Low-res RGBA8 (non-integer) target the field is downsampled into for stats readback. */
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

/** Grid size for a canvas of the given backing-store size at `cellPx` screen pixels per cell. */
export function simSize(canvasW: number, canvasH: number, cellPx: number): { w: number; h: number } {
  const rawW = Math.max(2, Math.round(canvasW / cellPx));
  const rawH = Math.max(2, Math.round(canvasH / cellPx));
  const longest = Math.max(rawW, rawH, 1);
  const scale = longest > SIM_MAX ? SIM_MAX / longest : 1;
  return { w: Math.max(2, Math.round(rawW * scale)), h: Math.max(2, Math.round(rawH * scale)) };
}

export function createSimulator(
  canvas: HTMLCanvasElement,
  onAvailability?: (ok: boolean) => void,
): CASimulator | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  // Unlike reaction-diffusion, no extension probing: RGBA8UI render targets and
  // integer samplers are core WebGL2, nothing further to check.
  if (!gl || gl.isContextLost()) return null;

  let progs: Programs | null = null;
  let targets: Targets | null = null;
  let lost = false;
  let gpu = "";
  let simW = 0;
  let simH = 0;
  let canvasW = 0;
  let canvasH = 0;
  let cellPx = 4;
  let lastDensity = 0.3;
  let generationCount = 0;
  const readPx = new Uint8Array(READBACK * READBACK * 4);
  const prevPx = new Uint8Array(READBACK * READBACK * 4);
  let havePrev = false;
  let colorsId = "";
  let colors = new Float32Array(0);

  function buildPrograms(): boolean {
    if (!gl) return false;
    const sim = link(gl, FULLSCREEN_VS, SIM_FS);
    const splat = link(gl, FULLSCREEN_VS, SPLAT_FS);
    const clear = link(gl, FULLSCREEN_VS, CLEAR_FS);
    const seed = link(gl, FULLSCREEN_VS, SEED_FS);
    const display = link(gl, FULLSCREEN_VS, DISPLAY_FS);
    const copy = link(gl, FULLSCREEN_VS, COPY_FS);
    const rescale = link(gl, FULLSCREEN_VS, RESCALE_FS);
    const vao = gl.createVertexArray();
    // Always-readable RGBA8 (non-integer) target the field is downsampled into for stats.
    const readTex = gl.createTexture();
    const readFbo = gl.createFramebuffer();
    if (
      !sim || !splat || !clear || !seed || !display || !copy || !rescale ||
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
      simU: uniforms(gl, sim, ["uState", "uSize", "uBirth", "uSurvive", "uStates", "uWrap"]),
      splat,
      splatU: uniforms(gl, splat, ["uState", "uSize", "uPoint", "uRadius", "uAspect", "uMode"]),
      clear,
      seed,
      seedU: uniforms(gl, seed, ["uDensity", "uSeed"]),
      display,
      displayU: uniforms(gl, display, ["uState", "uSize", "uColors", "uStates"]),
      copy,
      copyU: uniforms(gl, copy, ["uState", "uSize"]),
      rescale,
      rescaleU: uniforms(gl, rescale, ["uState", "uOldSize"]),
      readTex,
      readFbo,
      vao,
    };
    const info = gl.getParameter(gl.RENDERER);
    gpu = typeof info === "string" ? info : "";
    return true;
  }

  /** RGBA8UI ping-pong texture: state is an exact integer, so NEAREST-only, no filtering. */
  function makeTexture(w: number, h: number): WebGLTexture | null {
    if (!gl) return null;
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8UI, w, h);
    // LINEAR on an integer texture is illegal (makes it "incomplete", silently
    // samples black) - NEAREST is the only legal filter here, and correct
    // anyway: every pass reads via texelFetch, which ignores filtering.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
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

  function bindBack(): boolean {
    if (!gl || !targets) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.fbo[targets.cur ^ 1]);
    gl.viewport(0, 0, simW, simH);
    return true;
  }

  function bindFrontTexture(): void {
    if (!gl || !targets) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets.tex[targets.cur]);
  }

  function swap(): void {
    if (targets) targets.cur ^= 1;
  }

  /** Wipes the FRONT target in place via CLEAR_FS. Never gl.clear() - unreliable on *UI FBOs. */
  function runClear(): void {
    if (!gl || !progs || !targets) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.fbo[targets.cur]);
    gl.viewport(0, 0, simW, simH);
    gl.useProgram(progs.clear);
    drawTriangle();
  }

  /** Fills the FRONT target in place via SEED_FS (density-hash), recording the density used. */
  function runSeed(density: number): void {
    if (!gl || !progs || !targets) return;
    lastDensity = density;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.fbo[targets.cur]);
    gl.viewport(0, 0, simW, simH);
    gl.useProgram(progs.seed);
    gl.uniform1f(progs.seedU.uDensity, density);
    gl.uniform1f(progs.seedU.uSeed, Math.random() * 1000);
    drawTriangle();
  }

  /**
   * (Re)allocates the grid at the current canvas size / cellPx if it changed,
   * preserving the field via a nearest-neighbor rescale (RESCALE_FS) unless
   * this is the very first allocation, in which case it clears then reseeds
   * at the last-used density. Shared by both resize() and setCellSize() -
   * unlike reaction-diffusion (which deliberately reseeds on a resolution
   * change to show the new feature scale immediately), a CA resolution change
   * preserves whatever pattern is on screen, since losing a hand-drawn
   * pattern over a display-density tweak would be an unwelcome surprise.
   */
  function reallocate(): void {
    if (!gl || !progs || canvasW === 0 || canvasH === 0) return;
    const { w, h } = simSize(canvasW, canvasH, cellPx);
    if (w === simW && h === simH && targets) return;
    const next = buildTargets(w, h);
    if (!next) return;
    const old = targets;
    if (old) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo[next.cur]);
      gl.viewport(0, 0, w, h);
      gl.useProgram(progs.rescale);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, old.tex[old.cur]);
      gl.uniform1i(progs.rescaleU.uState, 0);
      gl.uniform2i(progs.rescaleU.uOldSize, simW, simH);
      drawTriangle();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    targets = next;
    simW = w;
    simH = h;
    if (old) {
      disposeTargetsObj(old);
    } else {
      runClear();
      runSeed(lastDensity);
    }
  }

  function splatInternal(u: number, v: number, radiusCells: number, mode: BrushMode): void {
    if (!gl || !progs || !targets) return;
    if (!bindBack()) return;
    gl.useProgram(progs.splat);
    bindFrontTexture();
    gl.uniform1i(progs.splatU.uState, 0);
    gl.uniform2i(progs.splatU.uSize, simW, simH);
    gl.uniform2f(progs.splatU.uPoint, u, v);
    gl.uniform1f(progs.splatU.uRadius, radiusCells / simH);
    gl.uniform1f(progs.splatU.uAspect, simW / simH);
    gl.uniform1i(progs.splatU.uMode, mode === "paint" ? 1 : 0);
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
    if (ok && simW > 0) {
      runClear();
      runSeed(lastDensity);
    }
    onAvailability?.(ok);
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const api: CASimulator = {
    get gpu() {
      return gpu;
    },
    get generation() {
      return generationCount;
    },
    get width() {
      return simW;
    },
    get height() {
      return simH;
    },

    sampleField(): CAFieldStats {
      const empty = { population: 0, footprint: 0, churn: 0 };
      if (lost || !gl || !progs || !targets) return empty;
      gl.bindFramebuffer(gl.FRAMEBUFFER, progs.readFbo);
      gl.viewport(0, 0, READBACK, READBACK);
      gl.useProgram(progs.copy);
      bindFrontTexture();
      gl.uniform1i(progs.copyU.uState, 0);
      gl.uniform2i(progs.copyU.uSize, simW, simH);
      drawTriangle();
      gl.readPixels(0, 0, READBACK, READBACK, gl.RGBA, gl.UNSIGNED_BYTE, readPx);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      let alive = 0;
      let nonDead = 0;
      let changed = 0;
      const n = READBACK * READBACK;
      for (let i = 0; i < n; i++) {
        const s = readPx[i * 4];
        if (s === 1) alive++;
        if (s >= 1) nonDead++;
        if (havePrev && s !== prevPx[i * 4]) changed++;
      }
      prevPx.set(readPx);
      const churn = havePrev ? changed / n : 0;
      havePrev = true;
      return { population: alive / n, footprint: nonDead / n, churn };
    },

    resize(nextCanvasW: number, nextCanvasH: number): void {
      if (lost || !gl || !progs) return;
      canvasW = nextCanvasW;
      canvasH = nextCanvasH;
      reallocate();
    },

    setCellSize(px: number): void {
      if (px === cellPx) return;
      cellPx = px;
      if (lost || !gl || !progs) return;
      reallocate();
    },

    reseed(density: number): void {
      if (lost) return;
      runSeed(density);
    },

    clear(): void {
      if (lost) return;
      runClear();
    },

    splat(u: number, v: number, radiusCells: number, mode: BrushMode): void {
      if (lost) return;
      splatInternal(u, v, radiusCells, mode);
    },

    step(genome: RuleGenome, boundary: BoundaryMode, n: number): void {
      if (lost || !gl || !progs || !targets) return;
      gl.useProgram(progs.sim);
      gl.uniform2i(progs.simU.uSize, simW, simH);
      gl.uniform1i(progs.simU.uBirth, genome.birth);
      gl.uniform1i(progs.simU.uSurvive, genome.survive);
      gl.uniform1i(progs.simU.uStates, genome.states);
      gl.uniform1i(progs.simU.uWrap, boundary === "wrap" ? 1 : 0);
      gl.uniform1i(progs.simU.uState, 0);
      for (let i = 0; i < n; i++) {
        if (!bindBack()) return;
        bindFrontTexture();
        drawTriangle();
        swap();
        generationCount++;
      }
    },

    render(genome: RuleGenome, palette: PaletteId): void {
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
      gl.uniform2i(progs.displayU.uSize, simW, simH);
      gl.uniform1i(progs.displayU.uStates, genome.states);
      const key = `${palette}:${genome.states}`;
      if (colorsId !== key) {
        colors = paletteColors(palette, genome.states);
        colorsId = key;
      }
      gl.uniform3fv(progs.displayU.uColors, colors);
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
