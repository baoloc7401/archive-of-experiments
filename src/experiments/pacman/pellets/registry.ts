// Registry of board content. Generalises the old dot/energizer split: every
// placed pellet is a PelletKind with points, a colour, a goal flag, and an
// optional onEat effect. Adding a kind means one entry here (+ a placement and
// i18n keys). Effects mutate only timers/flags on the state - the simulation
// loop reads them - so this file imports no engine code (no cycle).

import {
  DECOY_SECONDS,
  ENERGIZER_POINTS,
  FREEZE_SECONDS,
  FRIGHT_SECONDS,
  PELLET_POINTS,
  SPEED_SECONDS,
  STUN_SECONDS,
  TRAP_PENALTY,
} from "../constants";
import type { PacmanState } from "../types";

/** Kinds that can sit in the board map. */
export type PelletKind = "dot" | "energizer" | "decoy" | "freeze" | "speed" | "trap";

/** Toggleable kinds (board specials plus the two non-map features). */
export type SpecialKind =
  | "energizer"
  | "decoy"
  | "freeze"
  | "speed"
  | "trap"
  | "fruit"
  | "teleport";

export const SPECIAL_KINDS: SpecialKind[] = [
  "energizer",
  "decoy",
  "freeze",
  "speed",
  "trap",
  "fruit",
  "teleport",
];

/**
 * Maze-grid character for each special kind, so layouts carry their own content
 * (placed/edited/generated) rather than relying on global placement constants.
 * `D/F/S/T` are board specials; `X` marks the fruit spawn tile; `W` a wormhole
 * endpoint (consecutive pairs link). Plain '.' is a dot, 'o' an energizer.
 */
export const SPECIAL_CHAR: Record<SpecialKind, string> = {
  energizer: "o",
  decoy: "D",
  freeze: "F",
  speed: "S",
  trap: "T",
  fruit: "X",
  teleport: "W",
};

/** Grid char -> board PelletKind (only the kinds that sit in the board map). */
export const CHAR_KIND: Record<string, PelletKind> = {
  ".": "dot",
  o: "energizer",
  D: "decoy",
  F: "freeze",
  S: "speed",
  T: "trap",
};

export interface PelletDef {
  kind: PelletKind;
  points: number;
  color: string;
  /** Counts toward clearing the board (traps do not). */
  goal: boolean;
  /** Side effect applied when eaten (points are added by the caller). */
  onEat?: (state: PacmanState) => void;
}

export const PELLET_KINDS: Record<PelletKind, PelletDef> = {
  dot: { kind: "dot", points: PELLET_POINTS, color: "#9aa3b2", goal: true },
  energizer: {
    kind: "energizer",
    points: ENERGIZER_POINTS,
    color: "#ffd24a",
    goal: true,
    onEat: (s) => {
      s.frightTime = FRIGHT_SECONDS;
      s.ghostCombo = 0;
    },
  },
  decoy: {
    kind: "decoy",
    points: 20,
    color: "#56d8e0",
    goal: true,
    onEat: (s) => {
      s.decoy = { x: s.pac.x, y: s.pac.y, dir: s.pac.dir, time: DECOY_SECONDS };
    },
  },
  freeze: {
    kind: "freeze",
    points: 20,
    color: "#8fd6ff",
    goal: true,
    onEat: (s) => {
      s.freezeTime = FREEZE_SECONDS;
    },
  },
  speed: {
    kind: "speed",
    points: 20,
    color: "#76e36a",
    goal: true,
    onEat: (s) => {
      s.speedTime = SPEED_SECONDS;
    },
  },
  trap: {
    kind: "trap",
    points: 0,
    color: "#ff4d57",
    goal: false,
    onEat: (s) => {
      s.score = Math.max(0, s.score - TRAP_PENALTY);
      s.pacStunTime = STUN_SECONDS;
    },
  },
};

/** Resolve a board tile's kind, reverting disabled specials to a plain dot. */
export function effectiveKind(state: PacmanState, key: string): PelletKind | null {
  const k = state.board.get(key);
  if (!k) return null;
  if (k !== "dot" && !state.enabledPellets[k]) return "dot";
  return k;
}

export function isGoalKind(kind: PelletKind): boolean {
  return PELLET_KINDS[kind].goal;
}
