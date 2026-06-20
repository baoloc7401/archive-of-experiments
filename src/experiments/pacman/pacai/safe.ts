// Rung 2: safe-greedy. Eats the nearest pellet reachable without routing close
// to a lethal ghost; flees when cornered; hunts frightened ghosts when they are
// edible.

import { ENERGIZER_LURE_DIST, SAFE_MIN_DIST, TRAP_AVOID_COST } from "../constants";
import { idToTile, nearestInSet, nearestInSetMasked, tileToId, weightedPath } from "./graph";
import {
  computeThreatDist,
  dangerField,
  edibleGhostIds,
  safestTile,
} from "./danger";
import { energizerIds, fallbackDir, pelletIds, trapIds } from "./util";
import type { PacPlan, PacStrategy } from "./types";

export const safe: PacStrategy = {
  id: "safe",
  choose(state, col, row): PacPlan {
    const start = tileToId(col, row);
    const dist = computeThreatDist(state);
    const danger = dangerField(dist);
    const traps = trapIds(state);
    const trapCost = (id: number) => (traps.has(id) ? TRAP_AVOID_COST : 0);

    // Frightened ghosts on the board: chase the nearest one for points.
    const edible = edibleGhostIds(state);
    if (edible.length) {
      const hunt = nearestInSet(start, new Set(edible));
      if (hunt?.firstDir) {
        const pr = weightedPath(start, hunt.id, trapCost);
        return plan("safe", hunt.firstDir, idToTile(hunt.id), pr?.path ?? [], danger, "hunt");
      }
    }

    // In danger: prefer grabbing a nearby energizer to flip the threat into prey;
    // otherwise flee toward the tile farthest from every threat.
    if (dist && dist[start] >= 0 && dist[start] <= SAFE_MIN_DIST) {
      const power = nearestInSet(start, energizerIds(state));
      if (power && power.dist <= ENERGIZER_LURE_DIST) {
        const pr = weightedPath(start, power.id, trapCost);
        if (pr?.firstDir) return plan("safe", pr.firstDir, idToTile(power.id), pr.path, danger, "power");
      }
      const goal = safestTile(dist);
      const pr = weightedPath(start, goal, trapCost);
      if (pr?.firstDir) return plan("safe", pr.firstDir, idToTile(goal), pr.path, danger, "flee");
    }

    // Nearest pellet whose route never passes within SAFE_MIN_DIST of a threat or
    // across a trap; fall back to the nearest trap-free pellet if nothing safe is.
    const pellets = pelletIds(state);
    const blocked = (id: number) =>
      traps.has(id) || (dist !== null && dist[id] >= 0 && dist[id] < SAFE_MIN_DIST);
    const res =
      nearestInSetMasked(start, pellets, blocked) ??
      nearestInSetMasked(start, pellets, (id) => traps.has(id)) ??
      nearestInSet(start, pellets);
    if (!res || !res.firstDir) {
      return plan("safe", fallbackDir(col, row, state.pac.dir), null, [], danger, "idle");
    }
    const pr = weightedPath(start, res.id, trapCost);
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
