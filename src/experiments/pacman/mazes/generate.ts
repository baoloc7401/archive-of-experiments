// Symmetric tile maze generator. The left half is generated and mirrored to the
// right, with the classic ghost house, gate, tunnel and spawns kept fixed. Walls
// are grown as a spanning *forest* over an even-coordinate pillar lattice: a
// union-find refuses any wall edge that would close a loop of walls, so the
// corridors (the complement of the walls) always stay fully connected - while
// stopping short of a full tree leaves the open loops a Pac-Man board needs.
// Dots fill every corridor; four energizers anchor the corners. A final validate
// guards the rare case where a wall meets the locked structure to close a loop;
// if so we reseed, falling back to the classic layout only as a last resort.

import { COLS, MAZE, ROWS } from "../constants";
import { applyStructure, classicGrid, isLocked, type MazeGrid } from "./structure";
import { validateMaze } from "./validate";

/** Fraction of candidate wall edges accepted - lower = more open, more loops. */
const WALL_DENSITY = 0.72;

/** Deterministic PRNG (mulberry32) so a seed reproduces a layout. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

interface Edge {
  a: number; // pillar index
  b: number; // pillar index
  wc: number; // between-tile col
  wr: number; // between-tile row
}

function tryGenerate(rng: () => number): MazeGrid {
  // Editable tiles start as open dots; locked tiles take their classic char.
  const cells: string[][] = MAZE.map((row, r) =>
    row.split("").map((ch, c) => (isLocked(c, r) ? ch : ".")),
  );

  // Pillars: even/even editable tiles in the left half (cols <= 13).
  const pillars: [number, number][] = [];
  const idx = new Map<string, number>();
  for (let r = 2; r < ROWS - 1; r += 2) {
    for (let c = 2; c <= 13; c += 2) {
      if (isLocked(c, r)) continue;
      idx.set(`${c},${r}`, pillars.length);
      pillars.push([c, r]);
    }
  }

  // Every pillar starts as a standalone wall block.
  for (const [c, r] of pillars) cells[r][c] = "#";

  // Candidate wall edges join adjacent pillars through the tile between them.
  const edges: Edge[] = [];
  for (let i = 0; i < pillars.length; i++) {
    const [c, r] = pillars[i];
    for (const [nc, nr, wc, wr] of [
      [c + 2, r, c + 1, r],
      [c, r + 2, c, r + 1],
    ]) {
      const j = idx.get(`${nc},${nr}`);
      if (j === undefined || isLocked(wc, wr)) continue;
      edges.push({ a: i, b: j, wc, wr });
    }
  }
  shuffle(edges, rng);

  // Union-find over pillars: accept an edge (wall the between-tile) only if it
  // does not connect two pillars already joined by walls - i.e. no wall loop.
  const parent = new Int32Array(pillars.length).map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (const e of edges) {
    if (rng() > WALL_DENSITY) continue;
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra === rb) continue; // would close a wall loop -> would strand corridors
    parent[ra] = rb;
    cells[e.wr][e.wc] = "#";
  }

  // Mirror the whole left half onto the right; applyStructure then restores any
  // locked tiles, so the result is symmetric wherever the classic structure is.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= 13; c++) cells[r][COLS - 1 - c] = cells[r][c];
  }

  let grid = applyStructure(cells.map((row) => row.join("")));
  grid = placeEnergizers(grid);
  return grid;
}

/** Convert the dot nearest each corner into an energizer (kept symmetric). */
function placeEnergizers(grid: MazeGrid): MazeGrid {
  const rows = grid.map((r) => r.split(""));
  const anchors: [number, number][] = [
    [1, 3],
    [1, ROWS - 6],
  ];
  for (const [ac, ar] of anchors) {
    const left = nearestDot(rows, ac, ar);
    if (left) {
      rows[left[1]][left[0]] = "o";
      const m = COLS - 1 - left[0];
      if (!isLocked(m, left[1]) && rows[left[1]][m] === ".") rows[left[1]][m] = "o";
    }
  }
  return rows.map((r) => r.join(""));
}

function nearestDot(rows: string[][], c0: number, r0: number): [number, number] | null {
  for (let rad = 0; rad < Math.max(COLS, ROWS); rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const c = c0 + dc;
        const r = r0 + dr;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        if (rows[r][c] === ".") return [c, r];
      }
    }
  }
  return null;
}

/** Generate a valid symmetric maze; reseed on the rare invalid layout. */
export function generateMaze(seed: number = (Math.random() * 1e9) | 0): MazeGrid {
  for (let attempt = 0; attempt < 24; attempt++) {
    const grid = tryGenerate(mulberry32(seed + attempt * 7919));
    if (validateMaze(grid).ok) return grid;
  }
  return classicGrid();
}
