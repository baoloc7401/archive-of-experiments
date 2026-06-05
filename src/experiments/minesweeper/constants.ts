import type { Difficulty, FieldConfig } from "./types";

export interface Preset {
  id: Exclude<Difficulty, "custom">;
  label: string;
  width: number;
  height: number;
  mines: number;
}

/** The canonical Windows-Minesweeper trio. */
export const PRESETS: Preset[] = [
  { id: "beginner", label: "beginner", width: 9, height: 9, mines: 10 },
  { id: "intermediate", label: "intermediate", width: 16, height: 16, mines: 40 },
  { id: "expert", label: "expert", width: 30, height: 16, mines: 99 },
];

export const DEFAULT_DIFFICULTY: Difficulty = "intermediate";

export const DEFAULT_CONFIG: FieldConfig = {
  width: 16,
  height: 16,
  mines: 40,
  safeRadius: 1,
  seed: 0,
};

/** Custom-mode slider bounds. */
export const MIN_DIM = 5;
export const MAX_DIM = 30;
export const MIN_MINES = 1;
/** Upper bound on mine density we'll even attempt — past this a no-guess field
 *  is effectively impossible to forge, so we clamp and say so. */
export const MAX_DENSITY = 0.28;

/** Generation budget. The whole forge is synchronous, so these cap wall time. */
export const MAX_ATTEMPTS = 600; // fresh random boards before relying on swaps
export const FRESH_BEFORE_SWAP = 12; // fresh tries before hill-climbing kicks in
export const MAX_SWAPS = 1500; // single-mine relocations while hill-climbing
export const TIME_BUDGET_MS = 1400; // hard wall for one generation
/** Largest border component (or endgame pool) we'll brute-force enumerate. */
export const ENUM_LIMIT = 22;
/** Backtracking node cap per enumeration, a blow-up guard. */
export const ENUM_NODE_CAP = 60000;
