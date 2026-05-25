// A* Search — priority queue ordered by f(n) = g(n) + h(n).
// g(n): actual cost from start. h(n): Manhattan distance to goal (admissible heuristic).
// Weighted: respects terrain costs. Heuristic keeps it faster than Dijkstra
// by biasing expansion toward the goal without overshooting.
// Guarantee: finds the minimum-cost path when h is admissible (never overestimates).
import type { GridConfig } from '../types';
import type { AlgoGen } from './types';
import { DIRS, key, parseKey, inBounds, reconstructPath, cellWeight, manhattan } from './utils';
import { MinHeap } from './heap';

export function* astar(grid: GridConfig): AlgoGen {
  const { rows, cols, cells, start, end } = grid;
  const sk = key(...start);
  const ek = key(...end);

  const g: Record<string, number> = { [sk]: 0 };
  const parent: Record<string, string | null> = { [sk]: null };
  const visited = new Set<string>();
  const frontier = new Set<string>([sk]);

  const h = (r: number, c: number) => manhattan(r, c, end[0], end[1]);

  type Node = { k: string; f: number };
  const pq = new MinHeap<Node>((a, b) => a.f - b.f);
  pq.push({ k: sk, f: h(start[0], start[1]) });
  let steps = 0;

  while (pq.size > 0) {
    const { k: cur } = pq.pop()!;
    if (visited.has(cur)) continue;
    frontier.delete(cur);
    visited.add(cur);
    steps++;

    if (cur === ek) {
      const path = reconstructPath(parent, ek);
      yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path, status: 'found', steps, pathCost: g[cur] };
      return;
    }

    const [cr, cc] = parseKey(cur);
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc;
      if (!inBounds(nr, nc, rows, cols)) continue;
      if (cells[nr][nc] === 'wall') continue;
      const nk = key(nr, nc);
      if (visited.has(nk)) continue;
      const tentG = g[cur] + cellWeight(cells[nr][nc]);
      if (!(nk in g) || tentG < g[nk]) {
        g[nk] = tentG;
        parent[nk] = cur;
        frontier.add(nk);
        pq.push({ k: nk, f: tentG + h(nr, nc) });
      }
    }

    yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path: null, status: 'running', steps, pathCost: 0 };
  }

  yield { visited: new Set(visited), frontier: new Set(frontier), current: null, path: null, status: 'no-path', steps, pathCost: 0 };
}
