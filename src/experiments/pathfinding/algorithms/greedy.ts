// Greedy Best-First Search — priority queue ordered purely by h(n) = Manhattan distance.
// Ignores the actual path cost g(n) entirely; always chases the cell that
// LOOKS closest to the goal. Very fast but not optimal — can be tricked by
// obstacles into a longer path or even an inefficient winding one.
import type { GridConfig } from '../types';
import type { AlgoGen } from './types';
import { DIRS, key, parseKey, inBounds, reconstructPath, cellWeight, manhattan } from './utils';
import { MinHeap } from './heap';

export function* greedy(grid: GridConfig): AlgoGen {
  const { rows, cols, cells, start, end } = grid;
  const sk = key(...start);
  const ek = key(...end);

  const parent: Record<string, string | null> = { [sk]: null };
  // Track actual cost for reporting only (not used for priority)
  const gCost: Record<string, number> = { [sk]: 0 };
  const visited = new Set<string>();
  const frontier = new Set<string>([sk]);

  const h = (r: number, c: number) => manhattan(r, c, end[0], end[1]);

  type Node = { k: string; h: number };
  const pq = new MinHeap<Node>((a, b) => a.h - b.h);
  pq.push({ k: sk, h: h(start[0], start[1]) });
  let steps = 0;

  while (pq.size > 0) {
    const { k: cur } = pq.pop()!;
    if (visited.has(cur)) continue;
    frontier.delete(cur);
    visited.add(cur);
    steps++;

    if (cur === ek) {
      const path = reconstructPath(parent, ek);
      yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path, status: 'found', steps, pathCost: gCost[cur] ?? 0 };
      return;
    }

    const [cr, cc] = parseKey(cur);
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc;
      if (!inBounds(nr, nc, rows, cols)) continue;
      if (cells[nr][nc] === 'wall') continue;
      const nk = key(nr, nc);
      if (visited.has(nk) || nk in parent) continue;
      parent[nk] = cur;
      gCost[nk] = (gCost[cur] ?? 0) + cellWeight(cells[nr][nc]);
      frontier.add(nk);
      pq.push({ k: nk, h: h(nr, nc) });
    }

    yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path: null, status: 'running', steps, pathCost: 0 };
  }

  yield { visited: new Set(visited), frontier: new Set(frontier), current: null, path: null, status: 'no-path', steps, pathCost: 0 };
}
