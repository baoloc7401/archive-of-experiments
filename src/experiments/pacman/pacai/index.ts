// Registry of AI Pac-Man strategies. Adding a rung (e.g. Hamiltonian coverage
// or Monte-Carlo) means writing one PacStrategy and listing it here - the engine
// loop and UI read from this registry, so nothing else changes.

import { greedy } from "./greedy";
import { safe } from "./safe";
import { astar } from "./astar";
import { lookahead } from "./search";
import type { PacStrategy, PacStrategyId } from "./types";

export const PAC_STRATEGIES: Record<PacStrategyId, PacStrategy> = {
  greedy,
  safe,
  astar,
  search: lookahead,
};

/** Display order in the driver selector. */
export const PAC_STRATEGY_IDS: PacStrategyId[] = ["greedy", "safe", "astar", "search"];

export type { PacStrategy, PacStrategyId, PacController, PacPlan, PacCandidate } from "./types";
