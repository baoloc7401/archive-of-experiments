// Rung 4: coverage planner. Where greedy re-picks the nearest pellet every tile
// (and so abandons a near-finished region the moment something else is a hair
// closer, leaving stragglers), this commits to a precomputed global sweep order
// - a nearest-neighbour tour over the pellet graph (a cheap TSP heuristic) - and
// follows it waypoint by waypoint, vacuuming whatever lies on the route. It only
// patches locally when threatened (flee / grab a power pellet), then resumes the
// tour. The tour is cached on state and rebuilt only when it no longer covers
// every pellet (e.g. a fruit appears) or runs out.

import {
  DANGER_WEIGHT,
  ENERGIZER_LURE_DIST,
  PANIC_DIST,
  TRAP_AVOID_COST,
} from "../constants";
import { idToTile, nearestInSet, tileToId, weightedPath } from "./graph";
import {
  computeThreatDist,
  dangerField,
  edibleGhostIds,
  safestTile,
  tileDanger,
} from "./danger";
import { energizerIds, fallbackDir, pelletIds, trapIds } from "./util";
import type { PacPlan, PacStrategy } from "./types";

/** Nearest-neighbour tour: from the start, repeatedly hop to the closest unvisited pellet. */
function buildTour(startId: number, pellets: Set<number>): number[] {
  const remaining = new Set(pellets);
  const order: number[] = [];
  let cur = startId;
  while (remaining.size) {
    const next = nearestInSet(cur, remaining);
    if (!next) break; // remainder unreachable from here
    order.push(next.id);
    remaining.delete(next.id);
    cur = next.id;
  }
  return order;
}

/** True when every current pellet appears in the cached tour. */
function tourCovers(tour: number[], pellets: Set<number>): boolean {
  const have = new Set(tour);
  for (const p of pellets) if (!have.has(p)) return false;
  return true;
}

export const coverage: PacStrategy = {
  id: "coverage",
  choose(state, col, row): PacPlan {
    const start = tileToId(col, row);
    const dist = computeThreatDist(state);
    const danger = dangerField(dist);
    const traps = trapIds(state);
    const cost = (id: number) =>
      DANGER_WEIGHT * tileDanger(dist, id) + (traps.has(id) ? TRAP_AVOID_COST : 0);
    const pellets = pelletIds(state);

    if (!pellets.size) {
      return plan(fallbackDir(col, row, state.pac.dir), null, [], danger, "idle");
    }

    // Frightened ghosts about: chase the nearest for points (suspend the sweep).
    const edible = edibleGhostIds(state);
    if (edible.length) {
      const hunt = nearestInSet(start, new Set(edible));
      if (hunt?.firstDir) {
        const pr = weightedPath(start, hunt.id, cost);
        return plan(hunt.firstDir, idToTile(hunt.id), pr?.path ?? [], danger, "hunt");
      }
    }

    // Local patch when threatened: grab a nearby energizer, else flee, then resume.
    if (dist && dist[start] >= 0 && dist[start] <= PANIC_DIST) {
      const power = nearestInSet(start, energizerIds(state));
      if (power && power.dist <= ENERGIZER_LURE_DIST) {
        const pr = weightedPath(start, power.id, cost);
        if (pr?.firstDir) return plan(pr.firstDir, idToTile(power.id), pr.path, danger, "power");
      }
      const goal = safestTile(dist);
      const pr = weightedPath(start, goal, cost);
      if (pr?.firstDir) return plan(pr.firstDir, idToTile(goal), pr.path, danger, "flee");
    }

    // Follow the cached sweep. Rebuild if absent or no longer covering all pellets.
    let tour = state.coverageTour;
    if (!tour || !tourCovers(tour, pellets)) {
      tour = buildTour(start, pellets);
      state.coverageTour = tour;
    }
    // Drop waypoints already eaten (incidentally, on the way) so the front is live.
    while (tour.length && !pellets.has(tour[0])) tour.shift();
    if (!tour.length) {
      tour = buildTour(start, pellets);
      state.coverageTour = tour;
    }

    const target = tour[0];
    const pr = weightedPath(start, target, cost);
    if (!pr?.firstDir) {
      // Waypoint walled off behind danger/traps right now: take the nearest pellet.
      const near = nearestInSet(start, pellets);
      if (near?.firstDir) {
        const np = weightedPath(start, near.id, cost);
        return plan(near.firstDir, idToTile(near.id), np?.path ?? [], danger, "coverage");
      }
      return plan(fallbackDir(col, row, state.pac.dir), idToTile(target), [], danger, "coverage");
    }
    return plan(pr.firstDir, idToTile(target), pr.path, danger, "coverage");
  },
};

function plan(
  dir: PacPlan["dir"],
  target: PacPlan["target"],
  path: PacPlan["path"],
  danger: Float32Array,
  noteKey: string,
): PacPlan {
  return { strategy: "coverage", dir, target, path, danger, candidates: null, noteKey };
}
