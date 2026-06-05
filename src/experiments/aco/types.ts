// A city position, stored normalized in [0,1]² so rendering is canvas-size
// independent. Distances are computed in a scaled virtual space (see SCALE).
export interface Point {
  x: number;
  y: number;
}

// Tunable Ant System parameters.
export interface AcoParams {
  ants: number; // colony size — ants per iteration
  alpha: number; // pheromone influence (exploitation of learned trails)
  beta: number; // heuristic influence (greedy preference for short edges)
  rho: number; // evaporation rate in [0,1] — fraction of pheromone lost / iter
  q: number; // deposit strength (kept internal)
  elitist: boolean; // reinforce the best-so-far tour each iteration
}

// One ant's completed round trip for an iteration.
export interface Tour {
  path: number[]; // city indices in visiting order (length n); closes to path[0]
  length: number; // total tour length in scaled units
}

// A point-in-time summary the canvas pushes up for the stat panels.
export interface ColonySnapshot {
  iteration: number;
  bestLength: number; // best tour found so far (scaled units)
  lastBestLength: number; // best of the most recent iteration
  lastAvgLength: number; // mean tour length of the most recent iteration
  nnLength: number; // nearest-neighbour baseline
  history: number[]; // best-so-far length per iteration (for convergence chart)
  cities: number;
  converged: boolean; // best length unchanged for a while
}

// Structural runtime state the canvas exposes for the copyable debug report —
// the things not already in ColonySnapshot (canvas geometry, pheromone shape,
// the actual best path + coordinates).
export interface AcoDebug {
  cities: number;
  canvas: { w: number; h: number; dpr: number };
  iteration: number;
  bestLength: number;
  lastBestLength: number;
  lastAvgLength: number;
  nnLength: number;
  converged: boolean;
  progress: number; // edges walked into the current generation
  genActive: boolean; // a generation is mid-walk
  tau0: number; // initial pheromone level
  pheromone: { min: number; max: number; mean: number; aboveHalf: number; edges: number };
  bestPath: number[] | null;
  cityCoords: [number, number][]; // normalized, rounded to 3dp
}

// One line in the rolling event log.
export interface LogEntry {
  id: number;
  iter: number | null; // iteration when it happened, or null for setup events
  kind: "run" | "setup" | "best" | "milestone" | "warn";
  text: string;
}

export type LayoutId = "random" | "circle" | "clusters" | "grid";

export interface LayoutDef {
  id: LayoutId;
}
