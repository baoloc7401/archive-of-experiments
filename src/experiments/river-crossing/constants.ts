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

export type AlgoKind = "optimal" | "cost" | "any";

/**
 * The algorithm picker, in display order. Names and taglines live in i18n
 * (`experiments.river-crossing.search.algos.{id}`); `kind` drives the plan label
 * and which searches we call "optimal":
 * - `optimal` — returns a fewest-crossings path (BFS, IDDFS, A*, bidirectional)
 * - `cost`    — returns a least-weight path (UCS / Dijkstra, weighted by people ferried)
 * - `any`     — returns *a* valid path, not necessarily shortest (DFS, greedy)
 */
export const ALGOS: { id: SearchAlgo; kind: AlgoKind }[] = [
  { id: "bfs", kind: "optimal" },
  { id: "dfs", kind: "any" },
  { id: "iddfs", kind: "optimal" },
  { id: "greedy", kind: "any" },
  { id: "astar", kind: "optimal" },
  { id: "ucs", kind: "cost" },
  { id: "bidir", kind: "optimal" },
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
