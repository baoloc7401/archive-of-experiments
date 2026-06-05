import type { Board, Solver, SolverId, SolverReport, SolveOptions, SystemDescriptor } from "./types";
import { singlePointSolver } from "./singlePoint";
import { singlePointBacktrackingSolver } from "./singlePointBacktracking";
import { constraintPropagationSolver } from "./constraintPropagation";
import { linearAlgebraSolver } from "./linearAlgebra";
import { backtrackingSolver } from "./backtracking";
import { satSolver } from "./sat";
import { probabilisticSolver } from "./probabilistic";

/**
 * The solver registry. Every engine implements {@link Solver} and returns a
 * normalized {@link SolverReport}, so a future "compare solvers" view can run
 * them all on one position. Ordered roughly weakest → strongest.
 */
export const SOLVERS: Solver[] = [
  singlePointSolver,
  singlePointBacktrackingSolver,
  constraintPropagationSolver,
  linearAlgebraSolver,
  backtrackingSolver,
  satSolver,
  probabilisticSolver,
];

export function getSolver(id: SolverId): Solver {
  const s = SOLVERS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown solver: ${id}`);
  return s;
}

/** Run every solver on one position (for the comparison view). */
export function compareSolvers(board: Board, origin: number, opts?: SolveOptions): SolverReport[] {
  return SOLVERS.map((s) => s.solve(board, origin, opts));
}

/**
 * Not a position-solver but the production field-generation method: wraps the
 * backtracking solver in generate-and-test with hill-climb repair (see
 * `generator.ts`). Listed here so the comparison view can show it alongside.
 */
export const GENERATE_AND_TEST: SystemDescriptor = {
  id: "generate-and-test",
  name: "Generate & Test",
  tagline: "random boards, verified no-guess",
  description:
    "Generates candidate fields and tests each with the backtracking solver, keeping only no-guess boards. Single-mine hill-climb repair nudges near-misses across the line, bounded by a wall-clock budget. This is how the experiment actually builds its minefields.",
};

export { backtrackingSolver as completeSolver };
export type { Board, Solver, SolverId, SolverReport, SolveOptions, SystemDescriptor };
export type { SolverCapabilities, SolveStatus } from "./types";
