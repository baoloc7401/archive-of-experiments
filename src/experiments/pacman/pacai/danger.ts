// Ghost "danger field": distance from each tile to the nearest lethal ghost,
// plus helpers the planners share. A ghost is lethal only when active and not
// frightened/eaten; while an energizer is active there are no threats (the
// active ghosts are edible instead). Kept free of simulation.ts imports to
// avoid an import cycle.

import { DANGER_RADIUS } from "../constants";
import type { PacmanState } from "../types";
import { multiSourceBFS, TILE_COUNT, tileToId } from "./graph";

/** Tile ids of currently lethal ghosts. */
export function threatTiles(state: PacmanState): number[] {
  if (state.frightTime > 0) return [];
  const ids: number[] = [];
  for (const g of state.ghosts) {
    if (state.enabled[g.id] && g.pen === "active") {
      ids.push(tileToId(Math.round(g.x), Math.round(g.y)));
    }
  }
  return ids;
}

/** Tile ids of edible (frightened) ghosts, for the hunt behaviour. */
export function edibleGhostIds(state: PacmanState): number[] {
  if (state.frightTime <= 0) return [];
  const ids: number[] = [];
  for (const g of state.ghosts) {
    if (state.enabled[g.id] && g.pen === "active") {
      ids.push(tileToId(Math.round(g.x), Math.round(g.y)));
    }
  }
  return ids;
}

/**
 * Owned copy of the multi-source BFS distance from every tile to the nearest
 * threat, or null when there are no threats. (-1 = unreachable.) Copied because
 * later graph searches reuse the shared scratch buffer.
 */
export function computeThreatDist(state: PacmanState): Int32Array | null {
  const sources = threatTiles(state);
  if (sources.length === 0) return null;
  return Int32Array.from(multiSourceBFS(sources));
}

/** Danger of a tile in [0, 1]: 1 on a threat, fading to 0 at DANGER_RADIUS. */
export function tileDanger(dist: Int32Array | null, id: number): number {
  if (!dist) return 0;
  const d = dist[id];
  if (d < 0 || d > DANGER_RADIUS) return 0;
  return (DANGER_RADIUS - d + 1) / (DANGER_RADIUS + 1);
}

/** Build the full danger field for the overlay (and A* penalty lookups). */
export function dangerField(dist: Int32Array | null): Float32Array {
  const f = new Float32Array(TILE_COUNT);
  if (!dist) return f;
  for (let id = 0; id < TILE_COUNT; id++) f[id] = tileDanger(dist, id);
  return f;
}

/** The reachable tile farthest from every threat - a flee destination. */
export function safestTile(dist: Int32Array): number {
  let best = -1;
  let bestD = -1;
  for (let id = 0; id < TILE_COUNT; id++) {
    if (dist[id] > bestD) {
      bestD = dist[id];
      best = id;
    }
  }
  return best;
}
