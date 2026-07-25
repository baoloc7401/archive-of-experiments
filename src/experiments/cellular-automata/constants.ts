import type { CAParams, RuleGenome } from "./types";

/**
 * Total possible cell states. Baked into the GLSL `uColors[MAX_STATES]` array
 * (interpolated into the shader source in shaders.ts, mirroring how
 * reaction-diffusion interpolates its Laplacian weights) as well as the
 * `states` slider range - keep these in sync if either changes.
 */
export const MIN_STATES = 2;
export const MAX_STATES = 16;

/** Brush radius range, in simulation cells. */
export const MIN_BRUSH = 1;
export const MAX_BRUSH = 20;

/** Reseed fill fraction range. */
export const MIN_DENSITY = 0.05;
export const MAX_DENSITY = 0.6;

/**
 * Generations run per rendered frame. The default is deliberately low (unlike
 * reaction-diffusion's smooth-PDE feel): a CA generation is a discrete,
 * watchable tick, so the default speed lets you actually see cells flip one
 * generation at a time, with headroom to fast-forward chaotic rules.
 */
export const MIN_STEPS = 1;
export const MAX_STEPS = 60;

/**
 * Hard longest-edge clamp for the simulation grid, a perf safety net so a huge
 * window (or the "fine" cell-size level) cannot allocate a runaway grid. The
 * CA step shader is cheap (just neighbor counting, no PDE math), so this
 * ceiling is generous, not tight.
 */
export const SIM_MAX = 2048;

/**
 * Resolution as SCREEN PIXELS PER CELL, not a backing-store multiplier like
 * reaction-diffusion's RES_LEVELS. A CA's whole identity is discrete, visibly
 * separate cells; a multiplier that lands near 1:1 canvas-pixel-per-cell would
 * make the grid indistinguishable from noise at typical stage sizes.
 */
export const CELL_LEVELS = [
  { id: "fine", px: 2 },
  { id: "medium", px: 4 },
  { id: "chunky", px: 8 },
] as const;

export type CellLevelId = (typeof CELL_LEVELS)[number]["id"];

/** Grid size the breeding-lab thumbnails simulate and display at (see rules.ts scoreGenome). */
export const MINI_W = 40;
export const MINI_H = 26;

/** How many mutated offspring the breeding lab shows alongside the current rule. */
export const LITTER_SIZE = 6;

/** How throttled the debug-panel readback is, in ms (readPixels stalls the pipeline). */
export const STATS_INTERVAL = 400;

/**
 * Default rule: mirrors the "starwars" preset in rules.ts (B2/S345/G4) -
 * birth on 2 neighbors, survive on 3/4/5, 4 states. Chosen as the landing
 * default because random soup under this rule never settles into something
 * that reads as "frozen" (same philosophy as reaction-diffusion defaulting to
 * "coral"): it keeps producing crashing, glowing rakes and spaceships
 * indefinitely, and its multi-state decay trail immediately signals "this
 * isn't just Game of Life." Written as literal bit values here (not imported
 * from rules.ts's PRESETS) to keep constants.ts free of a dependency on
 * rules.ts - see mask(2) = 1<<2 = 4, mask(3,4,5) = 1<<3|1<<4|1<<5 = 56.
 */
export const DEFAULT_GENOME: RuleGenome = { birth: 4, survive: 56, states: 4 };

export const DEFAULT_PARAMS: CAParams = {
  genome: DEFAULT_GENOME,
  boundary: "wrap",
  brushMode: "paint",
  brushRadius: 4,
  reseedDensity: 0.3,
  stepsPerFrame: 4,
  palette: "spectral",
  cellSize: 4,
};
