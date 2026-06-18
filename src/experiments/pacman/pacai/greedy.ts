// Rung 1: nearest pellet, ghosts ignored. The naive baseline that gets cornered.

import { idToTile, nearestInSet, tileToId, weightedPath } from "./graph";
import { fallbackDir, pelletIds } from "./util";
import type { PacPlan, PacStrategy } from "./types";

export const greedy: PacStrategy = {
  id: "greedy",
  choose(state, col, row): PacPlan {
    const start = tileToId(col, row);
    const res = nearestInSet(start, pelletIds(state));
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
    const pr = weightedPath(start, res.id, () => 0);
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
