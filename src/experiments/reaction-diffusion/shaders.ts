import { LAP_DIAG, LAP_ORTHO } from "./constants";

/**
 * GLSL for the Gray-Scott pipeline. All passes share one fullscreen-triangle
 * vertex shader (no vertex buffer: positions are derived from gl_VertexID). The
 * simulation reads U,V from the R,G channels of a half-float texture and writes
 * the next state; the splat pass adds V under the brush; the display pass maps
 * concentration through the selected colour ramp.
 */

/** Fullscreen triangle: emits vUv in 0..1 with no attributes bound. */
export const FULLSCREEN_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * One explicit-Euler Gray-Scott step. The Laplacian uses a 9-tap stencil with
 * texelFetch (filter-independent, exact) and wraps at the edges so the field is
 * a torus (no boundary artefacts). Reaction: U + V + V -> 3V; V decays.
 */
export const SIM_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform ivec2 uSize;
uniform float uFeed;
uniform float uKill;
uniform float uDu;
uniform float uDv;
uniform float uDt;
out vec2 frag;

vec2 tap(ivec2 p) {
  ivec2 w = (p + uSize) % uSize;
  return texelFetch(uState, w, 0).xy;
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 here = tap(c);
  vec2 lap =
      (tap(c + ivec2(-1, 0)) + tap(c + ivec2(1, 0)) +
       tap(c + ivec2(0, -1)) + tap(c + ivec2(0, 1))) * ${LAP_ORTHO.toFixed(3)} +
      (tap(c + ivec2(-1, -1)) + tap(c + ivec2(1, -1)) +
       tap(c + ivec2(-1, 1)) + tap(c + ivec2(1, 1))) * ${LAP_DIAG.toFixed(3)} -
      here;
  float u = here.x;
  float v = here.y;
  float reaction = u * v * v;
  float du = (uDu * lap.x - reaction + uFeed * (1.0 - u)) * uDt;
  float dv = (uDv * lap.y + reaction - (uKill + uFeed) * v) * uDt;
  frag = clamp(vec2(u + du, v + dv), 0.0, 1.0);
}`;

/**
 * Brush pass: seeds the canonical Gray-Scott nucleus (U ~ 0.5, V ~ 0.25) in a
 * soft disc, read-modify-write so no blending is needed. Blending the region
 * toward that seed nucleates growth; flooding V to 1 instead would annihilate U
 * (U*V*V spikes) and collapse the disc back to substrate, reading as erasing.
 * The aspect term keeps the disc round on screen.
 */
const SEED_U = 0.5;
const SEED_V = 0.25;
export const SPLAT_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uPoint;
uniform float uRadius;
uniform float uAspect;
uniform float uInner;
in vec2 vUv;
out vec2 frag;
void main() {
  vec2 c = texture(uState, vUv).xy;
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  // uInner = fraction of the radius held at full strength before the edge ramp.
  // 0 = a soft dome (the brush); ~0.8 = a near-hard disc (seeding), so a small
  // nucleus actually carries the seed concentration instead of a faint smear -
  // a soft dome's effective core is only ~1/3 of its radius and was too weak.
  float a = 1.0 - smoothstep(uRadius * uInner, uRadius, length(d));
  frag = mix(c, vec2(${SEED_U.toFixed(2)}, ${SEED_V.toFixed(2)}), a);
}`;

/**
 * Rescale pass: samples the previous state (LINEAR) into a new-resolution
 * target so a canvas resize preserves the field instead of wiping it.
 */
export const RESCALE_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
in vec2 vUv;
out vec2 frag;
void main() {
  frag = texture(uState, vUv).xy;
}`;

/** Initial condition: U = 1, V = 0 everywhere (seed blobs are splatted after). */
export const SEED_FS = `#version 300 es
precision highp float;
out vec2 frag;
void main() {
  frag = vec2(1.0, 0.0);
}`;

/**
 * Readback copy: writes U,V into the R,G of an RGBA8 target so the field can be
 * read back cheaply (UNSIGNED_BYTE is universally readable). Sampled with LINEAR
 * to downsample, this gives the debug panel its mean/max/active aggregates.
 */
export const COPY_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
in vec2 vUv;
out vec4 frag;
void main() {
  vec2 c = texture(uState, vUv).xy;
  frag = vec4(c.x, c.y, 0.0, 1.0);
}`;

/** Maps V concentration through a five-stop ramp to screen colour. */
export const DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec3 uStops[5];
in vec2 vUv;
out vec4 frag;
void main() {
  vec2 c = texture(uState, vUv).xy;
  float t = clamp(c.y / 0.4, 0.0, 1.0);
  t = pow(t, 0.85);
  float s = t * 4.0;
  int i = int(floor(s));
  i = clamp(i, 0, 3);
  vec3 col = mix(uStops[i], uStops[i + 1], s - float(i));
  frag = vec4(col, 1.0);
}`;
