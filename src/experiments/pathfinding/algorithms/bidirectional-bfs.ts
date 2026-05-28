// Bidirectional BFS — runs two simultaneous BFS sweeps: one forward from the
// start, one backward from the end. They alternate expanding one level each.
// When a cell touched by both sweeps is found, the path is reconstructed by
// joining the two halves. Explores ≈ b^(d/2) nodes vs b^d for plain BFS.
// Guarantee: finds the shortest path (hop count).
import type { GridConfig } from '../types';
import type { AlgoGen } from './types';
import { DIRS, key, parseKey, inBounds } from './utils';

function buildPath(
  meetKey: string,
  fParent: Record<string, string | null>,
  bParent: Record<string, string | null>,
): string[] {
  // Forward half: start → meetKey
  const fHalf: string[] = [];
  let cur: string | null = meetKey;
  while (cur !== null) { fHalf.unshift(cur); cur = fParent[cur]; }

  // Backward half: meetKey → end (skip meetKey, already in fHalf)
  const bHalf: string[] = [];
  cur = bParent[meetKey];
  while (cur !== null) { bHalf.push(cur); cur = bParent[cur]; }

  return [...fHalf, ...bHalf];
}

export function* bidirectionalBfs(grid: GridConfig): AlgoGen {
  const { rows, cols, cells, start, end } = grid;
  const sk = key(...start);
  const ek = key(...end);

  if (sk === ek) {
    yield { visited: new Set([sk]), frontier: new Set(), frontierB: new Set(), current: sk, path: [sk], status: 'found', steps: 0, pathCost: 0 };
    return;
  }

  // Forward sweep
  const fParent: Record<string, string | null> = { [sk]: null };
  const fVisited = new Set<string>();
  const fQueue: string[] = [sk];

  // Backward sweep
  const bParent: Record<string, string | null> = { [ek]: null };
  const bVisited = new Set<string>();
  const bQueue: string[] = [ek];

  const allVisited = new Set<string>();
  let steps = 0;

  function expandOne(
    queue: string[],
    myVisited: Set<string>,
    myParent: Record<string, string | null>,
    otherVisited: Set<string>,
    otherParent: Record<string, string | null>,
  ): string | null {
    if (queue.length === 0) return null;
    const cur = queue.shift()!;
    if (myVisited.has(cur)) return null;
    myVisited.add(cur);
    allVisited.add(cur);

    const [cr, cc] = parseKey(cur);
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc;
      if (!inBounds(nr, nc, rows, cols)) continue;
      if (cells[nr][nc] === 'wall') continue;
      const nk = key(nr, nc);
      if (myVisited.has(nk)) continue;
      if (!(nk in myParent)) {
        myParent[nk] = cur;
        queue.push(nk);
      }
      // Meeting condition: other sweep already visited this neighbour
      if (otherVisited.has(nk) || nk in otherParent) {
        // Ensure nk is in myParent for path reconstruction
        if (!(nk in myParent)) myParent[nk] = cur;
        return nk;
      }
    }
    return null;
  }

  while (fQueue.length > 0 || bQueue.length > 0) {
    steps++;

    const fFrontier = new Set(fQueue.filter(k => !fVisited.has(k)));
    const bFrontier = new Set(bQueue.filter(k => !bVisited.has(k)));

    const fMeet = expandOne(fQueue, fVisited, fParent, bVisited, bParent);
    if (fMeet !== null) {
      const path = buildPath(fMeet, fParent, bParent);
      yield { visited: new Set(allVisited), frontier: fFrontier, frontierB: bFrontier, current: fMeet, path, status: 'found', steps, pathCost: path.length - 1 };
      return;
    }

    const bMeet = expandOne(bQueue, bVisited, bParent, fVisited, fParent);
    if (bMeet !== null) {
      const path = buildPath(bMeet, fParent, bParent);
      yield { visited: new Set(allVisited), frontier: fFrontier, frontierB: bFrontier, current: bMeet, path, status: 'found', steps, pathCost: path.length - 1 };
      return;
    }

    const fF2 = new Set(fQueue.filter(k => !fVisited.has(k)));
    const bF2 = new Set(bQueue.filter(k => !bVisited.has(k)));
    yield { visited: new Set(allVisited), frontier: fF2, frontierB: bF2, current: null, path: null, status: 'running', steps, pathCost: 0 };
  }

  yield { visited: new Set(allVisited), frontier: new Set(), frontierB: new Set(), current: null, path: null, status: 'no-path', steps, pathCost: 0 };
}
