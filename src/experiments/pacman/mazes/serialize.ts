// Compact, human-pasteable encoding of a layout: a version tag plus the 31 rows
// joined by "|" (each row is the literal 28 characters, spaces included). Decode
// is strict about dimensions and characters so a bad paste fails cleanly rather
// than corrupting the board.

import { COLS, ROWS } from "../constants";
import { MAZE_CHARS, type MazeGrid } from "./structure";

const TAG = "pm1";

export function encodeMaze(grid: MazeGrid): string {
  return `${TAG};${grid.join("|")}`;
}

export function decodeMaze(text: string): MazeGrid | null {
  const trimmed = text.trim();
  const body = trimmed.startsWith(`${TAG};`) ? trimmed.slice(TAG.length + 1) : trimmed;
  const rows = body.split("|");
  if (rows.length !== ROWS) return null;
  for (const row of rows) {
    if (row.length !== COLS) return null;
    for (const ch of row) if (!MAZE_CHARS.has(ch)) return null;
  }
  return rows;
}
