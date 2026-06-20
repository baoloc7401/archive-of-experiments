// Registry of AI Pac-Man strategies. Adding a rung (e.g. Hamiltonian coverage
// or Monte-Carlo) means writing one PacStrategy and listing it here - the engine
// loop and UI read from this registry, so nothing else changes.

import { greedy } from "./greedy";
import { safe } from "./safe";
import { astar } from "./astar";
import { coverage } from "./coverage";
import { lookahead } from "./search";
import { montecarlo } from "./montecarlo";
import type { PacStrategy, PacStrategyId } from "./types";

export const PAC_STRATEGIES: Record<PacStrategyId, PacStrategy> = {
  greedy,
  safe,
  astar,
  coverage,
  search: lookahead,
  montecarlo,
};

/** Display order in the driver selector (the strategy ladder, simplest first). */
export const PAC_STRATEGY_IDS: PacStrategyId[] = [
  "greedy",
  "safe",
  "astar",
  "coverage",
  "search",
  "montecarlo",
];

export { setPortalsFromState } from "./graph";
export type { PacStrategy, PacStrategyId, PacController, PacPlan, PacCandidate } from "./types";
