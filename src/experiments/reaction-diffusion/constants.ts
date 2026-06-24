import type { RDParams } from "./types";

/**
 * Feed/kill ranges bracket the interesting region of the Gray-Scott map: below
 * ~0.01 feed the field dies, above ~0.1 it saturates; kill outside ~0.03..0.075
 * collapses to a flat steady state. Steps are small so the sliders feel precise.
 */
export const MIN_FEED = 0;
export const MAX_FEED = 0.1;
export const FEED_STEP = 0.0005;

export const MIN_KILL = 0.03;
export const MAX_KILL = 0.075;
export const KILL_STEP = 0.0005;

/**
 * Diffusion + timestep defaults follow the widely reproduced Gray-Scott
 * convention (dA = 1.0, dB = 0.5, dt = 1.0 with a 9-tap Laplacian). The ranges
 * stay near those values: pushing dt or the diffusion rates far past the
 * defaults makes the explicit Euler step blow up (a reset re-seeds a clean
 * field), which the slider hints warn about.
 */
export const MIN_DU = 0.2;
export const MAX_DU = 1.4;
export const MIN_DV = 0.1;
export const MAX_DV = 0.8;
export const MIN_DT = 0.2;
export const MAX_DT = 1.4;

/** Brush radius range, in simulation texels. */
export const MIN_BRUSH = 4;
export const MAX_BRUSH = 50;

/** Simulation steps per rendered frame: more = patterns evolve faster. */
export const MIN_STEPS = 1;
export const MAX_STEPS = 24;

/**
 * Hard longest-edge clamp for the simulation grid, a perf safety net so a huge
 * window (or a >1 resolution scale) cannot allocate a runaway grid. The actual
 * grid is the canvas backing store times the `resolution` scale, then clamped to
 * this. (Feature size is a fixed cell count, so more cells = finer features.)
 */
export const SIM_MAX = 2048;

/** Resolution presets: grid size as a multiple of the canvas backing store. */
export const RES_LEVELS = [
  { id: "low", scale: 0.5 },
  { id: "medium", scale: 0.75 },
  { id: "high", scale: 1 },
  { id: "ultra", scale: 1.5 },
  { id: "max", scale: 2 },
] as const;

export type ResLevelId = (typeof RES_LEVELS)[number]["id"];

/** 9-tap Laplacian weights (orthogonal / diagonal); the centre is -1. */
export const LAP_ORTHO = 0.2;
export const LAP_DIAG = 0.05;

/** How throttled the preview inset's redraw is, in steps per tick. */
export const PREVIEW_SIZE = 128;

export const DEFAULT_PARAMS: RDParams = {
  // Default to "coral": fills the canvas with lush branching structure and keeps
  // evolving. Mitosis (the old default) settled into a sparse spot field that
  // read as "nothing happening"; maze fills but freezes once formed.
  feed: 0.0545,
  kill: 0.062,
  du: 1.0,
  dv: 0.5,
  dt: 1.0,
  palette: "magma",
  brushSize: 14,
  stepsPerFrame: 12,
  // 1:1 with the canvas backing store - crisp by default (lower this for more
  // speed, raise it for even finer features).
  resolution: 1,
};
