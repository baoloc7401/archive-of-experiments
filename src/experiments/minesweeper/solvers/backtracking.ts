import type { Board, SolveOptions, Solver, SolverReport } from "./types";
import { ENUM_LIMIT, ENUM_NODE_CAP } from "../constants";
import { createKnowledge, fullPropagate, now, reveal, report } from "./core";

/**
 * The complete solver ("tank"). When the cheap rules stall it enumerates every
 * consistent mine arrangement of each border component (plus the global count in
 * the endgame); a cell that's a mine in all of them is a mine, in none is safe.
 * Anything left genuinely requires a guess, so this both confirms solvability and
 * pinpoints true ambiguity. Pipeline lives in {@link fullPropagate}.
 */
function solve(board: Board, origin: number, opts: SolveOptions = {}): SolverReport {
  const enumLimit = opts.enumLimit ?? ENUM_LIMIT;
  const nodeCap = opts.nodeCap ?? ENUM_NODE_CAP;
  const t0 = now();
  const k = createKnowledge(board, undefined, true);
  reveal(k, origin);
  const techniques = { count: 0, subset: 0, enumerate: 0 };
  const steps = fullPropagate(k, enumLimit, nodeCap, techniques);
  return report(k, "backtracking", techniques, steps, now() - t0);
}

export const backtrackingSolver: Solver = {
  id: "backtracking",
  name: "Backtracking",
  tagline: "exhaustive frontier search — confirms solvability, finds ambiguity",
  description:
    "When propagation stalls, it enumerates every legal mine arrangement of each border component (plus the global count in the endgame). Cells constant across all arrangements are forced; the rest are provably ambiguous. Complete for no-guess certification, bounded by a component-size and node cap.",
  capabilities: {
    complete: true,
    provesNoGuess: true,
    givesProbabilities: false,
    suggestsGuess: false,
  },
  solve,
};
