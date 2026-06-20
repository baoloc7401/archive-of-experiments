// Rung 1: nearest pellet, ghosts ignored. The naive baseline that gets cornered.
// It still steps around traps - eating one is pure loss (points + a stun), never
// a trade-off, so no strategy should ever route through one.

import { TRAP_AVOID_COST } from "../constants";
import { idToTile, nearestInSet, nearestInSetMasked, tileToId, weightedPath } from "./graph";
import { fallbackDir, pelletIds, trapIds } from "./util";
import type { PacPlan, PacStrategy } from "./types";

export const greedy: PacStrategy = {
  id: "greedy",
  choose(state, col, row): PacPlan {
    const start = tileToId(col, row);
    const pellets = pelletIds(state);
    const traps = trapIds(state);
    const isTrap = (id: number) => traps.has(id);
    const res = nearestInSetMasked(start, pellets, isTrap) ?? nearestInSet(start, pellets);
    if (!res || !res.firstDir) {
      return {
        strategy: "greedy",
        dir: fallbackDir(col, row, state.pac.dir),
        target: null,
        path: [],
        danger: null,
        candidates: null,
        noteKey: "idle",
      };
    }
    const pr = weightedPath(start, res.id, (id) => (traps.has(id) ? TRAP_AVOID_COST : 0));
    return {
      strategy: "greedy",
      dir: res.firstDir,
      target: idToTile(res.id),
      path: pr?.path ?? [],
      danger: null,
      candidates: null,
      noteKey: "greedy",
    };
  },
};
