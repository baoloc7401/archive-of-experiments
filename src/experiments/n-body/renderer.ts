import { TRAIL_K } from "./constants";
import type { Mat4 } from "./mat4";
import type { Palette } from "./palette";
import type { Bodies, ColorMode } from "./types";

/**
 * Hand-rolled WebGL2 point renderer: glow-sprite bodies, a parallax starfield,
 * world-space trails, and a follow-ring marker. No depth buffer and no
 * sorting - both blend modes used here are order-independent.
 *
 * Trails live in a float texture holding a ring buffer of the last TRAIL_K
 * sampled positions per body; each sample tick overwrites one slot (a few
 * contiguous texture rows) and a vertex-pulling shader draws every trail in a
 * single LINES call. Because the geometry is in world space it re-projects
 * with the camera instead of smearing across the screen, and it freezes in
 * place while the simulation is paused.
 */

const STAR_COUNT = 360;
const STAR_RADIUS = 30;
/** Body sprite size: px = K * heightPx * cbrt(mass) / cameraDistance. */
const POINT_K = 0.19;
/** Trail history texture width; one sample slot spans capacity/TEX_W rows. */
const TEX_W = 4096;

export interface DrawState {
  count: number;
  mvp: Mat4;
  starMvp: Mat4;
  palette: Palette;
  dark: boolean;
  colorMode: ColorMode;
  /** Trail segments to draw per body (0 = trails off). */
  trailSegs: number;
  /** Global brightness 0..1 (the preset-entry fade). */
  brightness: number;
  /** 1 / characteristic speed, for the speed colour ramp. */
  speedScale: number;
  massLogMin: number;
  massLogInvRange: number;
  /** Camera distance (fog + sprite scale). */
  camDist: number;
  dpr: number;
  /** Follow marker in world space, or null. */
  ring: { x: number; y: number; z: number; sizePx: number; alpha: number } | null;
}

export interface NBodyRenderer {
  /** GL renderer string for the debug report. */
  gpu: string;
  /** Copy body positions/velocities (and masses when `full`) into the GPU. */
  upload(b: Bodies, full: boolean): void;
  /** Record current positions as the newest trail sample. */
  pushTrailSample(b: Bodies): void;
  /** Forget all trail history (reseed / scene switch). */
  resetTrails(): void;
  draw(state: DrawState): void;
  /** Hard clear to the background colour (preset switches, resizes). */
  clear(bg: [number, number, number]): void;
  /** True while the GL context is lost (draws are silently skipped). */
  isLost(): boolean;
  dispose(): void;
}

const POINT_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aVel;
layout(location=2) in float aMass;
uniform mat4 uMvp;
uniform float uSizeK;
uniform float uMinPx;
uniform float uMaxPx;
uniform int uColorMode;
uniform vec3 uAccent;
uniform vec3 uAccent2;
uniform vec3 uMono;
uniform float uSpeedScale;
uniform vec2 uMassRange;
uniform vec2 uFog;
uniform vec3 uRampA;
uniform vec3 uRampB;
uniform vec3 uRampC;
out vec3 vColor;
out float vAlpha;
void main() {
  vec4 clip = uMvp * vec4(aPos, 1.0);
  gl_Position = clip;
  float w = max(clip.w, 1e-3);
  gl_PointSize = clamp(uSizeK * pow(aMass, 1.0 / 3.0) / w, uMinPx, uMaxPx);
  vec3 col;
  if (uColorMode == 0) {
    float t = clamp(length(aVel) * uSpeedScale, 0.0, 1.0);
    col = mix(uAccent, uAccent2, t);
  } else if (uColorMode == 1) {
    float t = clamp((log(aMass) - uMassRange.x) * uMassRange.y, 0.0, 1.0);
    col = t < 0.5 ? mix(uRampA, uRampB, t * 2.0) : mix(uRampB, uRampC, t * 2.0 - 1.0);
  } else {
    col = uMono;
  }
  vColor = col;
  // Fog: fade bodies that sit deeper than the camera target toward nothing.
  vAlpha = 1.0 - clamp((w - uFog.x) * uFog.y, 0.0, 1.0) * 0.78;
}`;

const POINT_FS = `#version 300 es
precision mediump float;
in vec3 vColor;
in float vAlpha;
uniform float uBrightness;
uniform float uAlphaK;
uniform float uHaloK;
out vec4 frag;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  // Two-term glow: a hot gaussian core inside a wide faint halo. The halo is
  // dialed down on light theme, where it reads as milky haze instead of glow.
  float a = (exp(-r2 * 13.0) + exp(-r2 * 2.6) * 0.17 * uHaloK) * vAlpha * uBrightness * uAlphaK;
  a = min(a, 1.0);
  frag = vec4(vColor * a, a);
}`;

const STAR_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in float aSize;
uniform mat4 uMvp;
uniform float uDpr;
out float vTwinkle;
void main() {
  gl_Position = uMvp * vec4(aPos, 1.0);
  gl_PointSize = aSize * uDpr;
  vTwinkle = fract(aSize * 17.0);
}`;

const STAR_FS = `#version 300 es
precision mediump float;
in float vTwinkle;
uniform vec3 uColor;
uniform float uAlpha;
out vec4 frag;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.5) * uAlpha * (0.55 + 0.45 * vTwinkle);
  frag = vec4(uColor * a, a);
}`;

const RING_VS = `#version 300 es
precision highp float;
uniform mat4 uMvp;
uniform vec3 uPos;
uniform float uSizePx;
void main() {
  gl_Position = uMvp * vec4(uPos, 1.0);
  gl_PointSize = uSizePx;
}`;

const RING_FS = `#version 300 es
precision mediump float;
uniform vec3 uColor;
uniform float uAlpha;
out vec4 frag;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = length(p);
  float ring = smoothstep(0.66, 0.74, d) * (1.0 - smoothstep(0.86, 0.94, d));
  float a = ring * uAlpha;
  frag = vec4(uColor * a, a);
}`;

/**
 * Trail vertex shader, generated so the ring/texture layout constants can be
 * baked in. Each LINES vertex derives (body, samples-back, endpoint) from
 * gl_VertexID alone and pulls its position out of the history texture.
 */
function trailVsSrc(slots: number, bodiesRounded: number): string {
  return `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uHist;
uniform mat4 uMvp;
uniform int uHead;
uniform int uSegs;
out float vFade;
void main() {
  int per = uSegs * 2;
  int body = gl_VertexID / per;
  int r = gl_VertexID - body * per;
  int back = (r >> 1) + (r & 1);
  int slot = uHead - back;
  if (slot < 0) slot += ${slots};
  int lin = slot * ${bodiesRounded} + body;
  vec3 pos = texelFetch(uHist, ivec2(lin % ${TEX_W}, lin / ${TEX_W}), 0).xyz;
  gl_Position = uMvp * vec4(pos, 1.0);
  vFade = pow(1.0 - float(back) / float(uSegs + 1), 1.6);
}`;
}

const TRAIL_FS = `#version 300 es
precision mediump float;
in float vFade;
uniform vec3 uColor;
uniform float uAlpha;
out vec4 frag;
void main() {
  float a = vFade * uAlpha;
  frag = vec4(uColor * a, a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // Dev diagnostic only; the page falls back to a translated notice.
    console.error("n-body shader compile failed:", gl.getShaderInfoLog(sh));
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
    console.error("n-body program link failed:", gl.getProgramInfoLog(prog));
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

interface GlResources {
  points: WebGLProgram;
  pointsU: Uniforms;
  pointsVao: WebGLVertexArrayObject;
  posBuf: WebGLBuffer;
  velBuf: WebGLBuffer;
  massBuf: WebGLBuffer;
  stars: WebGLProgram;
  starsU: Uniforms;
  starsVao: WebGLVertexArrayObject;
  ring: WebGLProgram;
  ringU: Uniforms;
  trail: WebGLProgram;
  trailU: Uniforms;
  histTex: WebGLTexture;
  emptyVao: WebGLVertexArrayObject;
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  capacity: number,
  /** Fired when the GL context dies or comes back; drives the fallback UI. */
  onAvailability?: (ok: boolean) => void,
): NBodyRenderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    // toBlob() needs readable pixels for the PNG export.
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  // Locked-down browsers (Edge enhanced security, embedded webviews) may hand
  // back a context that is already lost instead of refusing to create one -
  // every call on it silently no-ops, so treat it as "no WebGL2" up front.
  if (!gl || gl.isContextLost()) return null;

  const posStage = new Float32Array(capacity * 3);
  const velStage = new Float32Array(capacity * 3);
  const massStage = new Float32Array(capacity);

  // Trail history ring: one slot = the positions of every body at one sample
  // tick, stored as `rowsPerSlot` full texture rows so updates stay one
  // contiguous texSubImage2D call.
  const rowsPerSlot = Math.ceil(capacity / TEX_W);
  const bodiesRounded = rowsPerSlot * TEX_W;
  const texH = TRAIL_K * rowsPerSlot;
  const trailStage = new Float32Array(bodiesRounded * 4);
  let trailHead = -1;
  let trailValid = 0;

  let res: GlResources | null = null;
  let lost = false;
  let massDirty = true;
  let gpu = "";

  function init(): boolean {
    if (!gl) return false;
    const points = link(gl, POINT_VS, POINT_FS);
    const stars = link(gl, STAR_VS, STAR_FS);
    const ring = link(gl, RING_VS, RING_FS);
    const trail = link(gl, trailVsSrc(TRAIL_K, bodiesRounded), TRAIL_FS);
    const pointsVao = gl.createVertexArray();
    const starsVao = gl.createVertexArray();
    const emptyVao = gl.createVertexArray();
    const posBuf = gl.createBuffer();
    const velBuf = gl.createBuffer();
    const massBuf = gl.createBuffer();
    const starBuf = gl.createBuffer();
    const histTex = gl.createTexture();
    if (
      !points || !stars || !ring || !trail ||
      !pointsVao || !starsVao || !emptyVao ||
      !posBuf || !velBuf || !massBuf || !starBuf || !histTex
    ) {
      return false;
    }

    gl.bindTexture(gl.TEXTURE_2D, histTex);
    // RGBA16F is guaranteed in WebGL2 (unlike RGBA32F which needs
    // EXT_color_buffer_float for some operations). Float32 upload still works:
    // the driver converts to float16 during texSubImage2D.
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, TEX_W, texH);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    // Context (re)creation starts with an empty history.
    trailHead = -1;
    trailValid = 0;

    gl.bindVertexArray(pointsVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * 12, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, velBuf);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * 12, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, massBuf);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);

    // Static far-sphere starfield: position + size interleaved.
    const starData = new Float32Array(STAR_COUNT * 4);
    for (let i = 0; i < STAR_COUNT; i++) {
      const cosT = Math.random() * 2 - 1;
      const sinT = Math.sqrt(1 - cosT * cosT);
      const phi = Math.random() * Math.PI * 2;
      starData[i * 4] = STAR_RADIUS * sinT * Math.cos(phi);
      starData[i * 4 + 1] = STAR_RADIUS * cosT;
      starData[i * 4 + 2] = STAR_RADIUS * sinT * Math.sin(phi);
      starData[i * 4 + 3] = 1 + Math.random() * 1.4;
    }
    gl.bindVertexArray(starsVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
    gl.bufferData(gl.ARRAY_BUFFER, starData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
    gl.bindVertexArray(null);

    res = {
      points,
      pointsU: uniforms(gl, points, [
        "uMvp", "uSizeK", "uMinPx", "uMaxPx", "uColorMode", "uAccent", "uAccent2",
        "uMono", "uSpeedScale", "uMassRange", "uFog", "uBrightness", "uAlphaK",
        "uHaloK", "uRampA", "uRampB", "uRampC",
      ]),
      pointsVao,
      posBuf,
      velBuf,
      massBuf,
      stars,
      starsU: uniforms(gl, stars, ["uMvp", "uDpr", "uColor", "uAlpha"]),
      starsVao,
      ring,
      ringU: uniforms(gl, ring, ["uMvp", "uPos", "uSizePx", "uColor", "uAlpha"]),
      trail,
      trailU: uniforms(gl, trail, ["uHist", "uMvp", "uHead", "uSegs", "uColor", "uAlpha"]),
      histTex,
      emptyVao,
    };
    massDirty = true;
    const info = gl.getParameter(gl.RENDERER);
    gpu = typeof info === "string" ? info : "";
    return true;
  }

  if (!init()) return null;

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    onAvailability?.(false);
  };
  const onRestored = () => {
    lost = !init();
    onAvailability?.(!lost);
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  return {
    get gpu() {
      return gpu;
    },

    upload(b: Bodies, full: boolean): void {
      if (lost || !res) return;
      const n = b.count;
      for (let i = 0; i < n; i++) {
        posStage[i * 3] = b.x[i];
        posStage[i * 3 + 1] = b.y[i];
        posStage[i * 3 + 2] = b.z[i];
        velStage[i * 3] = b.vx[i];
        velStage[i * 3 + 1] = b.vy[i];
        velStage[i * 3 + 2] = b.vz[i];
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, res.posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, posStage.subarray(0, n * 3));
      gl.bindBuffer(gl.ARRAY_BUFFER, res.velBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, velStage.subarray(0, n * 3));
      if (full || massDirty) {
        for (let i = 0; i < n; i++) massStage[i] = b.mass[i];
        gl.bindBuffer(gl.ARRAY_BUFFER, res.massBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, massStage.subarray(0, n));
        massDirty = false;
      }
    },

    pushTrailSample(b: Bodies): void {
      if (lost || !res) return;
      const n = b.count;
      if (n === 0) return;
      trailHead = (trailHead + 1) % TRAIL_K;
      if (trailValid < TRAIL_K) trailValid++;
      for (let i = 0; i < n; i++) {
        trailStage[i * 4] = b.x[i];
        trailStage[i * 4 + 1] = b.y[i];
        trailStage[i * 4 + 2] = b.z[i];
      }
      // Only the rows that hold live bodies need uploading.
      const rows = Math.min(rowsPerSlot, Math.ceil(n / TEX_W));
      gl.bindTexture(gl.TEXTURE_2D, res.histTex);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        trailHead * rowsPerSlot,
        TEX_W,
        rows,
        gl.RGBA,
        gl.FLOAT,
        trailStage.subarray(0, rows * TEX_W * 4),
      );
      gl.bindTexture(gl.TEXTURE_2D, null);
    },

    resetTrails(): void {
      trailHead = -1;
      trailValid = 0;
    },

    draw(s: DrawState): void {
      if (lost || !res) return;
      // A context can die without the lost event reaching us (it may fire
      // before our listeners attach); this per-frame probe is the safety net.
      if (gl.isContextLost()) {
        lost = true;
        onAvailability?.(false);
        return;
      }
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      gl.viewport(0, 0, w, h);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      const bg = s.palette.bg;

      // 1. Fresh background every frame (trails are geometry, not residue).
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Glows: additive on dark, premultiplied-over on light (both unsorted).
      if (s.dark) gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // 2. Starfield (rotates with the camera, ignores the follow target).
      gl.useProgram(res.stars);
      gl.uniformMatrix4fv(res.starsU.uMvp, false, s.starMvp);
      gl.uniform1f(res.starsU.uDpr, s.dpr);
      const stc = s.palette.textDim;
      gl.uniform3f(res.starsU.uColor, stc[0], stc[1], stc[2]);
      gl.uniform1f(res.starsU.uAlpha, (s.dark ? 0.55 : 0.8) * s.brightness);
      gl.bindVertexArray(res.starsVao);
      gl.drawArrays(gl.POINTS, 0, STAR_COUNT);

      // 3. Trails: one LINES call pulling world-space history per body, so
      //    the paths re-project under camera motion instead of smearing.
      if (s.trailSegs > 0 && trailValid > 1 && s.count > 0) {
        const segs = Math.min(s.trailSegs, trailValid - 1);
        gl.useProgram(res.trail);
        gl.uniformMatrix4fv(res.trailU.uMvp, false, s.mvp);
        gl.uniform1i(res.trailU.uHead, trailHead);
        gl.uniform1i(res.trailU.uSegs, segs);
        const tc = s.palette.accent2;
        gl.uniform3f(res.trailU.uColor, tc[0], tc[1], tc[2]);
        gl.uniform1f(res.trailU.uAlpha, (s.dark ? 0.4 : 0.55) * s.brightness);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, res.histTex);
        gl.uniform1i(res.trailU.uHist, 0);
        gl.bindVertexArray(res.emptyVao);
        gl.drawArrays(gl.LINES, 0, s.count * segs * 2);
      }

      // 4. Bodies.
      gl.useProgram(res.points);
      gl.uniformMatrix4fv(res.pointsU.uMvp, false, s.mvp);
      gl.uniform1f(res.pointsU.uSizeK, POINT_K * h);
      gl.uniform1f(res.pointsU.uMinPx, 1.6 * s.dpr);
      gl.uniform1f(res.pointsU.uMaxPx, 0.24 * h);
      gl.uniform1i(res.pointsU.uColorMode, s.colorMode === "speed" ? 0 : s.colorMode === "mass" ? 1 : 2);
      gl.uniform3f(res.pointsU.uAccent, s.palette.accent[0], s.palette.accent[1], s.palette.accent[2]);
      gl.uniform3f(res.pointsU.uAccent2, s.palette.accent2[0], s.palette.accent2[1], s.palette.accent2[2]);
      gl.uniform3f(res.pointsU.uMono, s.palette.textHi[0], s.palette.textHi[1], s.palette.textHi[2]);
      gl.uniform1f(res.pointsU.uSpeedScale, s.speedScale);
      gl.uniform2f(res.pointsU.uMassRange, s.massLogMin, s.massLogInvRange);
      // Fog starts at the target plane so zooming in never fogs the subject.
      gl.uniform2f(res.pointsU.uFog, s.camDist, 1 / 2.6);
      gl.uniform1f(res.pointsU.uBrightness, s.brightness);
      // Light theme needs a much harder alpha push: thin premultiplied glows
      // all but vanish against a white background.
      gl.uniform1f(res.pointsU.uAlphaK, s.dark ? 1 : 2.6);
      gl.uniform1f(res.pointsU.uHaloK, s.dark ? 1 : 0.5);
      // Mass "blackbody" ramp: emissive colors on dark, ink-like deep colors
      // on light (the dark ramp's near-white midpoint vanishes on white).
      if (s.dark) {
        gl.uniform3f(res.pointsU.uRampA, 0.95, 0.38, 0.2);
        gl.uniform3f(res.pointsU.uRampB, 1.0, 0.96, 0.88);
        gl.uniform3f(res.pointsU.uRampC, 0.62, 0.78, 1.0);
      } else {
        gl.uniform3f(res.pointsU.uRampA, 0.78, 0.26, 0.08);
        gl.uniform3f(res.pointsU.uRampB, 0.62, 0.45, 0.12);
        gl.uniform3f(res.pointsU.uRampC, 0.2, 0.34, 0.7);
      }
      gl.bindVertexArray(res.pointsVao);
      gl.drawArrays(gl.POINTS, 0, s.count);

      // 5. Follow-ring marker.
      if (s.ring) {
        gl.useProgram(res.ring);
        gl.uniformMatrix4fv(res.ringU.uMvp, false, s.mvp);
        gl.uniform3f(res.ringU.uPos, s.ring.x, s.ring.y, s.ring.z);
        gl.uniform1f(res.ringU.uSizePx, s.ring.sizePx);
        const rc = s.palette.accent;
        gl.uniform3f(res.ringU.uColor, rc[0], rc[1], rc[2]);
        gl.uniform1f(res.ringU.uAlpha, s.ring.alpha);
        gl.bindVertexArray(res.emptyVao);
        gl.drawArrays(gl.POINTS, 0, 1);
      }

      gl.bindVertexArray(null);
    },

    clear(bgc: [number, number, number]): void {
      if (lost) return;
      gl.clearColor(bgc[0], bgc[1], bgc[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },

    isLost(): boolean {
      return lost;
    },

    dispose(): void {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    },
  };
}
