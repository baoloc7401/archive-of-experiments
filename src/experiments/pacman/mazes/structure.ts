// The "structure" is the part of every 28x31 layout that must stay fixed for the
// game to work: the outer border, the wrap tunnel row, the ghost house (box,
// gate and the corridor ghosts emerge into) and Pac-Man's spawn tile. The editor
// and the generator may only touch the *other* tiles; locked tiles are always
// copied verbatim from the classic layout, so the house, gate, tunnel and spawns
// can never be broken.

import {
  COLS,
  MAZE,
  PAC_START,
  ROWS,
  SPECIAL_PLACEMENT,
  TUNNEL_ROW,
  WORMHOLE_PAIRS,
} from "../constants";
import { SPECIAL_CHAR } from "../pellets/registry";

export type MazeGrid = string[];

/**
 * Legal characters: wall, dot, energizer, gate, open path/tunnel, plus the
 * placeable special-content chars (decoy/freeze/speed/trap, wormhole). The bonus
 * fruit stays a fixed central spawner (a toggle), so it has no grid char.
 */
export const MAZE_CHARS = new Set(["#", ".", "o", "-", " ", "D", "F", "S", "T", "W"]);

/** Content chars that sit on a path tile (everything but wall/gate/empty/dot). */
const CONTENT_CHARS = new Set(["o", "D", "F", "S", "T", "W"]);

/** Tiles that cannot be edited or generated - always taken from the classic layout. */
export function isLocked(col: number, row: number): boolean {
  if (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1) return true; // border
  if (row === TUNNEL_ROW) return true; // wrap tunnel row
  if (row >= 11 && row <= 19 && col >= 9 && col <= 18) return true; // ghost house + gate + emergence
  if (col === PAC_START.x && row === PAC_START.y) return true; // Pac-Man spawn
  return false;
}

/**
 * Bake the classic special placements (decoy/freeze/speed/trap, fruit spawn,
 * wormhole pair) into a grid as content chars, where the target tile allows it.
 * Existing special content is cleared first so it is a clean "classic" preset.
 */
export function applyClassicContent(grid: MazeGrid): MazeGrid {
  const rows = stripContent(grid).map((r) => r.split(""));
  // Place a content char only on an unlocked dot tile.
  const place = (col: number, row: number, ch: string) => {
    if (isLocked(col, row)) return;
    if (rows[row]?.[col] === ".") rows[row][col] = ch;
  };
  for (const [kind, tiles] of Object.entries(SPECIAL_PLACEMENT)) {
    for (const t of tiles ?? []) place(t.col, t.row, SPECIAL_CHAR[kind as keyof typeof SPECIAL_CHAR]);
  }
  for (const [a, b] of WORMHOLE_PAIRS) {
    place(a.col, a.row, "W");
    place(b.col, b.row, "W");
  }
  return rows.map((r) => r.join(""));
}

/** The classic layout (with its special content baked in), as a mutable copy. */
export function classicGrid(): MazeGrid {
  return applyClassicContent(MAZE.map((r) => r));
}

/** Strip all special content back to plain dots (energizers kept as dots too? no - kept). */
export function stripContent(grid: MazeGrid): MazeGrid {
  return grid.map((line, r) => {
    let out = "";
    for (let c = 0; c < COLS; c++) {
      const ch = line[c] ?? " ";
      out += !isLocked(c, r) && CONTENT_CHARS.has(ch) && ch !== "o" ? "." : ch;
    }
    return out;
  });
}

/** Force every locked tile to its canonical character (after an edit or a generation). */
export function applyStructure(grid: MazeGrid): MazeGrid {
  return grid.map((line, r) => {
    let out = "";
    for (let c = 0; c < COLS; c++) out += isLocked(c, r) ? MAZE[r][c] : line[c] ?? " ";
    return out;
  });
}

/**
 * A fresh editable canvas: locked structure intact, every other tile an open dot,
 * with four corner energizers so the blank board is immediately valid to play.
 */
export function blankGrid(): MazeGrid {
  const rows: string[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const line: string[] = [];
    for (let c = 0; c < COLS; c++) line.push(isLocked(c, r) ? MAZE[r][c] : ".");
    rows.push(line);
  }
  for (const [c, r] of [
    [1, 3],
    [COLS - 2, 3],
    [1, ROWS - 6],
    [COLS - 2, ROWS - 6],
  ]) {
    if (!isLocked(c, r)) rows[r][c] = "o";
  }
  return rows.map((line) => line.join(""));
}

/** Replace the character at (col,row) on a copy of the grid, ignoring locked tiles. */
export function setCell(grid: MazeGrid, col: number, row: number, ch: string): MazeGrid {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return grid;
  if (isLocked(col, row)) return grid;
  if (grid[row][col] === ch) return grid;
  const next = grid.slice();
  next[row] = grid[row].slice(0, col) + ch + grid[row].slice(col + 1);
  return next;
}
