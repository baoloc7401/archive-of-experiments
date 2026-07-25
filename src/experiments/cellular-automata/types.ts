/**
 * A generalized "Generations" outer-totalistic cellular automaton: cell state
 * is an integer 0..states-1. 0 = dead, 1 = alive, 2..states-1 = decaying (ages
 * down by one every generation regardless of neighbors, until it reaches 0).
 * A single engine (GPU shader + CPU mirror in miniSim.ts) covers both classic
 * 2-state Life-like rules (Conway, HighLife, Seeds, ...) and multi-state
 * Generations rules with glowing decay trails (Brian's Brain, Star Wars,
 * Frogs) - see rules.ts for the verified preset table.
 */

/** Torus (wrap) vs. dead-edge (void) neighbor sampling at the grid boundary. */
export type BoundaryMode = "wrap" | "void";

/** What the brush does under the pointer. */
export type BrushMode = "paint" | "erase";

/** Display colour mapping (cell age -> colour ramp). */
export type PaletteId = "ember" | "spectral" | "toxic" | "ice" | "mono";

/** A named point in rule-space (see rules.ts for the verified birth/survive/states). */
export type PresetId =
  | "conway"
  | "highlife"
  | "seeds"
  | "daynight"
  | "replicator"
  | "diamoeba"
  | "morley"
  | "lifewithoutdeath"
  | "life34"
  | "twoxtwo"
  | "anneal"
  | "briansbrain"
  | "starwars"
  | "frogs";

/**
 * A rule "genome": which neighbor counts (0..8) birth a dead cell and which
 * keep an alive cell alive, plus how many decay states a dead-but-not-yet-gone
 * cell passes through. Mutated/bred in rules.ts, evaluated by simulation.ts
 * (GPU) and miniSim.ts (CPU, for breeding-lab thumbnails and scoring).
 */
export interface RuleGenome {
  /** 9-bit mask over neighbor counts 0..8: bit i set = i live neighbors births a dead cell. */
  birth: number;
  /** 9-bit mask over neighbor counts 0..8: bit i set = i live neighbors keeps a live cell alive. */
  survive: number;
  /** Total states including dead(0) and alive(1); states>2 adds decay trail states. */
  states: number;
}

/** Tunable simulation + look parameters, all driven by sidebar controls. */
export interface CAParams {
  genome: RuleGenome;
  boundary: BoundaryMode;
  brushMode: BrushMode;
  /** Brush radius in cells. */
  brushRadius: number;
  /** Reseed fill fraction (0..1). */
  reseedDensity: number;
  /** Simulation generations run per rendered frame (evolution speed). */
  stepsPerFrame: number;
  palette: PaletteId;
  /** Simulation grid resolution as screen pixels per cell (one of CELL_LEVELS[].px). */
  cellSize: number;
}

/** Aggregate field stats from a low-res GPU readback (see simulation.ts sampleField). */
export interface CAFieldStats {
  /** Fraction of sampled cells in state 1 (alive). */
  population: number;
  /** Fraction of sampled cells in any non-dead state (alive + decaying). */
  footprint: number;
  /** Fraction of sampled cells whose state changed since the previous sample. */
  churn: number;
}

/**
 * Throttled live readout pushed up from the simulation loop, for the debug
 * panel. No `floatExt` field (unlike reaction-diffusion): this engine needs no
 * WebGL2 extension at all, only core integer textures.
 */
export interface CASnapshot extends CAFieldStats {
  fps: number;
  w: number;
  h: number;
  dpr: number;
  simW: number;
  simH: number;
  gpu: string;
  /** Total simulation generations executed since the canvas mounted. */
  generation: number;
}

/** A queued brush stroke: paint or erase in a disc centred at (u, v) in 0..1. */
export interface Splat {
  u: number;
  v: number;
  /** Radius in cells. */
  radius: number;
  mode: BrushMode;
}
