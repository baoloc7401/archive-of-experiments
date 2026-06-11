/**
 * The bodies in structure-of-arrays form: parallel typed arrays indexed by
 * body. Buffers are allocated once at `capacity` (= MAX_COUNT) so changing the
 * live `count` never reallocates - it just grows/shrinks the active prefix.
 * Positions/velocities are Float64 because gravitational dynamics compound
 * rounding error fast in tight orbits; the renderer copies into Float32 for GL.
 */
export interface Bodies {
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  vz: Float64Array;
  /** Gravitational mass in sim units (each preset totals ~O(1)). */
  mass: Float64Array;
  /** Collision radius (~ cbrt(mass)), used by the merge pass. */
  radius: Float64Array;
  count: number;
  capacity: number;
}

/** How velocities are advanced each substep. */
export type Integrator = "leapfrog" | "euler";

/** How each body is tinted by the shader. */
export type ColorMode = "speed" | "mass" | "mono";

/** Initial-condition scene applied on seed/reset. */
export type PresetId =
  | "collision"
  | "cluster"
  | "solar"
  | "belt"
  | "trojans"
  | "binary"
  | "figure8"
  | "threebody"
  | "disk"
  | "stream"
  | "blackhole"
  | "cloud";

/** Tunable simulation + look parameters, all driven by sidebar controls. */
export interface NBodyParams {
  /** Active initial-condition scene. */
  preset: PresetId;
  /** How many bodies the scene is generated with. */
  count: number;
  /** Sim seconds advanced per real second (0 freezes time, sliders stay live). */
  timeScale: number;
  /** Gravitational constant multiplier (base G = 1). */
  gravity: number;
  /** Plummer softening length: caps the force of near passes. */
  softening: number;
  /** Barnes-Hut opening angle; 0 = exact direct summation. */
  theta: number;
  /** Velocity update scheme (explicit Euler exists to show energy drift). */
  integrator: Integrator;
  /**
   * Fixed integration step in sim seconds (physics fidelity, NOT playback
   * speed - that is timeScale). Scenes with tight orbits (moons, a heavy
   * centre) set a smaller step; omitted falls back to the default SUBSTEP.
   */
  substep?: number;
  /** Merge bodies that touch, conserving mass and momentum. */
  merging: boolean;
  /** How many sim seconds of path each body leaves behind (0 = off). */
  trails: number;
  /** Body tint scheme. */
  colorMode: ColorMode;
  /** Slow auto-orbit of the camera while running. */
  spin: boolean;
}

/** Orbit camera state driven by drag, wheel/pinch, and auto-spin. */
export interface View {
  yaw: number;
  pitch: number;
  zoom: number;
}

/** Throttled live readout pushed up from the simulation loop. */
export interface NBodySnapshot {
  count: number;
  fps: number;
  /** Force evaluations in the latest substep. */
  evals: number;
  /** Same, as a percentage of the n^2 direct-sum cost. */
  evalsPct: number;
  kinetic: number;
  total: number;
  /** Relative energy drift since the energy baseline was captured. */
  drift: number;
  simTime: number;
  /** Followed body index, or -1. */
  follow: number;
  followMass: number;
  followSpeed: number;
  yaw: number;
  pitch: number;
  zoom: number;
  w: number;
  h: number;
  dpr: number;
  /** GL renderer string for perf debugging (empty until known). */
  gpu: string;
}
