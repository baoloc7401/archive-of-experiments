import type { Board, Solver, SolverReport } from "./types";
import { createKnowledge, now, reveal, report, singlePointStep } from "./core";

/**
 * Only the two count rules (a number whose hidden neighbours are all mines, or
 * all safe). No cross-clue reasoning, so it stalls the moment a board needs a
 * 1-2-1. The baseline the other engines build on.
 */
function solve(board: Board, origin: number): SolverReport {
  const t0 = now();
  const k = createKnowledge(board, undefined, true);
  reveal(k, origin);
  let steps = 0;
  while (singlePointStep(k)) steps++;
  return report(k, "single-point", { count: steps }, steps, now() - t0);
}

export const singlePointSolver: Solver = {
  id: "single-point",
  name: "Single-Point",
  tagline: "count rules only — the naive baseline",
  description:
    "Applies just the trivial deductions: if a number already touches all its mines, the rest of its neighbours are safe; if its hidden neighbours exactly fill its count, they're all mines. Fast and obvious, but blind to any reasoning that spans two clues.",
  capabilities: {
    complete: false,
    provesNoGuess: false,
    givesProbabilities: false,
    suggestsGuess: false,
  },
  solve,
};
