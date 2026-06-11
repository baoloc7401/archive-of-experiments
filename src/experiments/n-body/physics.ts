import { MAX_MERGE_PAIRS, MAX_SUBSTEPS_PER_FRAME, SUBSTEP } from "./constants";
import { bhForces, buildOctree, makeOctree, type ForceSink, type Octree } from "./octree";
import { radiusOf } from "./presets";
import type { Bodies, NBodyParams } from "./types";

/** Reusable per-step buffers, allocated once at capacity. */
export interface Scratch extends ForceSink {
  tree: Octree;
  /** Merge bookkeeping: tombstones, absorber links, and old-to-new indices. */
  dead: Uint8Array;
  into: Int32Array;
  remap: Int32Array;
}

export function makeBodies(capacity: number): Bodies {
  return {
    x: new Float64Array(capacity),
    y: new Float64Array(capacity),
    z: new Float64Array(capacity),
    vx: new Float64Array(capacity),
    vy: new Float64Array(capacity),
    vz: new Float64Array(capacity),
    mass: new Float64Array(capacity),
    radius: new Float64Array(capacity),
    count: 0,
    capacity,
  };
}

export function makeScratch(capacity: number): Scratch {
  return {
    ax: new Float64Array(capacity),
    ay: new Float64Array(capacity),
    az: new Float64Array(capacity),
    pairs: new Int32Array(MAX_MERGE_PAIRS * 2),
    pairCount: 0,
    pe: 0,
    evals: 0,
    tree: makeOctree(capacity),
    dead: new Uint8Array(capacity),
    into: new Int32Array(capacity),
    remap: new Int32Array(capacity),
  };
}

/** Frame-to-frame integration state owned by the canvas component. */
export interface SimState {
  simTime: number;
  /** Unspent sim time below one substep, carried across frames. */
  acc: number;
  /** Energy baseline for the drift stat (recaptured on seed and merges). */
  e0: number;
  /** Whether scratch accelerations match current positions/params. */
  accelValid: boolean;
}

export function makeSim(): SimState {
  return { simTime: 0, acc: 0, e0: 0, accelValid: false };
}

/** Exact direct summation over unique pairs (the theta = 0 path). */
function directForces(
  b: Bodies,
  G: number,
  eps2: number,
  sink: ForceSink,
  collectPairs: boolean,
): void {
  const n = b.count;
  const { x, y, z, mass, radius } = b;
  const { ax, ay, az, pairs } = sink;
  ax.fill(0, 0, n);
  ay.fill(0, 0, n);
  az.fill(0, 0, n);
  const maxPairs = pairs.length / 2;
  let pe = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    const zi = z[i];
    const mi = mass[i];
    for (let j = i + 1; j < n; j++) {
      const dx = x[j] - xi;
      const dy = y[j] - yi;
      const dz = z[j] - zi;
      const d2 = dx * dx + dy * dy + dz * dz;
      const inv = 1 / Math.sqrt(d2 + eps2);
      const f = G * inv * inv * inv;
      const fj = f * mass[j];
      const fi = f * mi;
      ax[i] += dx * fj;
      ay[i] += dy * fj;
      az[i] += dz * fj;
      ax[j] -= dx * fi;
      ay[j] -= dy * fi;
      az[j] -= dz * fi;
      pe -= G * mi * mass[j] * inv;
      if (collectPairs && sink.pairCount < maxPairs) {
        const rr = radius[i] + radius[j];
        if (d2 < rr * rr) {
          pairs[sink.pairCount * 2] = i;
          pairs[sink.pairCount * 2 + 1] = j;
          sink.pairCount++;
        }
      }
    }
  }
  sink.evals += (n * (n - 1)) / 2;
  sink.pe += pe;
}

/** Below this count the direct sum beats tree build + traversal anyway. */
const LEAN_DIRECT_LIMIT = 64;

/** One force pass at current positions; fills scratch ax/ay/az, pe, evals. */
export function computeForces(b: Bodies, p: NBodyParams, s: Scratch): void {
  s.pe = 0;
  s.evals = 0;
  s.pairCount = 0;
  const eps2 = p.softening * p.softening;
  if (p.theta > 0 && b.count > LEAN_DIRECT_LIMIT) {
    buildOctree(s.tree, b);
    bhForces(s.tree, b, p.gravity, eps2, p.theta, s, p.merging);
  } else {
    directForces(b, p.gravity, eps2, s, p.merging);
  }
}

/** Kinetic energy, O(n). */
export function kineticEnergy(b: Bodies): number {
  let ke = 0;
  for (let i = 0; i < b.count; i++) {
    ke +=
      0.5 *
      b.mass[i] *
      (b.vx[i] * b.vx[i] + b.vy[i] * b.vy[i] + b.vz[i] * b.vz[i]);
  }
  return ke;
}

/** Mean speed, O(n) - feeds the shader's speed-color normalization. */
export function meanSpeed(b: Bodies): number {
  const n = b.count;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.sqrt(b.vx[i] * b.vx[i] + b.vy[i] * b.vy[i] + b.vz[i] * b.vz[i]);
  }
  return sum / n;
}

/**
 * Total energy using the potential from the most recent force pass. Positions
 * move at most one substep past that pass, so as a telemetry value it is fine.
 */
export function totalEnergy(b: Bodies, s: Scratch): number {
  return kineticEnergy(b) + s.pe;
}

/** Run a force pass and capture the energy baseline (call after seeding). */
export function captureBaseline(b: Bodies, p: NBodyParams, s: Scratch, sim: SimState): void {
  computeForces(b, p, s);
  sim.accelValid = true;
  sim.e0 = totalEnergy(b, s);
}

/**
 * Merge each collected pair (inelastic: mass and momentum conserve, energy is
 * deliberately lost), then compact the SoA prefix. Fills scratch.remap with
 * old-to-new indices (a merged body maps to its absorber) for the follow
 * camera. Returns how many bodies were removed.
 */
function applyMerges(b: Bodies, s: Scratch): number {
  const n = b.count;
  const { dead, into, remap, pairs } = s;
  dead.fill(0, 0, n);
  let removed = 0;
  for (let pIdx = 0; pIdx < s.pairCount; pIdx++) {
    let i = pairs[pIdx * 2];
    let j = pairs[pIdx * 2 + 1];
    // Follow absorber chains in case an endpoint already merged this pass.
    while (dead[i] === 1) i = into[i];
    while (dead[j] === 1) j = into[j];
    if (i === j) continue;
    if (j < i) {
      const tmp = i;
      i = j;
      j = tmp;
    }
    const mi = b.mass[i];
    const mj = b.mass[j];
    const m = mi + mj;
    b.x[i] = (mi * b.x[i] + mj * b.x[j]) / m;
    b.y[i] = (mi * b.y[i] + mj * b.y[j]) / m;
    b.z[i] = (mi * b.z[i] + mj * b.z[j]) / m;
    b.vx[i] = (mi * b.vx[i] + mj * b.vx[j]) / m;
    b.vy[i] = (mi * b.vy[i] + mj * b.vy[j]) / m;
    b.vz[i] = (mi * b.vz[i] + mj * b.vz[j]) / m;
    b.mass[i] = m;
    b.radius[i] = radiusOf(m);
    dead[j] = 1;
    into[j] = i;
    removed++;
  }
  if (removed === 0) return 0;

  // Compact alive bodies down, recording where each old index ended up.
  let w = 0;
  for (let r = 0; r < n; r++) {
    if (dead[r] === 1) continue;
    if (w !== r) {
      b.x[w] = b.x[r];
      b.y[w] = b.y[r];
      b.z[w] = b.z[r];
      b.vx[w] = b.vx[r];
      b.vy[w] = b.vy[r];
      b.vz[w] = b.vz[r];
      b.mass[w] = b.mass[r];
      b.radius[w] = b.radius[r];
    }
    remap[r] = w;
    w++;
  }
  for (let r = 0; r < n; r++) {
    if (dead[r] === 1) {
      let a = into[r];
      while (dead[a] === 1) a = into[a];
      remap[r] = remap[a];
    }
  }
  b.count = w;
  return removed;
}

/**
 * One integration step of size `h` sim-seconds. Returns bodies merged away;
 * `followBox.idx` is remapped in place when merges shuffle indices.
 */
function substep(
  b: Bodies,
  p: NBodyParams,
  s: Scratch,
  sim: SimState,
  followBox: FollowBox,
  h = SUBSTEP,
): number {
  const n = b.count;
  const { x, y, z, vx, vy, vz } = b;
  const { ax, ay, az } = s;

  if (p.integrator === "leapfrog") {
    // Kick-drift-kick; accelerations from the previous substep's closing pass
    // are reused for the opening kick, costing one force pass per substep.
    if (!sim.accelValid) computeForces(b, p, s);
    const hh = h / 2;
    for (let i = 0; i < n; i++) {
      vx[i] += ax[i] * hh;
      vy[i] += ay[i] * hh;
      vz[i] += az[i] * hh;
      x[i] += vx[i] * h;
      y[i] += vy[i] * h;
      z[i] += vz[i] * h;
    }
    computeForces(b, p, s);
    for (let i = 0; i < n; i++) {
      vx[i] += ax[i] * hh;
      vy[i] += ay[i] * hh;
      vz[i] += az[i] * hh;
    }
    sim.accelValid = true;
  } else {
    // Explicit Euler: position and velocity both advance on stale data. Kept
    // on purpose - watching its orbits spiral outward is the teaching moment.
    computeForces(b, p, s);
    for (let i = 0; i < n; i++) {
      x[i] += vx[i] * h;
      y[i] += vy[i] * h;
      z[i] += vz[i] * h;
      vx[i] += ax[i] * h;
      vy[i] += ay[i] * h;
      vz[i] += az[i] * h;
    }
    sim.accelValid = false;
  }

  sim.simTime += h;

  if (p.merging && s.pairCount > 0) {
    const removed = applyMerges(b, s);
    if (removed > 0) {
      if (followBox.idx >= 0) followBox.idx = s.remap[followBox.idx];
      // Geometry changed: stale accelerations, and an energy baseline that
      // would otherwise book the inelastic loss as integrator drift.
      sim.accelValid = false;
      computeForces(b, p, s);
      sim.accelValid = true;
      sim.e0 = totalEnergy(b, s);
      return removed;
    }
  }
  return 0;
}

/** Mutable cell so merge passes can remap the camera's followed body. */
export interface FollowBox {
  idx: number;
}

/** Advance exactly one substep regardless of time scale (the step button). */
export function stepOnce(b: Bodies, p: NBodyParams, s: Scratch, sim: SimState, followBox: FollowBox): number {
  return substep(b, p, s, sim, followBox, p.substep ?? SUBSTEP);
}

/**
 * Advance by `dtRealMs` of wall-clock time at the configured time scale, in
 * fixed substeps (capped so a stalled frame drops sim time instead of
 * snowballing). Returns substeps taken and bodies merged away.
 */
/**
 * Advance by `dtRealMs` of wall-clock time at the configured time scale, in
 * fixed substeps of size `h` (= the scene's `substep`, else the default).
 *
 * The substep is physics fidelity and is independent of timeScale (playback
 * speed): a higher timeScale just takes more substeps per frame (capped so a
 * stalled frame drops sim time instead of snowballing). When a frame's worth
 * of sim time is below one full substep ("slow motion"), we still advance by
 * that sliver so the motion stays fluid rather than freezing between frames.
 */
export function advance(
  b: Bodies,
  p: NBodyParams,
  s: Scratch,
  sim: SimState,
  dtRealMs: number,
  followBox: FollowBox,
): { steps: number; merged: number } {
  const dtSim = Math.min(dtRealMs, 100) * 0.001 * p.timeScale;
  const h = p.substep ?? SUBSTEP;
  let steps = 0;
  let merged = 0;
  sim.acc += dtSim;
  while (sim.acc >= h && steps < MAX_SUBSTEPS_PER_FRAME) {
    merged += substep(b, p, s, sim, followBox, h);
    sim.acc -= h;
    steps++;
  }
  // Slow motion: a sub-substep sliver still advances (even finer than h).
  if (steps === 0 && sim.acc > 0) {
    merged += substep(b, p, s, sim, followBox, sim.acc);
    sim.acc = 0;
    steps = 1;
  }
  if (steps === MAX_SUBSTEPS_PER_FRAME && sim.acc > h) sim.acc = 0;
  return { steps, merged };
}
