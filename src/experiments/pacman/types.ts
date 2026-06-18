// Domain types for the Pac-Man ghost-AI visualizer. The engine is framework
// free (no React imports anywhere in this folder's *.ts logic files).

import type { PacController, PacPlan } from "./pacai/types";

export type Direction = "up" | "down" | "left" | "right";

/** A maze cell, addressed by column (x) and row (y). */
export interface Tile {
  col: number;
  row: number;
}

// The canonical four, plus "warden" - a custom guardian (not arcade-faithful)
// that defends the energizer nearest Pac-Man. Toggle it off for the pure four.
export type GhostId = "blinky" | "pinky" | "inky" | "clyde" | "warden";

/**
 * Global behaviour mode. `scatter`/`chase` alternate on the schedule timer;
 * `frightened` is entered by eating an energizer; `eaten` is an individual
 * ghost reduced to eyes returning home.
 */
export type GhostMode = "scatter" | "chase" | "frightened" | "eaten";

/** Where a ghost lives in its pen lifecycle. */
export type PenState = "house" | "leaving" | "active" | "entering";

export interface Actor {
  /** Continuous position in tile units; a tile centre sits on integers. */
  x: number;
  y: number;
  dir: Direction;
}

export interface Ghost extends Actor {
  id: GhostId;
  pen: PenState;
  /** Current target tile the greedy chooser steers toward this frame. */
  target: Tile;
  /** Direction picked at the most recent decision tile. */
  chosen: Direction;
  /** Set when this ghost's last up-target came from the original overflow bug. */
  upOverflow: boolean;
  /** Clyde only: true while within 8 tiles and retreating to his corner. */
  retreating: boolean;
  /** Warden only: true while hunting Pac-Man instead of guarding an energizer. */
  hunting: boolean;
}

export type GameStatus = "ready" | "playing" | "dying" | "won" | "lost";

export interface PacmanState {
  pac: Actor;
  /** Buffered turn the player requested but could not yet take. */
  desired: Direction;
  ghosts: Ghost[];
  /** Which ghosts are switched on; disabled ones are frozen and harmless. */
  enabled: Record<GhostId, boolean>;
  /** Remaining pellets, keyed "col,row". Energizers tracked separately. */
  pellets: Set<string>;
  energizers: Set<string>;
  totalPellets: number;
  score: number;
  lives: number;
  status: GameStatus;
  /** Seconds elapsed in the current death animation (status === "dying"). */
  deathTimer: number;
  /** Index into the scatter/chase schedule. */
  phaseIndex: number;
  /** Seconds elapsed in the current scatter/chase phase. */
  phaseTime: number;
  /** Seconds of frightened time remaining (0 = not frightened). */
  frightTime: number;
  /** Combo multiplier while eating frightened ghosts in one energizer. */
  ghostCombo: number;
  /** Pellets eaten so far this life - drives ghost release from the pen. */
  dotsEaten: number;
  /** Seconds since a ghost was last released - the pen "force out" timer. */
  releaseTimer: number;
  mode: GhostMode;
  /** Who is driving Pac-Man: the human, or one of the AI strategies. */
  pacController: PacController;
  /** The active AI's latest decision (for the overlay); null when human-driven. */
  pacPlan: PacPlan | null;
}

/** Per-ghost readout pushed to the sidebar each telemetry tick. */
export interface GhostSnapshot {
  id: GhostId;
  mode: GhostMode;
  pen: PenState;
  target: Tile;
  chosen: Direction;
  distance: number;
  upOverflow: boolean;
  retreating: boolean;
  hunting: boolean;
}

export interface Snapshot {
  status: GameStatus;
  score: number;
  lives: number;
  pelletsLeft: number;
  totalPellets: number;
  mode: GhostMode;
  frightened: boolean;
  ghosts: GhostSnapshot[];
  /** Pac-Man driver summary for the sidebar. */
  pac: {
    controller: PacController;
    /** i18n suffix under `experiments.pacman.ai_note_*`, or "human". */
    noteKey: string;
    target: Tile | null;
  };
}
