import type { Board, Solver, SolverReport } from "./types";
import {
  buildConstraints,
  createKnowledge,
  now,
  reveal,
  report,
  singlePointStep,
  subsetStep,
} from "./core";

/**
 * Single-point plus subset elimination: when one clue's hidden cells are a subset
 * of another's, the leftover cells carry the difference in mines, often resolving
 * outright. This cracks the 1-2-1 / 1-2-2-1 patterns. Incomplete, but where it
 * stalls is a good signal the position needs full enumeration.
 */
function solve(board: Board, origin: number): SolverReport {
  const t0 = now();
  const k = createKnowledge(board, undefined, true);
  reveal(k, origin);
  const techniques = { count: 0, subset: 0 };
  let steps = 0;
  for (;;) {
    if (singlePointStep(k)) {
      techniques.count++;
      steps++;
      continue;
    }
    const constraints = buildConstraints(k);
    if (constraints.length === 0) break;
    if (subsetStep(k, constraints)) {
      techniques.subset++;
      steps++;
      continue;
    }
    break;
  }
  return report(k, "constraint-propagation", techniques, steps, now() - t0);
}

export const constraintPropagationSolver: Solver = {
  id: "constraint-propagation",
  name: "Constraint Propagation",
  tagline: "count + subset elimination - finds forced moves, flags stuck",
  description:
    "Iterates the count rules with subset elimination between overlapping clues, propagating until nothing new follows. Resolves the everyday patterns a strong human plays on sight, and when it halts with cells left, that's a reliable signal the position needs deeper search (or a guess).",
  capabilities: {
    complete: false,
    provesNoGuess: false,
    givesProbabilities: false,
    suggestsGuess: false,
  },
  solve,
};
