// Breadth-First Search - explores level by level via a FIFO queue.
// Unweighted: treats every traversable cell as cost 1.
// Guarantee: always finds the shortest path (fewest hops).
import type { GridConfig } from '../types';
import type { AlgoGen } from './types';
import { DIRS, key, parseKey, inBounds, reconstructPath } from './utils';

export function* bfs(grid: GridConfig): AlgoGen {
  const { rows, cols, cells, start, end } = grid;
  const sk = key(...start);
  const ek = key(...end);

  const parent: Record<string, string | null> = { [sk]: null };
  const visited = new Set<string>();
  const frontier = new Set<string>([sk]);
  const queue: string[] = [sk];
  let steps = 0;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    frontier.delete(cur);
    visited.add(cur);
    steps++;

    if (cur === ek) {
      const path = reconstructPath(parent, ek);
      yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path, status: 'found', steps, pathCost: path.length - 1 };
      return;
    }

    const [cr, cc] = parseKey(cur);
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc;
      if (!inBounds(nr, nc, rows, cols)) continue;
      if (cells[nr][nc] === 'wall') continue;
      const nk = key(nr, nc);
      if (nk in parent) continue;
      parent[nk] = cur;
      frontier.add(nk);
      queue.push(nk);
    }

    yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path: null, status: 'running', steps, pathCost: 0 };
  }

  yield { visited: new Set(visited), frontier: new Set(frontier), current: null, path: null, status: 'no-path', steps, pathCost: 0 };
}
