import { COLS, MAZE, ROWS } from "./constants";
import type { Direction, Tile } from "./types";
import { DIR_VEC } from "./constants";

export function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** Character at a cell; out-of-range rows read as wall. Columns wrap (tunnel). */
export function charAt(col: number, row: number): string {
  if (row < 0 || row >= ROWS) return "#";
  const c = ((col % COLS) + COLS) % COLS;
  return MAZE[row][c];
}

export function isWall(col: number, row: number): boolean {
  return charAt(col, row) === "#";
}

/** Pac-Man cannot pass walls or the ghost-house gate. */
export function isPassablePac(col: number, row: number): boolean {
  const ch = charAt(col, row);
  return ch !== "#" && ch !== "-";
}

/**
 * Passability for a ghost. Active ghosts treat the gate as solid (so they never
 * wander back into the house); ghosts that are leaving or returning as eyes are
 * allowed through the gate and into the house interior.
 */
export function isPassableGhost(col: number, row: number, throughGate: boolean): boolean {
  const ch = charAt(col, row);
  if (ch === "#") return false;
  if (ch === "-") return throughGate;
  return true;
}

/** Neighbouring tile in a direction, with horizontal tunnel wrap. */
export function neighbor(col: number, row: number, dir: Direction): Tile {
  const { dx, dy } = DIR_VEC[dir];
  let nc = col + dx;
  const nr = row + dy;
  if (nc < 0) nc += COLS;
  else if (nc >= COLS) nc -= COLS;
  return { col: nc, row: nr };
}

/** Straight-line (Euclidean) distance squared in tiles - the ghost metric. */
export function tileDistanceSq(a: Tile, b: Tile): number {
  const dc = a.col - b.col;
  const dr = a.row - b.row;
  return dc * dc + dr * dr;
}

/** Parse the maze into the live pellet and energizer sets. */
export function makePelletSets(): { pellets: Set<string>; energizers: Set<string> } {
  const pellets = new Set<string>();
  const energizers = new Set<string>();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = MAZE[row][col];
      if (ch === ".") pellets.add(tileKey(col, row));
      else if (ch === "o") energizers.add(tileKey(col, row));
    }
  }
  return { pellets, energizers };
}
