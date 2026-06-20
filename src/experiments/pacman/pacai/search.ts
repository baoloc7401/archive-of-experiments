// Rung 5: bounded look-ahead search (max-n / expectimax-lite). Simulates a few
// plies at tile granularity through the shared node model - Pac moves one tile,
// each lethal ghost steps one tile using its real greedy targeting - and backs
// up a heuristic score. Branches only at intersections to keep the tree small.

import { AI_EVAL, SEARCH_BRANCH, SEARCH_DEPTH } from "../constants";
import { idToTile, nearestInSet, tileToId, weightedPath } from "./graph";
import { computeThreatDist, dangerField } from "./danger";
import { pacMoves, rootGhosts, stepNode, tileDistWrap, type SNode } from "./node";
import { fallbackDir, pelletIds, trapIds } from "./util";
import type { Direction } from "../types";
import type { PacCandidate, PacPlan, PacStrategy } from "./types";

function evaluate(node: SNode, pellets: Set<number>): number {
  let score = node.eaten.size * AI_EVAL.pellet + AI_EVAL.alive - node.trapsHit * AI_EVAL.trap;
  const rest = new Set<number>();
  for (const p of pellets) if (!node.eaten.has(p)) rest.add(p);
  if (rest.size) {
    const near = nearestInSet(node.pac, rest);
    if (near) score -= AI_EVAL.pelletDist * near.dist;
  }
  let minGhost = Infinity;
  for (const g of node.ghosts) minGhost = Math.min(minGhost, tileDistWrap(node.pac, g.id));
  if (Number.isFinite(minGhost)) {
    score += AI_EVAL.ghostNear * Math.min(minGhost, AI_EVAL.ghostNearCap);
  }
  return score;
}

function search(
  node: SNode,
  depth: number,
  pellets: Set<number>,
  traps: Set<number>,
  isRoot: boolean,
): number {
  if (!node.alive) return -AI_EVAL.capture + (SEARCH_DEPTH - depth);
  if (depth === 0) return evaluate(node, pellets);
  const moves = pacMoves(node.pac, node.pacDir, isRoot, SEARCH_BRANCH);
  let best = -Infinity;
  for (const m of moves) {
    const child = stepNode(node, m, pellets, traps);
    const s = search(child, depth - 1, pellets, traps, false);
    if (s > best) best = s;
  }
  return best === -Infinity ? evaluate(node, pellets) : best;
}

export const lookahead: PacStrategy = {
  id: "search",
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

    const candidates: PacCandidate[] = [];
    let best = -Infinity;
    let bestDir: Direction | null = null;
    for (const m of pacMoves(root.pac, root.pacDir, true, SEARCH_BRANCH)) {
      const child = stepNode(root, m, pellets, traps);
      const s = search(child, SEARCH_DEPTH - 1, pellets, traps, false);
      candidates.push({ dir: m, score: Math.round(s) });
      if (s > best) {
        best = s;
        bestDir = m;
      }
    }

    const dir = bestDir ?? fallbackDir(col, row, state.pac.dir);
    // Show the route to the nearest pellet for context.
    const near = nearestInSet(root.pac, pellets);
    const pr = near ? weightedPath(root.pac, near.id, () => 0) : null;
    return {
      strategy: "search",
      dir,
      target: near ? idToTile(near.id) : null,
      path: pr?.path ?? [],
      danger,
      candidates,
      noteKey: ghosts.length ? "search" : "greedy",
    };
  },
};
