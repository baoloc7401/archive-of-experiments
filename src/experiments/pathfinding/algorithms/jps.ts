// Jump Point Search — accelerates A* on uniform-cost grids by "jumping" over
// symmetric, prunable cells in straight lines and only adding "jump points"
// (cells with forced neighbors) to the open list.
//
// For 4-directional movement, a forced neighbor appears when a cell that
// was unreachable from the parent (due to a wall behind it) becomes reachable
// at the current position. The jump scans in one direction until it either:
//   (a) hits a wall / grid boundary  → no jump point
//   (b) reaches the goal             → jump point
//   (c) detects a forced neighbor    → jump point
//
// NOTE: JPS assumes uniform traversal cost. On weighted terrain the path found
// is geometrically short but not necessarily cost-optimal. Use Dijkstra or A*
// for weighted grids.
import type { GridConfig } from '../types';
import type { AlgoGen } from './types';
import { DIRS, key, parseKey, inBounds, reconstructPath, manhattan } from './utils';
import { MinHeap } from './heap';

export function* jps(grid: GridConfig): AlgoGen {
  const { rows, cols, cells, start, end } = grid;
  const sk = key(...start);
  const ek = key(...end);

  const g: Record<string, number> = { [sk]: 0 };
  const parent: Record<string, string | null> = { [sk]: null };
  // Direction used to arrive at each node (needed to compute successors)
  const arrivedDir: Record<string, [number, number]> = { [sk]: [0, 0] };
  const visited = new Set<string>();
  const frontier = new Set<string>([sk]);

  const h = (r: number, c: number) => manhattan(r, c, end[0], end[1]);

  type Node = { k: string; f: number };
  const pq = new MinHeap<Node>((a, b) => a.f - b.f);
  pq.push({ k: sk, f: h(start[0], start[1]) });
  let steps = 0;

  function blocked(r: number, c: number): boolean {
    return !inBounds(r, c, rows, cols) || cells[r][c] === 'wall';
  }
  function open(r: number, c: number): boolean {
    return inBounds(r, c, rows, cols) && cells[r][c] !== 'wall';
  }

  // Iterative jump: returns first jump point in direction (dr,dc), or null.
  function jump(startR: number, startC: number, dr: number, dc: number): [number, number] | null {
    let r = startR, c = startC;
    while (true) {
      if (blocked(r, c)) return null;
      if (r === end[0] && c === end[1]) return [r, c];

      if (dc !== 0) {
        // Horizontal scan: forced if wall behind-above/below but open above/below
        if ((blocked(r - 1, c - dc) && open(r - 1, c)) ||
            (blocked(r + 1, c - dc) && open(r + 1, c))) return [r, c];
      } else {
        // Vertical scan: forced if wall behind-left/right but open left/right
        if ((blocked(r - dr, c - 1) && open(r, c - 1)) ||
            (blocked(r - dr, c + 1) && open(r, c + 1))) return [r, c];
        // Cross-scan: 4-directional JPS has no diagonal movement, so a vertical
        // scan must also check whether a horizontal jump exists at each step.
        // Without this, an open grid with the goal offset diagonally from the
        // scan line produces no jump points and JPS wrongly reports no-path.
        if (jump(r, c + 1, 0, 1) !== null || jump(r, c - 1, 0, -1) !== null) return [r, c];
      }

      r += dr;
      c += dc;
    }
  }

  // Get successor jump points from (r,c) given the direction we arrived from.
  function successors(r: number, c: number, dr: number, dc: number): [number, number][] {
    const result: [number, number][] = [];

    if (dr === 0 && dc === 0) {
      // Start node: probe all four directions
      for (const [d1, d2] of DIRS) {
        const jp = jump(r + d1, c + d2, d1, d2);
        if (jp) result.push(jp);
      }
      return result;
    }

    if (dc !== 0) {
      // Arrived horizontally
      const jp = jump(r, c + dc, 0, dc);
      if (jp) result.push(jp);
      // Forced vertical neighbors
      if (blocked(r - 1, c - dc) && open(r - 1, c)) {
        const jp2 = jump(r - 1, c, -1, 0);
        if (jp2) result.push(jp2);
      }
      if (blocked(r + 1, c - dc) && open(r + 1, c)) {
        const jp2 = jump(r + 1, c, 1, 0);
        if (jp2) result.push(jp2);
      }
    } else {
      // Arrived vertically
      const jp = jump(r + dr, c, dr, 0);
      if (jp) result.push(jp);
      // Always try horizontal — forced-neighbor check alone misses jump points
      // that were identified via cross-scan on open/lightly-walled grids.
      const jpL = jump(r, c - 1, 0, -1);
      if (jpL) result.push(jpL);
      const jpR = jump(r, c + 1, 0, 1);
      if (jpR) result.push(jpR);
    }
    return result;
  }

  while (pq.size > 0) {
    const { k: cur } = pq.pop()!;
    if (visited.has(cur)) continue;
    frontier.delete(cur);
    visited.add(cur);
    steps++;

    if (cur === ek) {
      // reconstructPath gives only the sparse jump-point waypoints.
      // Expand each straight-line segment into every intermediate cell so the
      // full path is visible rather than disconnected dots.
      const waypoints = reconstructPath(parent, ek);
      const path: string[] = [];
      for (let i = 0; i < waypoints.length; i++) {
        const [r1, c1] = parseKey(waypoints[i]);
        path.push(waypoints[i]);
        if (i + 1 < waypoints.length) {
          const [r2, c2] = parseKey(waypoints[i + 1]);
          const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
          let r = r1 + dr, c = c1 + dc;
          while (r !== r2 || c !== c2) {
            path.push(key(r, c));
            r += dr; c += dc;
          }
        }
      }
      yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path, status: 'found', steps, pathCost: g[cur] };
      return;
    }

    const [cr, cc] = parseKey(cur);
    const [dr, dc] = arrivedDir[cur] ?? [0, 0];

    for (const [nr, nc] of successors(cr, cc, dr, dc)) {
      const nk = key(nr, nc);
      if (visited.has(nk)) continue;
      // JPS uses hop distance between jump points as the edge cost (uniform grid)
      const newG = g[cur] + manhattan(cr, cc, nr, nc);
      if (!(nk in g) || newG < g[nk]) {
        g[nk] = newG;
        parent[nk] = cur;
        // Direction from (cr,cc) to jump point (nr,nc) — straight line guaranteed
        arrivedDir[nk] = [Math.sign(nr - cr), Math.sign(nc - cc)];
        frontier.add(nk);
        pq.push({ k: nk, f: newG + h(nr, nc) });
      }
    }

    yield { visited: new Set(visited), frontier: new Set(frontier), current: cur, path: null, status: 'running', steps, pathCost: 0 };
  }

  yield { visited: new Set(visited), frontier: new Set(frontier), current: null, path: null, status: 'no-path', steps, pathCost: 0 };
}
