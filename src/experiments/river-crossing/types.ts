export type Side = "L" | "R";

export type Status = "playing" | "won" | "lost";

export type SearchAlgo = "bfs" | "dfs" | "astar";

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
}
