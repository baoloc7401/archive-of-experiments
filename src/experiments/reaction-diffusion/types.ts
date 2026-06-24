/**
 * Gray-Scott reaction-diffusion: two chemicals U and V live in the R,G channels
 * of a float texture. The whole field is advanced on the GPU by ping-ponging
 * between two framebuffers; React never touches a pixel. These types describe
 * only the tunables the sidebar drives and the brush requests the canvas queues.
 */

/** Display colour mapping (concentration -> colour ramp). */
export type PaletteId = "magma" | "viridis" | "ice" | "ember" | "mono";

/** A named (feed, kill) pair from the Gray-Scott parameter map. */
export type PresetId =
  | "solitons"
  | "mitosis"
  | "spots"
  | "worms"
  | "maze"
  | "coral"
  | "fingerprint"
  | "uskate";

/** Tunable reaction + look parameters, all driven by sidebar controls. */
export interface RDParams {
  /** Feed rate f: how fast U is replenished. */
  feed: number;
  /** Kill rate k: how fast V is removed. */
  kill: number;
  /** Diffusion rate of U (the classic dA). */
  du: number;
  /** Diffusion rate of V (the classic dB). */
  dv: number;
  /** Integration timestep; larger evolves faster but can destabilize. */
  dt: number;
  /** Display colour mapping. */
  palette: PaletteId;
  /** Brush radius in simulation texels. */
  brushSize: number;
  /** Simulation steps run per rendered frame (evolution speed). */
  stepsPerFrame: number;
  /**
   * Simulation grid resolution as a multiple of the canvas backing store. 1 = a
   * crisp 1:1 grid; <1 is coarser/faster (and blurrier upscaled); >1 supersamples
   * for extra-fine features. Higher = more, smaller "particles" but more GPU cost.
   */
  resolution: number;
}

/**
 * Throttled live readout pushed up from the simulation loop, for the debug
 * panel. The field aggregates come from a small GPU readback, so "all black"
 * (field died), "saturated" (blew up), or "patterned" are all distinguishable
 * from the numbers alone.
 */
export interface RDSnapshot {
  fps: number;
  /** Canvas backing-store size and device pixel ratio. */
  w: number;
  h: number;
  dpr: number;
  /** Simulation grid size in texels. */
  simW: number;
  simH: number;
  /** GL renderer string. */
  gpu: string;
  /** Which extension made the float render targets work. */
  floatExt: string;
  /** Mean U across the sampled field (0..1). */
  meanU: number;
  /** Mean V across the sampled field (0..1). */
  meanV: number;
  /** Peak V across the sampled field (0..1). */
  maxV: number;
  /** Fraction of sampled cells with V above a small threshold (0..1). */
  active: number;
  /** Mean |V change| since the previous snapshot (0 = field not moving). */
  delta: number;
  /** Total simulation steps executed since the canvas mounted. */
  steps: number;
}

/** A queued brush stroke: seed V in a soft disc centred at (u, v) in 0..1. */
export interface Splat {
  /** Horizontal position in 0..1 texture space. */
  u: number;
  /** Vertical position in 0..1 texture space. */
  v: number;
  /** Radius in simulation texels. */
  radius: number;
}
