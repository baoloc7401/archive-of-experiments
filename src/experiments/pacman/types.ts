// Domain types for the Pac-Man ghost-AI visualizer. The engine is framework
// free (no React imports anywhere in this folder's *.ts logic files).

import type { PacController, PacPlan } from "./pacai/types";
import type { PelletKind, SpecialKind } from "./pellets/registry";

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

/**
 * Role a ghost is assigned in coordinated mode (opt-in). The ghosts share a
 * blackboard and split the work of surrounding Pac-Man instead of each chasing
 * independently: a `chaser` presses his tile, an `ambusher` cuts off the front,
 * `cutter`s take the flanks, a `lurker` holds back as backup.
 */
export type GhostRole = "chaser" | "ambusher" | "cutter" | "lurker";

/** One blackboard entry: the role a ghost was assigned and the tile it serves. */
export interface CoordAssignment {
  role: GhostRole;
  target: Tile;
}

/** A floating "+N"/"-N" score popup spawned at a tile when the score changes. */
export interface ScorePopup {
  col: number;
  row: number;
  amount: number;
  /** Seconds elapsed since it spawned (drives the rise + fade). */
  time: number;
  /** Overrides the numeric text (e.g. "1UP" for the bonus-life popup). */
  label?: string;
}

/**
 * Transient sound-cue tag emitted by the engine. The framework-free sim only
 * pushes these strings; the React/canvas view drains them and plays the audio.
 */
export type SfxCue =
  | "chomp"
  | "decoy"
  | "freeze"
  | "speed"
  | "energizer"
  | "eatghost"
  | "fruit"
  | "fruitspawn"
  | "frightwarn"
  | "extralife"
  | "trap"
  | "death"
  | "win";

export interface Actor {
  /** Continuous position in tile units; a tile centre sits on integers. */
  x: number;
  y: number;
  dir: Direction;
  /** Last centre tile processed for wormhole entry-detection (prevents loops). */
  atTile?: number;
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
  /** Coordinated mode: the role this ghost was assigned this frame, else undefined. */
  role?: GhostRole;
}

export type GameStatus = "ready" | "playing" | "dying" | "won" | "lost";

export interface PacmanState {
  pac: Actor;
  /** Buffered turn the player requested but could not yet take. */
  desired: Direction;
  ghosts: Ghost[];
  /** Which ghosts are switched on; disabled ones are frozen and harmless. */
  enabled: Record<GhostId, boolean>;
  /** Placed board content, keyed "col,row". Disabled specials read as dots. */
  board: Map<string, PelletKind>;
  /** Bidirectional wormhole endpoint links, keyed "col,row" (teleport feature). */
  wormholes: Map<string, string>;
  /** Which special content types are switched on. */
  enabledPellets: Record<SpecialKind, boolean>;
  /** Transient bonus fruit and its spawn timer. */
  fruit: { tile: Tile; ttl: number } | null;
  fruitTimer: number;
  /** Goal tiles present at the start (for the HUD ratio). */
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
  /** Seconds ghosts stay frozen in place (freeze pellet). */
  freezeTime: number;
  /** Seconds Pac-Man keeps a speed boost (speed pellet). */
  speedTime: number;
  /** Seconds Pac-Man is stunned and cannot move (trap). */
  pacStunTime: number;
  /** Active phantom Pac that ghost chase-targeting aims at (decoy pellet). */
  decoy: { x: number; y: number; dir: Direction; time: number } | null;
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
  /** Coverage planner's cached pellet sweep order (tile ids); null until built. */
  coverageTour: number[] | null;
  /** Coordinated ghost mode (opt-in): ghosts share a blackboard and split roles. */
  coordinated: boolean;
  /** This tick's role assignment per ghost; null when not coordinating this tick. */
  blackboard: Map<GhostId, CoordAssignment> | null;
  /** Whether the one-time bonus life (1UP) has been awarded this game. */
  extraLifeAwarded: boolean;
  // View-feedback channels: the framework-free engine fills these; the React /
  // canvas layer drains them. They are NOT simulation state - computeSnapshot
  // ignores them and they need no serialization.
  /** Floating score popups (transient; ticked and culled each step). */
  popups: ScorePopup[];
  /** Sound cues emitted this tick; the view plays and clears them. */
  sfx: SfxCue[];
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
  /** Coordinated mode: the ghost's assigned role this frame, else null. */
  role: GhostRole | null;
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
  /** Active board-effect timers (seconds remaining; 0 = inactive) + fruit. */
  effects: {
    frightened: number;
    freeze: number;
    speed: number;
    stun: number;
    decoy: number;
  };
  fruit: boolean;
}
