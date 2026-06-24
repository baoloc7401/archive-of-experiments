/**
 * WebGPU compute kernels for the brute-force N-body solver (the opt-in GPU
 * mode). Unlike the CPU path's Barnes-Hut tree, this sums every pair exactly -
 * O(n^2) - because the GPU is so parallel that the tiled all-pairs kernel beats
 * a branchy tree traversal, and direct summation has zero divergence.
 *
 * Three entry points share one bind group, run once per substep in sequence:
 *   kickDrift -> forces -> kick   (leapfrog kick-drift-kick, symplectic)
 * `forces` is the only expensive pass; the two kicks are O(n) bookkeeping. The
 * closing kick's accelerations carry into the next substep's opening kick, so
 * each substep costs exactly one force evaluation (matching the CPU leapfrog).
 *
 * Tiling: each workgroup streams the body list through shared memory one TILE
 * at a time, so every position is read from fast workgroup storage TILE times
 * instead of from global memory. The classic GPU N-body kernel.
 */

/** Workgroup size and shared-memory tile width. */
export const TILE = 64;

/**
 * Buffer layout (all vec4<f32>, indexed by body):
 *   pos.xyz = position, pos.w = mass
 *   vel.xyz = velocity, vel.w unused
 *   acc.xyz = acceleration, acc.w unused
 * Mass lives in pos.w so the force kernel needs a single fetch per neighbour.
 */
export const NBODY_WGSL = /* wgsl */ `
struct Params {
  g: f32,
  eps2: f32,
  h: f32,
  n: u32,
};

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> acc: array<vec4<f32>>;

var<workgroup> tile: array<vec4<f32>, ${TILE}u>;

@compute @workgroup_size(${TILE})
fn forces(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_index) lidx: u32,
) {
  let i = gid.x;
  let n = P.n;
  // Out-of-range threads still load tiles and hit the barriers (uniform control
  // flow), so guard only the position fetch and the final write.
  let pi = pos[select(i, 0u, i >= n)].xyz;
  var a = vec3<f32>(0.0, 0.0, 0.0);
  let tiles = (n + ${TILE}u - 1u) / ${TILE}u;
  for (var t: u32 = 0u; t < tiles; t = t + 1u) {
    let j = t * ${TILE}u + lidx;
    // Pad past n with zero-mass bodies: they contribute no force.
    if (j < n) { tile[lidx] = pos[j]; } else { tile[lidx] = vec4<f32>(0.0); }
    workgroupBarrier();
    for (var k: u32 = 0u; k < ${TILE}u; k = k + 1u) {
      let bj = tile[k];
      let d = bj.xyz - pi;
      // Plummer softening; the self term has d = 0 so it adds nothing.
      let r2 = dot(d, d) + P.eps2;
      let inv = inverseSqrt(r2);
      let f = P.g * bj.w * inv * inv * inv;
      a = a + d * f;
    }
    workgroupBarrier();
  }
  if (i < n) { acc[i] = vec4<f32>(a, 0.0); }
}

@compute @workgroup_size(${TILE})
fn kickDrift(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let v = vel[i].xyz + acc[i].xyz * (P.h * 0.5);
  let p = pos[i];
  pos[i] = vec4<f32>(p.xyz + v * P.h, p.w);
  vel[i] = vec4<f32>(v, 0.0);
}

@compute @workgroup_size(${TILE})
fn kick(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= P.n) { return; }
  vel[i] = vec4<f32>(vel[i].xyz + acc[i].xyz * (P.h * 0.5), 0.0);
}
`;
