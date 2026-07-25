import { MAX_STATES } from "./constants";

/**
 * GLSL for the Generations cellular-automaton pipeline. Cell state lives in
 * the R channel of an RGBA8UI integer texture (an exact 0..states-1 integer,
 * never a blendable quantity) - chosen over reaction-diffusion's float
 * ping-pong specifically because CA state IS discrete, and RGBA8UI/R8UI are
 * core-WebGL2-renderable formats (no EXT_color_buffer_float dependency at
 * all). That choice has real, non-optional consequences baked into every pass
 * below:
 *
 *  - Integer textures only ever sample via `texelFetch` with `usampler2D`,
 *    never `texture()`/LINEAR (LINEAR filtering an integer texture is illegal
 *    - the texture becomes "incomplete" and silently samples as zero, no
 *    error). TEXTURE_MIN/MAG_FILTER on the state texture must stay NEAREST -
 *    do not "smooth" it later.
 *  - `usampler2D` has NO default precision in GLSL ES 3.00 (unlike
 *    `sampler2D`, which defaults to lowp) - every pass that samples the state
 *    texture must declare `precision highp usampler2D;` explicitly or it is a
 *    compile error, not just imprecise.
 *  - `gl.clear()` is unreliable on an integer-attached framebuffer. Every
 *    fill/wipe of the state texture (initial allocation, "clear" action,
 *    "reseed" action, post-context-restore) is one of these shader passes,
 *    never a `gl.clear()` call - see CLEAR_FS/SEED_FS.
 *  - Resize and the debug-stats readback both need a `texture()`-with-LINEAR
 *    downsample the way reaction-diffusion does it - illegal here for the
 *    same reason. RESCALE_FS and COPY_FS both point-sample via `texelFetch`
 *    instead (see their own comments).
 *
 * All passes share one fullscreen-triangle vertex shader (no vertex buffer:
 * positions come from gl_VertexID), same technique as reaction-diffusion's
 * own copy - nothing is shared between experiment folders in this repo.
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
 * One Generations step. `tap` reads a neighbor's raw state: under wrap it
 * manually mods the coordinate into range then texelFetches (torus, no
 * boundary seam); under void it bounds-checks FIRST and returns 0 without
 * ever calling texelFetch out of range (texelFetch with out-of-range
 * coordinates is spec-undefined, not guaranteed zero). The neighbor sum only
 * counts state===1 (truly alive) - a decaying neighbor (state 2..states-1)
 * must NOT contribute, or the verified Wikipedia/Golly rule strings would
 * behave wrong. `next` is clamped to uStates-1 so dragging the states slider
 * down mid-run can never leave a cell holding an out-of-range value.
 */
export const SIM_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uState;
uniform ivec2 uSize;
uniform int uBirth;
uniform int uSurvive;
uniform int uStates;
uniform bool uWrap;
out uvec4 frag;

uint tap(ivec2 p) {
  if (uWrap) {
    p = ((p % uSize) + uSize) % uSize;
  } else if (p.x < 0 || p.y < 0 || p.x >= uSize.x || p.y >= uSize.y) {
    return 0u;
  }
  return texelFetch(uState, p, 0).r;
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  uint here = min(tap(c), uint(uStates - 1));

  int alive = 0;
  alive += tap(c + ivec2(-1, -1)) == 1u ? 1 : 0;
  alive += tap(c + ivec2( 0, -1)) == 1u ? 1 : 0;
  alive += tap(c + ivec2( 1, -1)) == 1u ? 1 : 0;
  alive += tap(c + ivec2(-1,  0)) == 1u ? 1 : 0;
  alive += tap(c + ivec2( 1,  0)) == 1u ? 1 : 0;
  alive += tap(c + ivec2(-1,  1)) == 1u ? 1 : 0;
  alive += tap(c + ivec2( 0,  1)) == 1u ? 1 : 0;
  alive += tap(c + ivec2( 1,  1)) == 1u ? 1 : 0;

  uint next;
  if (here == 0u) {
    next = ((uBirth >> alive) & 1) != 0 ? 1u : 0u;
  } else if (here == 1u) {
    bool surv = ((uSurvive >> alive) & 1) != 0;
    next = surv ? 1u : (uStates > 2 ? uint(uStates - 1) : 0u);
  } else {
    next = here - 1u;
  }
  frag = uvec4(min(next, uint(uStates - 1)), 0u, 0u, 255u);
}`;

/**
 * Brush pass: paints (uMode=1) or erases (uMode=0) a hard disc, read-modify-
 * write so no blending is needed. The edge is a stochastic "fizzy" cutoff
 * (a hash-driven probability, not a gradient) rather than reaction-diffusion's
 * soft gaussian dome - a discrete cell state has no continuous blend to fade
 * into, so a probabilistic edge is the closest discrete analogue.
 */
export const SPLAT_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uState;
uniform ivec2 uSize;
uniform vec2 uPoint;
uniform float uRadius;
uniform float uAspect;
uniform int uMode;
in vec2 vUv;
out uvec4 frag;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  ivec2 c = ivec2(vUv * vec2(uSize));
  c = clamp(c, ivec2(0), uSize - ivec2(1));
  uint cur = texelFetch(uState, c, 0).r;
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  float dist = length(d) / uRadius;
  float edgeStart = 0.75;
  float keepChance = dist < edgeStart ? 1.0 : 1.0 - smoothstep(edgeStart, 1.0, dist);
  bool inside = dist < 1.0 && hash(vec2(c) + uPoint * 991.7) < keepChance;
  uint value = uMode == 1 ? 1u : 0u;
  frag = uvec4(inside ? value : cur, 0u, 0u, 255u);
}`;

/** Wipes the whole state texture to all-dead. Never gl.clear() on an integer FBO - see file header. */
export const CLEAR_FS = `#version 300 es
precision highp float;
out uvec4 frag;
void main() {
  frag = uvec4(0u, 0u, 0u, 255u);
}`;

/** Reseed: per-cell hash against a density threshold, seeded so repeat reseeds differ. */
export const SEED_FS = `#version 300 es
precision highp float;
uniform float uDensity;
uniform float uSeed;
in vec2 vUv;
out uvec4 frag;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453123);
}

void main() {
  uint alive = hash(vUv * 977.0) < uDensity ? 1u : 0u;
  frag = uvec4(alive, 0u, 0u, 255u);
}`;

/**
 * Resize: nearest-neighbor remap of the old grid into the new size via
 * texelFetch (never texture()/LINEAR - illegal on an integer texture). This
 * is actually a better fit for CA than reaction-diffusion's blur-resample:
 * nearest-neighbor keeps a discrete cell pattern intact through a resize
 * instead of smearing it.
 */
export const RESCALE_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uState;
uniform ivec2 uOldSize;
in vec2 vUv;
out uvec4 frag;
void main() {
  ivec2 oldC = ivec2(vUv * vec2(uOldSize));
  oldC = clamp(oldC, ivec2(0), uOldSize - ivec2(1));
  frag = uvec4(texelFetch(uState, oldC, 0).r, 0u, 0u, 255u);
}`;

/**
 * Readback copy: point-samples (texelFetch, never a LINEAR blend) the integer
 * state into a plain RGBA8 target so the field can be read back cheaply via
 * gl.readPixels(RGBA, UNSIGNED_BYTE) - the same proven trick reaction-
 * diffusion uses, which sidesteps ever needing to read an integer framebuffer
 * directly (its format/type combination rules are far more fragile). The byte
 * value read back equals the exact integer state (states max MAX_STATES,
 * comfortably under 256 - no precision loss).
 */
export const COPY_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uState;
uniform ivec2 uSize;
in vec2 vUv;
out vec4 frag;
void main() {
  ivec2 c = ivec2(vUv * vec2(uSize));
  c = clamp(c, ivec2(0), uSize - ivec2(1));
  uint s = texelFetch(uState, c, 0).r;
  frag = vec4(float(s) / 255.0, 0.0, 0.0, 1.0);
}`;

/**
 * Maps cell state through the selected palette's per-state colour (see
 * palettes.ts paletteColors - a flat lookup, not an interpolation, matching
 * the discrete-cell aesthetic). uColors is always uploaded at the full
 * MAX_STATES length (unused tail padded, never a short array); uStates clamps
 * the read index so a stale out-of-range cell value never indexes past the
 * end.
 */
export const DISPLAY_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uState;
uniform ivec2 uSize;
uniform vec3 uColors[${MAX_STATES}];
uniform int uStates;
in vec2 vUv;
out vec4 frag;
void main() {
  ivec2 c = ivec2(vUv * vec2(uSize));
  c = clamp(c, ivec2(0), uSize - ivec2(1));
  uint s = texelFetch(uState, c, 0).r;
  int idx = clamp(int(s), 0, uStates - 1);
  frag = vec4(uColors[idx], 1.0);
}`;
