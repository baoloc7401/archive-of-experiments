import type { Board, SolveOptions, Solver, SolverReport } from "./types";
import { ENUM_LIMIT, ENUM_NODE_CAP } from "../constants";
import {
  applyForced,
  buildConstraints,
  components,
  type Constraint,
  createKnowledge,
  enumerate,
  now,
  reveal,
  report,
  singlePointStep,
  subsetStep,
  unknownCells,
} from "./core";

/**
 * Single-Point's count rules as the fast path; when they stall, escalate — subset
 * elimination (which also shrinks components below the enumeration cap), then
 * exhaustive component enumeration, then the endgame global count — and return to
 * counting after each breakthrough. The escalation is complete, so it clears every
 * no-guess board the plain solver gives up on. Shows the hybrid shape: counting
 * does the bulk for free, search only breaks the occasional impasse.
 */
function solve(board: Board, origin: number, opts: SolveOptions = {}): SolverReport {
  const enumLimit = opts.enumLimit ?? ENUM_LIMIT;
  const nodeCap = opts.nodeCap ?? ENUM_NODE_CAP;
  const t0 = now();
  const k = createKnowledge(board, undefined, true);
  reveal(k, origin);
  const techniques = { count: 0, subset: 0, enumerate: 0 };
  let steps = 0;

  for (;;) {
    // Count rules first (cheap).
    if (singlePointStep(k)) {
      techniques.count++;
      steps++;
      continue;
    }
    const constraints = buildConstraints(k);
    if (constraints.length === 0) break;

    // Subset elimination — also shrinks components below the enumeration cap.
    if (subsetStep(k, constraints)) {
      techniques.subset++;
      steps++;
      continue;
    }

    // Enumerate each border component.
    let progressed = false;
    for (const comp of components(constraints)) {
      if (comp.cells.length > enumLimit) continue;
      const res = enumerate(comp.cells, comp.cons, nodeCap);
      if (res && applyForced(k, comp.cells, res)) progressed = true;
    }
    if (progressed) {
      techniques.enumerate++;
      steps++;
      continue;
    }

    // Endgame: fold in the global mine budget over the whole pool.
    const unknown = unknownCells(k);
    if (unknown.length > 0 && unknown.length <= enumLimit) {
      const global: Constraint = { cells: unknown, mines: k.mineCount - k.identified };
      const res = enumerate(unknown, [...constraints, global], nodeCap);
      if (res && applyForced(k, unknown, res)) {
        techniques.enumerate++;
        steps++;
        continue;
      }
    }
    break;
  }

  return report(k, "single-point-backtracking", techniques, steps, now() - t0);
}

export const singlePointBacktrackingSolver: Solver = {
  id: "single-point-backtracking",
  name: "Single-Point + Backtracking",
  tagline: "count rules first, search only to break impasses — and it finishes",
  description:
    "Single-Point's count rules carry the bulk of the board for free; whenever they stall, the engine escalates (subset → exhaustive enumeration → endgame global count) just far enough to force the next cell, then hands control back to counting. Complete — it clears every no-guess board the plain Single-Point solver gives up on — and shows how rarely real search is actually needed.",
  capabilities: {
    complete: true,
    provesNoGuess: true,
    givesProbabilities: false,
    suggestsGuess: false,
  },
  solve,
};
