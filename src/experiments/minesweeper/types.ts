/** Difficulty presets + an escape hatch for hand-tuned fields. */
export type Difficulty = "beginner" | "intermediate" | "expert" | "custom";

/** Everything the generator needs to forge a field. */
export interface FieldConfig {
  width: number;
  height: number;
  mines: number;
  /** Chebyshev radius around the first click guaranteed mine-free.
   *  0 → only the clicked cell is safe; 1 → the cell *and* its 8 neighbours,
   *  which forces the click to open a zero-region (the satisfying first move). */
  safeRadius: number;
  /** 0 → reseed from the clock; anything else → reproducible field. */
  seed: number;
}

/** A cell's ground truth — fixed once the field is forged. */
export interface Cell {
  mine: boolean;
  /** Mines in the 8-neighbourhood, 0..8. Meaningless when `mine` is true. */
  adjacent: number;
}

/** The forged field: ground truth only. Player state lives elsewhere. */
export interface Minefield {
  width: number;
  height: number;
  mineCount: number;
  /** Row-major, length `width * height`. */
  cells: Cell[];
  mineIndices: number[];
  /** The first-click cell every guarantee is built around. */
  safeOrigin: number;
}

/** The logical techniques the generator's no-guess check leaned on, hardest last.
 *  `count`     — a number equals its hidden/flag neighbours (the trivial rules).
 *  `subset`    — one constraint's cells are a subset of another's (1-2-1 etc.).
 *  `enumerate` — brute-force every consistent arrangement of a border component.
 *  (Mirrors the keys of the solvers' shared `fullPropagate` technique counter.) */
export type Technique = "count" | "subset" | "enumerate";

export type RatingTier = "trivial" | "easy" | "medium" | "hard" | "brutal";

/** Diagnostics surfaced after a generation run. */
export interface GenStats {
  /** Fresh random boards tried. */
  attempts: number;
  /** Single-mine relocations attempted while hill-climbing. */
  swaps: number;
  /** True when the field is fully solvable from the first click with no guess. */
  solved: boolean;
  techniques: Record<Technique, number>;
  /** Hardest technique the solution path required. */
  hardest: Technique;
  /** 0..100 logic-difficulty score. */
  rating: number;
  tier: RatingTier;
  /** Bechtel's 3BV — minimum left-clicks to clear with perfect play. */
  threeBV: number;
  density: number;
  ms: number;
  seed: number;
  /** Hidden cells with no logical resolution, when `solved` is false. */
  undecided: number[];
}

/** Player-facing per-cell state, layered over the ground-truth field. */
export type CellView = "hidden" | "revealed" | "flagged";

export type GameStatus = "fresh" | "playing" | "won" | "lost";

export interface LogEntry {
  id: number;
  kind: "gen" | "play" | "win" | "loss" | "setup" | "warn";
  text: string;
}
