export type Side = "L" | "R";

export type Status = "playing" | "won" | "lost";

export type SearchAlgo =
  | "bfs"
  | "dfs"
  | "iddfs"
  | "greedy"
  | "astar"
  | "ucs"
  | "bidir";

/** A puzzle configuration. The boat carries 1..k people per crossing. */
export interface Config {
  /** total missionaries */
  m: number;
  /** total cannibals */
  c: number;
  /** boat capacity */
  k: number;
}

/**
 * The whole world collapses to three numbers: how many missionaries and
 * cannibals sit on the LEFT bank, and which side the boat is docked. The right
 * bank is always `total − left`, so it never needs storing.
 */
export interface PuzzleState {
  ml: number;
  cl: number;
  boat: Side;
}

/** Passengers aboard a single crossing. */
export interface Load {
  m: number;
  c: number;
}

/** A move = a load plus the bank it departs from. */
export interface Move extends Load {
  from: Side;
}

export type DebugKind = "cross" | "win" | "lost" | "setup" | "solver" | "undo";

export interface DebugEntry {
  id: number;
  kind: DebugKind;
  /** the crossing number this entry relates to, when relevant */
  n: number | null;
  text: string;
}

export interface SearchResult {
  solvable: boolean;
  /** states from start..goal (inclusive). length 1 when already at goal. */
  path: PuzzleState[];
  /** moves[i] turns path[i] into path[i+1]. */
  moves: Move[];
  /** nodes pulled off the frontier and expanded. */
  expanded: number;
  /** distinct states ever discovered. */
  discovered: number;
  /** largest the frontier ever grew. */
  frontierPeak: number;
  /** total path cost - crossings for unit-cost algorithms, summed edge weights
   *  (people ferried) for the weighted UCS / Dijkstra search. */
  cost: number;
}

/**
 * One frame of a search animation: a snapshot of the search after a single node
 * was pulled off the frontier and expanded. State keys (`stateKey`) classify
 * every node of the graph into closed / frontier / unseen for the visualization.
 */
export interface SearchStep {
  /** the node just taken off the frontier this step (null on the seed frame) */
  expanded: PuzzleState | null;
  /** keys waiting to be expanded (discovered − closed; the DFS path for IDDFS) */
  frontier: string[];
  /** keys already expanded (the closed set) */
  closed: string[];
  /** every key discovered so far */
  discovered: string[];
  /** running expansion count (mirrors SearchResult.expanded) */
  expandedCount: number;
  /** running frontier-size peak */
  frontierPeak: number;
  /** current depth limit, for iterative deepening only */
  limit?: number;
}

/** The reachable state graph for a config - nodes plus undirected edges. */
export interface StateGraph {
  nodes: PuzzleState[];
  /** undirected edges between state keys, each listed once */
  edges: { a: string; b: string }[];
}
