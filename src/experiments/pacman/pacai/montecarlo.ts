// Rung 6: Monte-Carlo rollouts. For each legal move it runs many short random
// playouts (Pac wanders, ghosts chase for real through the shared node model),
// scores how those playouts end - pellets eaten, traps hit, captured or alive -
// and averages them, then takes the move with the best expected outcome. No
// explicit search tree: the value of a move emerges from sampled futures. The
// overlay shows the per-move averages (the candidate bars) and a faint fan of
// sampled playout paths from the chosen move.

import {
  AI_EVAL,
  MC_DEPTH,
  MC_EVAL,
  MC_FAN,
  MC_ROLLOUTS,
  OPPOSITE,
  SEARCH_BRANCH,
} from "../constants";
import { isPassablePac, neighbor } from "../maze";
import { idToTile, nearestInSet, tileToId, weightedPath } from "./graph";
import { computeThreatDist, dangerField } from "./danger";
import { DIRS4, pacMoves, rootGhosts, stepNode, type SNode } from "./node";
import { fallbackDir, pelletIds, trapIds } from "./util";
import type { Direction, Tile } from "../types";
import type { PacCandidate, PacPlan, PacStrategy } from "./types";

// Seeded PRNG (mulberry32) so rollouts are reproducible: `choose` reseeds from a
// hash of the live state each call, making the driver a deterministic function
// of the game state (same position -> same decision, no frame-to-frame shimmer).
let rngState = 0;
function reseed(seed: number) {
  rngState = seed >>> 0;
}
function rng(): number {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A uniformly random legal move, preferring not to reverse (forward bias). */
function randomMove(id: number, dir: Direction): Direction {
  const t = idToTile(id);
  const back = OPPOSITE[dir];
  const open: Direction[] = [];
  for (const d of DIRS4) {
    const n = neighbor(t.col, t.row, d);
    if (isPassablePac(n.col, n.row)) open.push(d);
  }
  const fwd = open.filter((d) => d !== back);
  const pool = fwd.length ? fwd : open;
  return pool[(rng() * pool.length) | 0] ?? dir;
}

interface Rollout {
  score: number;
  path: number[];
}

/** One random playout from `start`; returns its terminal value and the path walked. */
function rollout(start: SNode, pellets: Set<number>, traps: Set<number>): Rollout {
  let node = start;
  const path: number[] = [start.pac];
  let steps = 0;
  for (let i = 0; i < MC_DEPTH; i++) {
    if (!node.alive) break;
    node = stepNode(node, randomMove(node.pac, node.pacDir), pellets, traps);
    path.push(node.pac);
    steps = i + 1;
  }
  let score = node.eaten.size * MC_EVAL.pellet - node.trapsHit * AI_EVAL.trap;
  if (!node.alive) score -= (MC_EVAL.death * (MC_DEPTH - steps + 1)) / MC_DEPTH; // earlier death is worse
  else score += MC_EVAL.survive;
  return { score, path };
}

export const montecarlo: PacStrategy = {
  id: "montecarlo",
  choose(state, col, row): PacPlan {
    const danger = dangerField(computeThreatDist(state));
    const pellets = pelletIds(state);
    const traps = trapIds(state);
    const ghosts = rootGhosts(state);

    const root: SNode = {
      pac: tileToId(col, row),
      pacDir: state.pac.dir,
      ghosts,
      eaten: new Set(),
      trapsHit: 0,
      alive: true,
    };

    // Reseed deterministically from the live state so the rollouts reproduce.
    let seed = Math.imul(root.pac ^ 0x811c9dc5, 0x01000193) >>> 0;
    seed = Math.imul(seed ^ (DIRS4.indexOf(state.pac.dir) + 1), 0x01000193) >>> 0;
    seed = Math.imul(seed ^ state.dotsEaten, 0x01000193) >>> 0;
    for (const g of ghosts) {
      seed = Math.imul(seed ^ g.id, 0x01000193) >>> 0;
      seed = Math.imul(seed ^ (DIRS4.indexOf(g.dir) + 1), 0x01000193) >>> 0;
    }
    reseed(seed);

    const candidates: PacCandidate[] = [];
    const fanByDir = new Map<Direction, number[][]>();
    let best = -Infinity;
    let bestDir: Direction | null = null;

    for (const m of pacMoves(root.pac, root.pacDir, true, SEARCH_BRANCH)) {
      const child = stepNode(root, m, pellets, traps);
      let sum = 0;
      const paths: number[][] = [];
      for (let k = 0; k < MC_ROLLOUTS; k++) {
        const r = rollout(child, pellets, traps);
        sum += r.score;
        if (paths.length < MC_FAN) paths.push(r.path);
      }
      const avg = sum / MC_ROLLOUTS;
      candidates.push({ dir: m, score: Math.round(avg) });
      fanByDir.set(m, paths);
      if (avg > best) {
        best = avg;
        bestDir = m;
      }
    }

    const dir = bestDir ?? fallbackDir(col, row, state.pac.dir);
    const rollouts: Tile[][] = (bestDir ? (fanByDir.get(bestDir) ?? []) : []).map((p) =>
      p.map(idToTile),
    );

    // Route to the nearest pellet for the target diamond + context path.
    const near = nearestInSet(root.pac, pellets);
    const pr = near ? weightedPath(root.pac, near.id, () => 0) : null;
    return {
      strategy: "montecarlo",
      dir,
      target: near ? idToTile(near.id) : null,
      path: pr?.path ?? [],
      danger,
      candidates,
      rollouts,
      noteKey: ghosts.length ? "rollout" : "greedy",
    };
  },
};
