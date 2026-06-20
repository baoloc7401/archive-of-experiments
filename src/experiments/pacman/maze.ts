import { COLS, MAZE, ROWS } from "./constants";
import type { Direction, Tile } from "./types";
import { DIR_VEC } from "./constants";
import { CHAR_KIND, type PelletKind } from "./pellets/registry";

export function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

// The maze is now runtime data: built-in, generated, edited or shared layouts all
// flow through a single active grid the whole engine reads. `setActiveMaze` bumps
// a version so caches keyed on the layout (the AI graph) know to rebuild.
let activeMaze: readonly string[] = MAZE;
let mazeVersion = 0;

/** Swap the layout the engine plays on. Call before resetting the game. */
export function setActiveMaze(grid: readonly string[]): void {
  activeMaze = grid;
  mazeVersion++;
}

/** The layout currently in play. */
export function getActiveMaze(): readonly string[] {
  return activeMaze;
}

/** Increments whenever the active maze changes - lets layout caches invalidate. */
export function getMazeVersion(): number {
  return mazeVersion;
}

/** Character at a cell; out-of-range rows read as wall. Columns wrap (tunnel). */
export function charAt(col: number, row: number): string {
  if (row < 0 || row >= ROWS) return "#";
  const c = ((col % COLS) + COLS) % COLS;
  return activeMaze[row][c];
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

/**
 * Build the board content directly from the active layout's characters: '.' dot,
 * 'o' energizer, D/F/S/T the board specials, and 'W' a dot that is also a
 * wormhole endpoint. Consecutive 'W' tiles link into bidirectional pairs. The
 * layout now carries its own content (placed/edited/generated), so there are no
 * separate placement constants.
 */
export function buildBoard(): { board: Map<string, PelletKind>; wormholes: Map<string, string> } {
  const board = new Map<string, PelletKind>();
  const endpoints: [number, number][] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = activeMaze[row][col];
      if (ch === "W") {
        board.set(tileKey(col, row), "dot");
        endpoints.push([col, row]);
        continue;
      }
      const kind = CHAR_KIND[ch];
      if (kind) board.set(tileKey(col, row), kind);
    }
  }
  const wormholes = new Map<string, string>();
  for (let i = 0; i + 1 < endpoints.length; i += 2) {
    const ka = tileKey(endpoints[i][0], endpoints[i][1]);
    const kb = tileKey(endpoints[i + 1][0], endpoints[i + 1][1]);
    wormholes.set(ka, kb);
    wormholes.set(kb, ka);
  }
  return { board, wormholes };
}
