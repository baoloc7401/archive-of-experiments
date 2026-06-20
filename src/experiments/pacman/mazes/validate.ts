// Validate a 28x31 layout the same way the classic board was checked: right
// dimensions, intact structure, and every pellet reachable from Pac-Man's spawn
// through the wrap tunnel, with at least one energizer. Returns error *codes*
// (translated by the UI) plus the reachable-tile set for the editor to highlight.

import { COLS, MAZE, PAC_START, ROWS } from "../constants";
import { tileKey } from "../maze";
import { isLocked, MAZE_CHARS, type MazeGrid } from "./structure";

export type MazeErrorCode =
  | "dimensions"
  | "chars"
  | "structure"
  | "spawn_blocked"
  | "no_energizer"
  | "unreachable";

export interface MazeValidation {
  ok: boolean;
  errors: MazeErrorCode[];
  energizers: number;
  pellets: number;
  /** Keys ("col,row") reachable from the spawn - for editor highlighting. */
  reachable: Set<string>;
  /** Number of pellet/energizer tiles that the spawn cannot reach. */
  stranded: number;
}

const passable = (ch: string) => ch !== "#" && ch !== "-";

/** Flood fill of passable tiles from Pac-Man's spawn, wrapping horizontally. */
function floodFrom(grid: MazeGrid, startCol: number, startRow: number): Set<string> {
  const seen = new Set<string>();
  if (!passable(grid[startRow][startCol])) return seen;
  const stack: [number, number][] = [[startCol, startRow]];
  seen.add(tileKey(startCol, startRow));
  const step = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  while (stack.length) {
    const [c, r] = stack.pop()!;
    for (const [dc, dr] of step) {
      const nr = r + dr;
      if (nr < 0 || nr >= ROWS) continue;
      const nc = ((c + dc) % COLS + COLS) % COLS; // tunnel wrap
      const key = tileKey(nc, nr);
      if (seen.has(key) || !passable(grid[nr][nc])) continue;
      seen.add(key);
      stack.push([nc, nr]);
    }
  }
  return seen;
}

export function validateMaze(grid: MazeGrid): MazeValidation {
  const errors: MazeErrorCode[] = [];

  const dimsOk = grid.length === ROWS && grid.every((r) => r.length === COLS);
  if (!dimsOk) {
    return { ok: false, errors: ["dimensions"], energizers: 0, pellets: 0, reachable: new Set(), stranded: 0 };
  }

  let badChars = false;
  let structureBroken = false;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = grid[r][c];
      if (!MAZE_CHARS.has(ch)) badChars = true;
      if (isLocked(c, r) && ch !== MAZE[r][c]) structureBroken = true;
    }
  }
  if (badChars) errors.push("chars");
  if (structureBroken) errors.push("structure");

  const spawnOk = passable(grid[PAC_START.y][PAC_START.x]);
  if (!spawnOk) errors.push("spawn_blocked");

  const reachable = spawnOk ? floodFrom(grid, PAC_START.x, PAC_START.y) : new Set<string>();

  // Goal tiles must all be reachable. Traps ('T') and wormholes are not goals,
  // but a wormhole 'W' is also a dot, so it must be reachable too.
  const GOAL = new Set([".", "o", "D", "F", "S", "W"]);
  let energizers = 0;
  let pellets = 0;
  let stranded = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = grid[r][c];
      if (ch === "o") energizers++;
      else if (ch === ".") pellets++;
      if (GOAL.has(ch) && !reachable.has(tileKey(c, r))) stranded++;
    }
  }
  if (energizers === 0) errors.push("no_energizer");
  if (stranded > 0) errors.push("unreachable");

  return { ok: errors.length === 0, errors, energizers, pellets, reachable, stranded };
}
