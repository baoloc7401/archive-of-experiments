import type { Direction, PacmanState, Tile } from "../types";

export type PacStrategyId = "greedy" | "safe" | "astar" | "search";
export type PacController = "human" | PacStrategyId;

export interface PacCandidate {
  dir: Direction;
  score: number;
}

/** A strategy's decision for one tile centre, plus everything the overlay draws. */
export interface PacPlan {
  strategy: PacStrategyId;
  dir: Direction;
  target: Tile | null;
  /** Intended route to the target (tile-by-tile), for the overlay. */
  path: Tile[];
  /** Per-tile ghost danger (length TILE_COUNT), or null when not computed. */
  danger: Float32Array | null;
  /** Search agent only: immediate moves with their backed-up scores. */
  candidates: PacCandidate[] | null;
  /** i18n suffix under `experiments.pacman.ai_note_*` explaining the choice. */
  noteKey: string;
}

export interface PacStrategy {
  id: PacStrategyId;
  choose(state: PacmanState, col: number, row: number): PacPlan;
}
