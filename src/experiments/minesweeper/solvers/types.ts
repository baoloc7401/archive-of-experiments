import type { Minefield } from "../types";

/** A solver only needs the static field shape — player view lives elsewhere. */
export type Board = Pick<Minefield, "width" | "height" | "mineCount" | "cells">;

export type SolverId =
  | "single-point"
  | "single-point-backtracking"
  | "constraint-propagation"
  | "linear-algebra"
  | "backtracking"
  | "sat"
  | "probabilistic";

/** What a solver can do — the future comparison view sorts/filters on these. */
export interface SolverCapabilities {
  /** Finds every forced move a perfect logician could (no false "stuck"). */
  complete: boolean;
  /** Can certify a position is solvable with no guess. */
  provesNoGuess: boolean;
  /** Emits a per-cell mine probability. */
  givesProbabilities: boolean;
  /** Recommends a cell to click when logic runs out. */
  suggestsGuess: boolean;
}

export type SolveStatus =
  | "solved" // every cell determined — board cleared by logic alone
  | "stuck" // progress made, but a guess is now required
  | "contradiction"; // the position is logically impossible (shouldn't happen on a real field)

/** One move the solver decided to make, in order — a *click* on a cell it proved
 *  safe (which cascades open a region if that cell is a 0, exactly like a human
 *  click) or a *flag* on a cell it proved is a mine. Replaying these reproduces
 *  the solve the way a person would actually play it, deduction by deduction. */
export interface SolverAction {
  type: "reveal" | "flag";
  cell: number;
}

/** A normalized result every solver returns, so they're directly comparable. */
export interface SolverReport {
  solverId: SolverId;
  status: SolveStatus;
  /** Cells proven safe (revealed by, or deducible from, the solver). */
  safe: number[];
  /** Cells proven to be mines. */
  mines: number[];
  /** Unknown cells the solver could not resolve — the would-be guess points. */
  undecided: number[];
  revealedCount: number;
  identifiedCount: number;
  total: number;
  /** Per-cell mine probability in [0,1], when the solver computes it. */
  probabilities: Map<number, number> | null;
  /** Lowest-risk cell to click when stuck, when the solver suggests one. */
  bestGuess: number | null;
  /** The solve as an ordered move list — replay it to watch the engine play like
   *  a person (empty unless action recording was enabled for the run). */
  actions: SolverAction[];
  /** Named technique → how many rounds it fired. Keys are solver-specific. */
  techniques: Record<string, number>;
  /** Deduction rounds run — a rough "effort" axis for comparison. */
  steps: number;
  /** Wall-clock spent, ms. */
  ms: number;
}

export interface SolveOptions {
  /** Skip anything not needed to decide solved/stuck (probabilities, guesses). */
  quick?: boolean;
  /** Largest border component / endgame pool to brute-force. */
  enumLimit?: number;
  /** Backtracking node ceiling, a blow-up guard. */
  nodeCap?: number;
}

export interface Solver {
  id: SolverId;
  name: string;
  /** One-liner for the comparison card. */
  tagline: string;
  description: string;
  capabilities: SolverCapabilities;
  solve(board: Board, origin: number, opts?: SolveOptions): SolverReport;
}

/** Non-solver reference entry: the production field-generation method. */
export interface SystemDescriptor {
  id: string;
  name: string;
  tagline: string;
  description: string;
}
