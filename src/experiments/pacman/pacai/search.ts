// Rung 4: bounded look-ahead search (max-n / expectimax-lite). Simulates a few
// plies at tile granularity - Pac moves one tile, each lethal ghost steps one
// tile using its real greedy targeting against the predicted Pac - and backs up
// a heuristic score. Branches only at intersections to keep the tree small, and
// uses compact nodes (no PacmanState cloning).

import { AI_EVAL, COLS, OPPOSITE, SEARCH_BRANCH, SEARCH_DEPTH } from "../constants";
import { isPassablePac, neighbor } from "../maze";
import { chooseDirection } from "../targeting";
import { idToTile, isIntersection, nearestInSet, tileToId, weightedPath } from "./graph";
import { computeThreatDist, dangerField } from "./danger";
import { fallbackDir, pelletIds } from "./util";
import type { Direction } from "../types";
import type { PacCandidate, PacPlan, PacStrategy } from "./types";

interface GNode {
  id: number;
  dir: Direction;
}
interface SNode {
  pac: number;
  pacDir: Direction;
  ghosts: GNode[];
  eaten: Set<number>;
  alive: boolean;
}

const DIRS: Direction[] = ["up", "left", "down", "right"];

function tileDistWrap(aId: number, bId: number): number {
  const a = idToTile(aId);
  const b = idToTile(bId);
  let dc = Math.abs(a.col - b.col);
  dc = Math.min(dc, COLS - dc);
  return dc + Math.abs(a.row - b.row);
}

/** Legal Pac moves from a tile; branches only at intersections, reverse only at root. */
function pacMoves(id: number, dir: Direction, isRoot: boolean): Direction[] {
  const t = idToTile(id);
  const back = OPPOSITE[dir];
  const open: Direction[] = [];
  for (const d of DIRS) {
    const n = neighbor(t.col, t.row, d);
    if (isPassablePac(n.col, n.row)) open.push(d);
  }
  if (isRoot) return open; // consider every option (incl. reverse) for the live decision
  if (isIntersection(id)) {
    const fwd = open.filter((d) => d !== back);
    return (fwd.length ? fwd : open).slice(0, SEARCH_BRANCH);
  }
  const fwd = open.filter((d) => d !== back);
  return fwd.length ? [fwd[0]] : open.slice(0, 1); // corridor: forced
}

function stepNode(node: SNode, dir: Direction, pellets: Set<number>): SNode {
  const pt = idToTile(node.pac);
  const npTile = neighbor(pt.col, pt.row, dir);
  const np = tileToId(npTile.col, npTile.row);

  const eaten = new Set(node.eaten);
  if (pellets.has(np)) eaten.add(np);

  const ghosts: GNode[] = node.ghosts.map((g) => {
    const gt = idToTile(g.id);
    const gd = chooseDirection(gt.col, gt.row, g.dir, npTile, false, "chase");
    const ng = neighbor(gt.col, gt.row, gd);
    return { id: tileToId(ng.col, ng.row), dir: gd };
  });

  let alive = true;
  for (let i = 0; i < ghosts.length; i++) {
    const moved = ghosts[i].id;
    const wasAt = node.ghosts[i].id;
    if (moved === np || (moved === node.pac && wasAt === np)) alive = false; // collide or swap
  }
  return { pac: np, pacDir: dir, ghosts, eaten, alive };
}

function evaluate(node: SNode, pellets: Set<number>): number {
  let score = node.eaten.size * AI_EVAL.pellet + AI_EVAL.alive;
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

function search(node: SNode, depth: number, pellets: Set<number>, isRoot: boolean): number {
  if (!node.alive) return -AI_EVAL.capture + (SEARCH_DEPTH - depth);
  if (depth === 0) return evaluate(node, pellets);
  const moves = pacMoves(node.pac, node.pacDir, isRoot);
  let best = -Infinity;
  for (const m of moves) {
    const child = stepNode(node, m, pellets);
    const s = search(child, depth - 1, pellets, false);
    if (s > best) best = s;
  }
  return best === -Infinity ? evaluate(node, pellets) : best;
}

export const lookahead: PacStrategy = {
  id: "search",
  choose(state, col, row): PacPlan {
    const danger = dangerField(computeThreatDist(state));
    const pellets = pelletIds(state);
    const ghosts: GNode[] = state.ghosts
      .filter((g) => state.enabled[g.id] && g.pen === "active" && state.frightTime === 0)
      .map((g) => ({ id: tileToId(Math.round(g.x), Math.round(g.y)), dir: g.dir }));

    const root: SNode = {
      pac: tileToId(col, row),
      pacDir: state.pac.dir,
      ghosts,
      eaten: new Set(),
      alive: true,
    };

    const candidates: PacCandidate[] = [];
    let best = -Infinity;
    let bestDir: Direction | null = null;
    for (const m of pacMoves(root.pac, root.pacDir, true)) {
      const child = stepNode(root, m, pellets);
      const s = search(child, SEARCH_DEPTH - 1, pellets, false);
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
