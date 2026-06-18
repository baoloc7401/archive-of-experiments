// Rung 2: safe-greedy. Eats the nearest pellet reachable without routing close
// to a lethal ghost; flees when cornered; hunts frightened ghosts when they are
// edible.

import { SAFE_MIN_DIST } from "../constants";
import { idToTile, nearestInSet, nearestInSetMasked, tileToId, weightedPath } from "./graph";
import {
  computeThreatDist,
  dangerField,
  edibleGhostIds,
  safestTile,
} from "./danger";
import { fallbackDir, pelletIds } from "./util";
import type { PacPlan, PacStrategy } from "./types";

export const safe: PacStrategy = {
  id: "safe",
  choose(state, col, row): PacPlan {
    const start = tileToId(col, row);
    const dist = computeThreatDist(state);
    const danger = dangerField(dist);

    // Frightened ghosts on the board: chase the nearest one for points.
    const edible = edibleGhostIds(state);
    if (edible.length) {
      const hunt = nearestInSet(start, new Set(edible));
      if (hunt?.firstDir) {
        const pr = weightedPath(start, hunt.id, () => 0);
        return plan("safe", hunt.firstDir, idToTile(hunt.id), pr?.path ?? [], danger, "hunt");
      }
    }

    // In danger: flee toward the tile farthest from every threat.
    if (dist && dist[start] >= 0 && dist[start] <= SAFE_MIN_DIST) {
      const goal = safestTile(dist);
      const pr = weightedPath(start, goal, () => 0);
      if (pr?.firstDir) return plan("safe", pr.firstDir, idToTile(goal), pr.path, danger, "flee");
    }

    // Nearest pellet whose route never passes within SAFE_MIN_DIST of a threat;
    // fall back to the plain nearest pellet if nothing safe is reachable.
    const blocked = (id: number) => dist !== null && dist[id] >= 0 && dist[id] < SAFE_MIN_DIST;
    const res = nearestInSetMasked(start, pelletIds(state), blocked) ?? nearestInSet(start, pelletIds(state));
    if (!res || !res.firstDir) {
      return plan("safe", fallbackDir(col, row, state.pac.dir), null, [], danger, "idle");
    }
    const pr = weightedPath(start, res.id, () => 0);
    return plan("safe", res.firstDir, idToTile(res.id), pr?.path ?? [], danger, "safe");
  },
};

function plan(
  strategy: PacPlan["strategy"],
  dir: PacPlan["dir"],
  target: PacPlan["target"],
  path: PacPlan["path"],
  danger: Float32Array,
  noteKey: string,
): PacPlan {
  return { strategy, dir, target, path, danger, candidates: null, noteKey };
}
