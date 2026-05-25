// Dijkstra's Algorithm — priority queue ordered by cumulative path cost g(n).
// Weighted: respects terrain traversal costs (grass ×2, sand ×3, water ×5, mountain ×10).
// On uniform-cost grids this is equivalent to BFS.
// Guarantee: always finds the minimum-cost path.
import type { GridConfig } from '../types';
import type { AlgoGen } from './types';
import { DIRS, key, parseKey, inBounds, reconstructPath, cellWeight } from './utils';
import { MinHeap } from './heap';

export function* dijkstra(grid: GridConfig): AlgoGen {
  const { rows, cols, cells, start, end } = grid;
  const sk = key(...start);
  const ek = key(...end);

  const dist: Record<string, number> = { [sk]: 0 };
  const parent: Record<string, string | null> = { [sk]: null };
  const visited = new Set<string>();
  const frontier = new Set<string>([sk]);

  type Node = { k: string; g: number };
  const pq = new MinHeap<Node>((a, b) => a.g - b.g);
  pq.push({ k: sk, g: 0 });
  let steps = 0;

  while (pq.size > 0) {
    const { k: cur, g: cost } = pq.pop()!;
    if (visited.has(cur)) continue; // stale entry in heap
    frontier.delete(cur);
    visited.add(cur);
    steps++;

    if (cur === ek) {
      const path = reconstructPath(parent, ek);
      yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path, status: 'found', steps, pathCost: cost };
      return;
    }

    const [cr, cc] = parseKey(cur);
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc;
      if (!inBounds(nr, nc, rows, cols)) continue;
      if (cells[nr][nc] === 'wall') continue;
      const nk = key(nr, nc);
      if (visited.has(nk)) continue;
      const newCost = cost + cellWeight(cells[nr][nc], grid.terrainWeights);
      if (!(nk in dist) || newCost < dist[nk]) {
        dist[nk] = newCost;
        parent[nk] = cur;
        frontier.add(nk);
        pq.push({ k: nk, g: newCost });
      }
    }

    yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path: null, status: 'running', steps, pathCost: 0 };
  }

  yield { visited: new Set(visited), frontier: new Set(frontier), current: null, path: null, status: 'no-path', steps, pathCost: 0 };
}
