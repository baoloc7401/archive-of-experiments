// Depth-First Search - explores via a LIFO stack (last in, first out).
// Unweighted. Does NOT guarantee the shortest path - it commits deeply
// to the first branch it finds, backtracking only when stuck.
import type { GridConfig } from '../types';
import type { AlgoGen } from './types';
import { DIRS, key, parseKey, inBounds, reconstructPath } from './utils';

export function* dfs(grid: GridConfig): AlgoGen {
  const { rows, cols, cells, start, end } = grid;
  const sk = key(...start);
  const ek = key(...end);

  // parent tracks the first time a cell is discovered (first path found wins)
  const parent: Record<string, string | null> = { [sk]: null };
  const visited = new Set<string>();
  const frontier = new Set<string>([sk]);
  const stack: string[] = [sk];
  let steps = 0;

  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue; // cell reached via a different path already
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
      if (visited.has(nk)) continue;
      // Only set parent the first time we discover a node
      if (!(nk in parent)) parent[nk] = cur;
      frontier.add(nk);
      stack.push(nk);
    }

    yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path: null, status: 'running', steps, pathCost: 0 };
  }

  yield { visited: new Set(visited), frontier: new Set(frontier), current: null, path: null, status: 'no-path', steps, pathCost: 0 };
}
