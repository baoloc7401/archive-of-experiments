// Rung 3: danger-aware planner. Dijkstra to the goal where entering a tile
// costs 1 + a ghost-proximity penalty, so routes bend away from danger without
// being forbidden. Flees to the safest tile under PANIC, and hunts frightened
// ghosts while they are edible.

import { DANGER_WEIGHT, PANIC_DIST } from "../constants";
import { idToTile, nearestInSet, tileToId, weightedPath } from "./graph";
import {
  computeThreatDist,
  dangerField,
  edibleGhostIds,
  safestTile,
  tileDanger,
} from "./danger";
import { fallbackDir, pelletIds } from "./util";
import type { PacPlan, PacStrategy } from "./types";

export const astar: PacStrategy = {
  id: "astar",
  choose(state, col, row): PacPlan {
    const start = tileToId(col, row);
    const dist = computeThreatDist(state);
    const danger = dangerField(dist);
    const cost = (id: number) => DANGER_WEIGHT * tileDanger(dist, id);

    // Hunt frightened ghosts.
    const edible = edibleGhostIds(state);
    if (edible.length) {
      const hunt = nearestInSet(start, new Set(edible));
      if (hunt) {
        const pr = weightedPath(start, hunt.id, cost);
        if (pr?.firstDir) return plan(pr.firstDir, idToTile(hunt.id), pr.path, danger, "hunt");
      }
    }

    // Flee when a threat is within PANIC distance.
    if (dist && dist[start] >= 0 && dist[start] <= PANIC_DIST) {
      const goal = safestTile(dist);
      const pr = weightedPath(start, goal, cost);
      if (pr?.firstDir) return plan(pr.firstDir, idToTile(goal), pr.path, danger, "flee");
    }

    // Otherwise route to the nearest pellet, bending around danger.
    const res = nearestInSet(start, pelletIds(state));
    if (!res) return plan(fallbackDir(col, row, state.pac.dir), null, [], danger, "idle");
    const pr = weightedPath(start, res.id, cost);
    if (!pr?.firstDir) return plan(fallbackDir(col, row, state.pac.dir), idToTile(res.id), [], danger, "plan");
    return plan(pr.firstDir, idToTile(res.id), pr.path, danger, "plan");
  },
};

function plan(
  dir: PacPlan["dir"],
  target: PacPlan["target"],
  path: PacPlan["path"],
  danger: Float32Array,
  noteKey: string,
): PacPlan {
  return { strategy: "astar", dir, target, path, danger, candidates: null, noteKey };
}
