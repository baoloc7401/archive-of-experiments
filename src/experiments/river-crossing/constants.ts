import type { Config, SearchAlgo } from "./types";

export const DEFAULT_CONFIG: Config = { m: 3, c: 3, k: 2 };

export const MIN_PEOPLE = 1;
export const MAX_PEOPLE = 5;
export const MIN_CAP = 2;
export const MAX_CAP = 4;

/** Crossing animation durations (ms) and the gap between auto-played moves. */
export const SPEED_PRESETS: { label: string; ms: number }[] = [
  { label: "0.5×", ms: 1500 },
  { label: "1×", ms: 900 },
  { label: "2×", ms: 520 },
  { label: "4×", ms: 300 },
];
export const DEFAULT_SPEED_INDEX = 1;

/** Pause between consecutive auto-played crossings. */
export const PLAY_GAP = 360;

/** Per-speed delay between animated search-graph steps (matches SPEED_PRESETS order). */
export const SEARCH_STEP_MS = [620, 380, 210, 120];

/**
 * `kind` drives the plan label and which searches we call "optimal":
 * - `optimal` — returns a fewest-crossings path (BFS, IDDFS, A*, bidirectional)
 * - `cost`    — returns a least-weight path (UCS / Dijkstra, weighted by people ferried)
 * - `any`     — returns *a* valid path, not necessarily shortest (DFS, greedy)
 */
export const ALGOS: {
  id: SearchAlgo;
  name: string;
  tagline: string;
  kind: "optimal" | "cost" | "any";
}[] = [
  { id: "bfs", name: "Breadth-First", tagline: "fewest crossings, guaranteed", kind: "optimal" },
  { id: "dfs", name: "Depth-First", tagline: "any solution, dives deep first", kind: "any" },
  {
    id: "iddfs",
    name: "Iterative Deepening",
    tagline: "DFS memory, BFS-optimal depth",
    kind: "optimal",
  },
  {
    id: "greedy",
    name: "Greedy Best-First",
    tagline: "chase the heuristic, ignore the cost",
    kind: "any",
  },
  { id: "astar", name: "A*", tagline: "guided by a people-left heuristic", kind: "optimal" },
  {
    id: "ucs",
    name: "Uniform-Cost",
    tagline: "least people ferried — weighted edges",
    kind: "cost",
  },
  {
    id: "bidir",
    name: "Bidirectional",
    tagline: "search from both shores, meet in the middle",
    kind: "optimal",
  },
];

export const ALGO_BY_ID = Object.fromEntries(
  ALGOS.map((a) => [a.id, a])
) as Record<SearchAlgo, (typeof ALGOS)[number]>;

/**
 * A doomed missionary's hilarious last words live in i18n under
 * `experiments.river-crossing.death_shouts` (en + vi must stay in sync at this
 * length). The hook stores a random *index* so the line is stable across
 * re-renders; the scene resolves it through `t()`.
 */
export const DEATH_SHOUT_COUNT = 16;

export function randomShoutIndex(): number {
  return Math.floor(Math.random() * DEATH_SHOUT_COUNT);
}
