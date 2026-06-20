import type { Direction, GhostId, Tile } from "./types";

// ---------------------------------------------------------------------------
// Maze
// ---------------------------------------------------------------------------
// Classic 28x31 layout. Legend: '#' wall, '.' pellet, 'o' energizer,
// '-' ghost-house gate (passable for ghosts only), ' ' open path / house
// interior / tunnel. Validated for width, energizer count and full
// reachability (flood fill with tunnel wrap) before being committed.

export const MAZE: readonly string[] = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "######.#####.##.#####.######",
  "######.##..........##.######",
  "######.## ###--### ##.######",
  "######.## #      # ##.######",
  "       ## #      # ##       ",
  "######.## #      # ##.######",
  "######.## ######## ##.######",
  "######.##          ##.######",
  "######.## ######## ##.######",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......  .......##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

export const COLS = 28;
export const ROWS = 31;

/** Row carrying the wrap-around tunnel (open to both edges). */
export const TUNNEL_ROW = 14;

// ---------------------------------------------------------------------------
// Spawns & house geometry (col, row)
// ---------------------------------------------------------------------------

/** Where eyes re-enter and ghosts emerge - the tile just above the gate. */
export const GATE_EXIT: Tile = { col: 13, row: 11 };
/** Gate column ghosts travel up/down through. */
export const GATE_COL = 13;
export const HOUSE_ROW = 14;

export const PAC_START = { x: 13, y: 23 };

export const GHOST_START: Record<GhostId, { x: number; y: number; dir: Direction }> = {
  // Blinky waits on the corridor just outside the gate, already active.
  blinky: { x: 13, y: 11, dir: "left" },
  pinky: { x: 13, y: 14, dir: "down" },
  inky: { x: 11, y: 14, dir: "up" },
  clyde: { x: 16, y: 14, dir: "up" },
  warden: { x: 14, y: 14, dir: "down" },
};

/** Home tile inside the house each ghost bounces around / returns to. */
export const GHOST_HOME: Record<GhostId, Tile> = {
  blinky: { col: 13, row: 14 },
  pinky: { col: 13, row: 14 },
  inky: { col: 11, row: 14 },
  clyde: { col: 16, row: 14 },
  warden: { col: 14, row: 14 },
};

/** Fixed off-map scatter targets - each ghost's "favourite corner". */
export const SCATTER_TARGET: Record<GhostId, Tile> = {
  blinky: { col: 25, row: -2 }, // top-right
  pinky: { col: 2, row: -2 }, // top-left
  inky: { col: 27, row: ROWS + 1 }, // bottom-right
  clyde: { col: 0, row: ROWS + 1 }, // bottom-left
  warden: { col: 13, row: ROWS + 1 }, // bottom-centre (fallback only)
};

// Pellet count released from the pen before each ghost may leave (classic
// per-life dot counters). Blinky is always out from the start.
export const RELEASE_DOTS: Record<GhostId, number> = {
  blinky: 0,
  pinky: 0,
  warden: 10,
  inky: 30,
  clyde: 60,
};

/** Order ghosts leave the pen (blinky starts active). */
export const RELEASE_ORDER: GhostId[] = ["pinky", "warden", "inky", "clyde"];

/** Force the next penned ghost out if this many seconds pass with no release. */
export const FORCE_RELEASE_SECONDS = 4;

// ---------------------------------------------------------------------------
// AI tuning
// ---------------------------------------------------------------------------

/** Direction tie-break preference when distances are equal: up > left > down > right. */
export const TIE_ORDER: Direction[] = ["up", "left", "down", "right"];

export const DIR_VEC: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/** Clyde flips to scatter when within this many tiles (squared for compares). */
export const CLYDE_RADIUS = 8;

/** Warden: if Pac-Man is this close, abandon guarding and go for the kill. */
export const WARDEN_OPPORTUNISM = 5;
/** Warden: guard an energizer while Pac-Man is within this many tiles of it. */
export const WARDEN_GUARD_RADIUS = 8;

// --- Coordinated ghost mode (opt-in) --------------------------------------
/** How far ahead/to the side of Pac-Man the surround stations sit (tiles). */
export const COORD_LOOKAHEAD = 5;
/** Max ring radius searched when snapping an off-wall station to a free tile. */
export const COORD_RING = 6;

// --- AI Pac-Man (driver strategies) ---------------------------------------
/** Tiles over which ghost danger fades from 1 (on the ghost) to 0. */
export const DANGER_RADIUS = 6;
/** Per-tile danger penalty scale added to step cost in the danger-aware A*. */
export const DANGER_WEIGHT = 6;
/** Flee when the nearest lethal ghost is within this many tiles. */
export const PANIC_DIST = 3;
/** Safe-greedy refuses to route through tiles this close to a threat. */
export const SAFE_MIN_DIST = 3;
/** Step-cost penalty for entering a trap tile, so planners route around them. */
export const TRAP_AVOID_COST = 50;
/** When cornered, divert to an energizer instead of fleeing if one is this close. */
export const ENERGIZER_LURE_DIST = 8;
/** Look-ahead search: plies deep, and max moves explored at a branch tile. */
export const SEARCH_DEPTH = 12;
export const SEARCH_BRANCH = 4;
/** Look-ahead leaf-evaluation weights. */
export const AI_EVAL = {
  pellet: 14,
  pelletDist: 1,
  alive: 240,
  capture: 100000,
  ghostNear: 9,
  ghostNearCap: 6,
  trap: 120,
} as const;
/** Monte-Carlo rollout driver: playouts per move, plies per playout, sample paths drawn. */
export const MC_ROLLOUTS = 24;
export const MC_DEPTH = 20;
export const MC_FAN = 10;
/** Monte-Carlo terminal-state weights. */
export const MC_EVAL = {
  pellet: 12,
  survive: 80,
  death: 500,
} as const;
/** Overlay colours for the AI driver. */
export const AI_PATH_COLOR = "#ffe24a";
export const AI_DANGER_COLOR = "#ff4d57";

/**
 * The four "no-up-turn" tiles: ghosts in scatter/chase may not choose to turn
 * upward here (an original arcade restriction). Keyed "col,row".
 */
export const NO_UP_TILES: ReadonlySet<string> = new Set([
  "12,11",
  "15,11",
  "12,23",
  "15,23",
]);

// ---------------------------------------------------------------------------
// Speeds (tiles per second) - slowed from the arcade for legibility
// ---------------------------------------------------------------------------

export const SPEED = {
  pac: 5.2,
  ghost: 4.8,
  frightened: 3.0,
  tunnel: 2.6,
  eaten: 10.0,
} as const;

// ---------------------------------------------------------------------------
// Mode schedule (level 1, seconds). Final chase runs indefinitely.
// ---------------------------------------------------------------------------

export interface Phase {
  mode: "scatter" | "chase";
  seconds: number;
}

export const SCHEDULE: Phase[] = [
  { mode: "scatter", seconds: 7 },
  { mode: "chase", seconds: 20 },
  { mode: "scatter", seconds: 7 },
  { mode: "chase", seconds: 20 },
  { mode: "scatter", seconds: 5 },
  { mode: "chase", seconds: 20 },
  { mode: "scatter", seconds: 5 },
  { mode: "chase", seconds: Infinity },
];

export const FRIGHT_SECONDS = 6;

/** Length of the Pac-Man death animation before the board respawns (seconds). */
export const DEATH_DURATION = .3;

// ---------------------------------------------------------------------------
// Scoring & lives
// ---------------------------------------------------------------------------

export const PELLET_POINTS = 10;
export const ENERGIZER_POINTS = 50;
/** Eating frightened ghosts: 200, 400, 800, 1600 within one energizer. */
export const GHOST_POINTS = [200, 400, 800, 1600];
export const START_LIVES = 3;
/** One bonus life is awarded the first time the score reaches this (arcade 1UP). */
export const EXTRA_LIFE_SCORE = 10000;
/** Frightened time at/under which a "running out" warning blip fires (once). */
export const FRIGHT_WARN_SECONDS = 2;

/** How long a floating "+N"/"-N" score popup rises and fades (seconds). */
export const POPUP_DURATION = 0.9;

// --- Board content (special pellets) --------------------------------------
/** Effect durations (seconds) and tuning. */
export const DECOY_SECONDS = 6;
export const FREEZE_SECONDS = 4;
export const SPEED_SECONDS = 6;
export const SPEED_BOOST = 1.6;
export const STUN_SECONDS = 0.6;
export const TRAP_PENALTY = 100;
export const FRUIT_INTERVAL = 12; // seconds between fruit spawns (when none present)
export const FRUIT_TTL = 8; // seconds a fruit stays before vanishing
export const FRUIT_POINTS = 200;
export const FRUIT_TILE: Tile = { col: 13, row: 17 };
export const FRUIT_COLOR = "#ff5d6c";
export const WORMHOLE_COLOR = "#b06bff";

/**
 * Hand-placed special pellets, applied only where the base maze cell is a dot.
 * Energizers come from the maze 'o' cells; fruit and teleport are not in the
 * board map (spawner + portal feature).
 */
export const SPECIAL_PLACEMENT: Partial<Record<"decoy" | "freeze" | "speed" | "trap", Tile[]>> = {
  decoy: [
    { col: 6, row: 8 },
    { col: 21, row: 8 },
  ],
  freeze: [
    { col: 6, row: 11 },
    { col: 21, row: 11 },
  ],
  speed: [
    { col: 3, row: 5 },
    { col: 24, row: 5 },
  ],
  trap: [
    { col: 9, row: 26 },
    { col: 18, row: 26 },
    { col: 13, row: 5 },
    { col: 14, row: 5 },
  ],
};

/** Wormhole endpoint pairs (each on a dot tile); stepping one emerges at the other. */
export const WORMHOLE_PAIRS: [Tile, Tile][] = [
  [
    { col: 1, row: 5 },
    { col: 26, row: 29 },
  ],
];

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export const TILE_PX = 20;

export const GHOST_COLOR: Record<GhostId, string> = {
  blinky: "#ff4d57",
  pinky: "#ff9ed6",
  inky: "#56d8e0",
  clyde: "#ffb852",
  warden: "#76e36a",
};

/** How often (ms) the sim pushes a telemetry snapshot up to React. */
export const SNAPSHOT_INTERVAL = 120;
/** Fixed simulation timestep (seconds) for deterministic stepping. */
export const FIXED_DT = 1 / 60;
