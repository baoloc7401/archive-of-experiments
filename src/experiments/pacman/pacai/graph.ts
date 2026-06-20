// Optimized static maze graph for the AI Pac-Man strategies. The maze never
// changes, so adjacency is precomputed once into flat typed arrays addressed by
// numeric tile id (id = row * COLS + col). All searches reuse module-scope
// scratch buffers, so a decision costs no steady-state allocation.

import { COLS, DIR_VEC, ROWS, TIE_ORDER } from "../constants";
import { getActiveMaze, getMazeVersion } from "../maze";
import type { Direction, PacmanState, Tile } from "../types";

export const TILE_COUNT = COLS * ROWS;
/** Neighbour probe order = the ghosts' tie-break order (up, left, down, right). */
const DIRS: Direction[] = TIE_ORDER;

export function tileToId(col: number, row: number): number {
  return row * COLS + col;
}

export function idToTile(id: number): Tile {
  return { col: id % COLS, row: Math.floor(id / COLS) };
}

/** A tile is graph-passable when it is neither wall nor ghost-house gate. */
function passable(col: number, row: number): boolean {
  if (row < 0 || row >= ROWS) return false;
  const c = ((col % COLS) + COLS) % COLS;
  const ch = getActiveMaze()[row][c];
  return ch !== "#" && ch !== "-";
}

// adj[id * 4 + k] = neighbour id reached by DIRS[k], or -1 if blocked.
const adj = new Int32Array(TILE_COUNT * 4).fill(-1);
const degree = new Int8Array(TILE_COUNT);
// Cache is keyed on the active-maze version so it rebuilds after a maze swap.
let builtVersion = -1;

function build() {
  adj.fill(-1);
  degree.fill(0);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!passable(col, row)) continue;
      const id = tileToId(col, row);
      let deg = 0;
      for (let k = 0; k < 4; k++) {
        const { dx, dy } = DIR_VEC[DIRS[k]];
        let nc = col + dx;
        const nr = row + dy;
        if (nc < 0) nc += COLS;
        else if (nc >= COLS) nc -= COLS;
        if (passable(nc, nr)) {
          adj[id * 4 + k] = tileToId(nc, nr);
          deg++;
        }
      }
      degree[id] = deg;
    }
  }
  builtVersion = getMazeVersion();
}

function ensure() {
  if (builtVersion !== getMazeVersion()) build();
}

// --- Wormhole edges ---------------------------------------------------------
// Stepping onto a wormhole endpoint relocates the actor to its pair, so for the
// planners the tile you *land on* after entering an endpoint is its pair. We
// model this by resolving every discovered neighbour through `portalOf` before
// recording it: a teleport is not a separate node, it just redirects where the
// step arrives. `portalOf[id]` = paired endpoint id, or -1. Set per decision
// from live state (the pairs are toggleable, so this is not baked into `adj`).
const portalOf = new Int32Array(TILE_COUNT).fill(-1);

/** Install the active wormhole pairs (or clear them when teleport is off). */
export function setPortalsFromState(state: PacmanState): void {
  portalOf.fill(-1);
  if (!state.enabledPellets.teleport) return;
  for (const [aKey, bKey] of state.wormholes) {
    const [ac, ar] = aKey.split(",").map(Number);
    const [bc, br] = bKey.split(",").map(Number);
    portalOf[tileToId(ac, ar)] = tileToId(bc, br);
  }
}

/** The tile an actor ends up on after stepping onto `id` (its portal pair, else itself). */
export function resolvePortal(id: number): number {
  const p = portalOf[id];
  return p >= 0 ? p : id;
}

/** True at a branch tile (more than two ways out) - where search must fan out. */
export function isIntersection(id: number): boolean {
  ensure();
  return degree[id] > 2;
}

export function isPassableId(id: number): boolean {
  ensure();
  return degree[id] > 0;
}

/** Direction from a tile to an adjacent tile (tunnel wrap aware), or null. */
export function dirBetweenIds(fromId: number, toId: number): Direction | null {
  ensure();
  for (let k = 0; k < 4; k++) {
    if (adj[fromId * 4 + k] === toId) return DIRS[k];
  }
  return null;
}

// --- Shared scratch ---------------------------------------------------------
const dist = new Int32Array(TILE_COUNT);
const firstDirIdx = new Int8Array(TILE_COUNT);
const prev = new Int32Array(TILE_COUNT);
const queue = new Int32Array(TILE_COUNT);

export interface NearestResult {
  id: number;
  dist: number;
  firstDir: Direction | null;
}

/**
 * BFS from `startId` to the closest id in `targets` (excluding the start tile),
 * returning the distance and the first step's direction in one pass.
 */
export function nearestInSet(startId: number, targets: Set<number>): NearestResult | null {
  ensure();
  dist.fill(-1);
  dist[startId] = 0;
  firstDirIdx[startId] = -1;
  let head = 0;
  let tail = 0;
  queue[tail++] = startId;
  while (head < tail) {
    const cur = queue[head++];
    if (cur !== startId && targets.has(cur)) {
      const fd = firstDirIdx[cur];
      return { id: cur, dist: dist[cur], firstDir: fd >= 0 ? DIRS[fd] : null };
    }
    const base = cur * 4;
    for (let k = 0; k < 4; k++) {
      const raw = adj[base + k];
      if (raw < 0) continue;
      const n = resolvePortal(raw);
      if (dist[n] >= 0) continue;
      dist[n] = dist[cur] + 1;
      firstDirIdx[n] = cur === startId ? k : firstDirIdx[cur];
      queue[tail++] = n;
    }
  }
  return null;
}

/**
 * Like {@link nearestInSet} but skips tiles for which `blocked` is true, so the
 * planner can avoid routing through dangerous cells. Returns null if no target
 * is reachable without crossing a blocked tile.
 */
export function nearestInSetMasked(
  startId: number,
  targets: Set<number>,
  blocked: (id: number) => boolean,
): NearestResult | null {
  ensure();
  dist.fill(-1);
  dist[startId] = 0;
  firstDirIdx[startId] = -1;
  let head = 0;
  let tail = 0;
  queue[tail++] = startId;
  while (head < tail) {
    const cur = queue[head++];
    if (cur !== startId && targets.has(cur)) {
      const fd = firstDirIdx[cur];
      return { id: cur, dist: dist[cur], firstDir: fd >= 0 ? DIRS[fd] : null };
    }
    const base = cur * 4;
    for (let k = 0; k < 4; k++) {
      const raw = adj[base + k];
      if (raw < 0) continue;
      const n = resolvePortal(raw);
      if (dist[n] >= 0 || blocked(n)) continue;
      dist[n] = dist[cur] + 1;
      firstDirIdx[n] = cur === startId ? k : firstDirIdx[cur];
      queue[tail++] = n;
    }
  }
  return null;
}

/**
 * Multi-source BFS distance field from a set of source tiles (e.g. ghosts).
 * Returns the shared scratch array - read or copy it before the next graph call.
 * Unreachable tiles are a large sentinel.
 */
export function multiSourceBFS(sources: number[]): Int32Array {
  ensure();
  dist.fill(-1);
  let head = 0;
  let tail = 0;
  for (const s of sources) {
    if (s >= 0 && s < TILE_COUNT && dist[s] < 0) {
      dist[s] = 0;
      queue[tail++] = s;
    }
  }
  while (head < tail) {
    const cur = queue[head++];
    const base = cur * 4;
    for (let k = 0; k < 4; k++) {
      const raw = adj[base + k];
      if (raw < 0) continue;
      const n = resolvePortal(raw);
      if (dist[n] >= 0) continue;
      dist[n] = dist[cur] + 1;
      queue[tail++] = n;
    }
  }
  return dist;
}

// --- Weighted shortest path (Dijkstra) for the danger-aware planner ----------
const gCost = new Float64Array(TILE_COUNT);
const heapId = new Int32Array(TILE_COUNT + 1);
const heapKey = new Float64Array(TILE_COUNT + 1);
let heapSize = 0;

function heapPush(id: number, key: number) {
  let i = ++heapSize;
  heapId[i] = id;
  heapKey[i] = key;
  while (i > 1) {
    const p = i >> 1;
    if (heapKey[p] <= heapKey[i]) break;
    [heapKey[p], heapKey[i]] = [heapKey[i], heapKey[p]];
    [heapId[p], heapId[i]] = [heapId[i], heapId[p]];
    i = p;
  }
}

function heapPop(): number {
  const top = heapId[1];
  heapId[1] = heapId[heapSize];
  heapKey[1] = heapKey[heapSize];
  heapSize--;
  let i = 1;
  for (;;) {
    const l = i << 1;
    const r = l + 1;
    let m = i;
    if (l <= heapSize && heapKey[l] < heapKey[m]) m = l;
    if (r <= heapSize && heapKey[r] < heapKey[m]) m = r;
    if (m === i) break;
    [heapKey[m], heapKey[i]] = [heapKey[i], heapKey[m]];
    [heapId[m], heapId[i]] = [heapId[i], heapId[m]];
    i = m;
  }
  return top;
}

export interface PathResult {
  path: Tile[];
  firstDir: Direction | null;
}

/**
 * Least-cost path from `startId` to `goalId` where entering a tile costs
 * `1 + extraCost(tileId)` (the danger penalty). Dijkstra over the static graph.
 */
export function weightedPath(
  startId: number,
  goalId: number,
  extraCost: (tileId: number) => number,
): PathResult | null {
  ensure();
  gCost.fill(Infinity);
  prev.fill(-1);
  gCost[startId] = 0;
  heapSize = 0;
  heapPush(startId, 0);
  while (heapSize > 0) {
    const cur = heapPop();
    if (cur === goalId) break;
    const g = gCost[cur];
    const base = cur * 4;
    for (let k = 0; k < 4; k++) {
      const raw = adj[base + k];
      if (raw < 0) continue;
      const n = resolvePortal(raw);
      const ng = g + 1 + extraCost(n);
      if (ng < gCost[n]) {
        gCost[n] = ng;
        prev[n] = cur;
        heapPush(n, ng);
      }
    }
  }
  if (!Number.isFinite(gCost[goalId])) return null;
  const ids: number[] = [];
  for (let id = goalId; id !== -1; id = prev[id]) {
    ids.push(id);
    if (id === startId) break;
  }
  ids.reverse();
  const path = ids.map(idToTile);
  const firstDir = ids.length >= 2 ? dirBetweenIds(ids[0], ids[1]) : null;
  return { path, firstDir };
}
