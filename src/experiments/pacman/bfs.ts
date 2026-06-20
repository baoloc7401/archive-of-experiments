// True shortest-path BFS over the maze graph, used ONLY for the contrast
// overlay - "what a real planner would do" next to the ghosts' greedy local
// choice. It is never fed back into movement. Gate tiles are treated as walls
// (a ghost in the maze cannot re-enter the house); the tunnel wraps.

import { COLS, ROWS, TIE_ORDER } from "./constants";
import { isPassableGhost, neighbor, tileKey } from "./maze";
import type { Tile } from "./types";

/** Clamp an off-map target (e.g. a scatter corner) onto the board. */
function clamp(t: Tile): Tile {
  return {
    col: Math.max(0, Math.min(COLS - 1, t.col)),
    row: Math.max(0, Math.min(ROWS - 1, t.row)),
  };
}

/**
 * Shortest tile path from `start` to `target` (inclusive of both ends), or null
 * if unreachable. Neighbours are explored in the ghosts' tie-break order so the
 * drawn path matches their direction preferences where lengths are equal.
 */
export function bfsPath(start: Tile, target: Tile): Tile[] | null {
  const goal = clamp(target);
  const goalKey = tileKey(goal.col, goal.row);
  const startKey = tileKey(start.col, start.row);
  if (!isPassableGhost(start.col, start.row, false)) return null;

  const prev = new Map<string, string | null>();
  prev.set(startKey, null);
  const queue: Tile[] = [start];

  while (queue.length) {
    const cur = queue.shift() as Tile;
    const curKey = tileKey(cur.col, cur.row);
    if (curKey === goalKey) break;
    for (const d of TIE_ORDER) {
      const n = neighbor(cur.col, cur.row, d);
      if (!isPassableGhost(n.col, n.row, false)) continue;
      const k = tileKey(n.col, n.row);
      if (prev.has(k)) continue;
      prev.set(k, curKey);
      queue.push(n);
    }
  }

  if (!prev.has(goalKey)) return null;
  const path: Tile[] = [];
  let cursor: string | null = goalKey;
  while (cursor) {
    const [col, row] = cursor.split(",").map(Number);
    path.push({ col, row });
    cursor = prev.get(cursor) ?? null;
  }
  return path.reverse();
}
