// Shared compact game model for the look-ahead and Monte-Carlo drivers. A node
// holds only tile ids (no PacmanState cloning): Pac advances one tile, each
// lethal ghost steps one tile using its real greedy targeting against the
// predicted Pac, and pellets/traps crossed are tallied. Both the deterministic
// search (search.ts) and the random rollouts (montecarlo.ts) step nodes through
// here so their world models stay identical.

import { COLS, OPPOSITE } from "../constants";
import { isPassablePac, neighbor } from "../maze";
import { chooseDirection } from "../targeting";
import { idToTile, isIntersection, resolvePortal, tileToId } from "./graph";
import type { Direction, PacmanState } from "../types";

export interface GNode {
  id: number;
  dir: Direction;
}

export interface SNode {
  pac: number;
  pacDir: Direction;
  ghosts: GNode[];
  eaten: Set<number>;
  trapsHit: number;
  alive: boolean;
}

export const DIRS4: Direction[] = ["up", "left", "down", "right"];

/** Manhattan distance with horizontal tunnel wrap. */
export function tileDistWrap(aId: number, bId: number): number {
  const a = idToTile(aId);
  const b = idToTile(bId);
  let dc = Math.abs(a.col - b.col);
  dc = Math.min(dc, COLS - dc);
  return dc + Math.abs(a.row - b.row);
}

/** Lethal ghosts as search nodes (active, not frightened) - the predators modelled. */
export function rootGhosts(state: PacmanState): GNode[] {
  if (state.frightTime > 0) return [];
  return state.ghosts
    .filter((g) => state.enabled[g.id] && g.pen === "active")
    .map((g) => ({ id: tileToId(Math.round(g.x), Math.round(g.y)), dir: g.dir }));
}

/** Legal Pac moves from a tile; reverse only at the root, branch-capped at intersections. */
export function pacMoves(id: number, dir: Direction, isRoot: boolean, branch: number): Direction[] {
  const t = idToTile(id);
  const back = OPPOSITE[dir];
  const open: Direction[] = [];
  for (const d of DIRS4) {
    const n = neighbor(t.col, t.row, d);
    if (isPassablePac(n.col, n.row)) open.push(d);
  }
  if (isRoot) return open; // every option (incl. reverse) for the live decision
  if (isIntersection(id)) {
    const fwd = open.filter((d) => d !== back);
    return (fwd.length ? fwd : open).slice(0, branch);
  }
  const fwd = open.filter((d) => d !== back);
  return fwd.length ? [fwd[0]] : open.slice(0, 1); // corridor: forced
}

/** Advance the world one tile: Pac to `dir`, each ghost one greedy step toward predicted Pac. */
export function stepNode(node: SNode, dir: Direction, pellets: Set<number>, traps: Set<number>): SNode {
  const pt = idToTile(node.pac);
  const npTile = neighbor(pt.col, pt.row, dir);
  // Stepping onto a wormhole endpoint lands the actor on its pair.
  const np = resolvePortal(tileToId(npTile.col, npTile.row));
  const npTileR = idToTile(np);

  const eaten = node.eaten.has(np) || !pellets.has(np) ? node.eaten : new Set(node.eaten).add(np);
  const trapsHit = node.trapsHit + (traps.has(np) ? 1 : 0);

  const ghosts: GNode[] = node.ghosts.map((g) => {
    const gt = idToTile(g.id);
    const gd = chooseDirection(gt.col, gt.row, g.dir, npTileR, false, "chase");
    const ng = neighbor(gt.col, gt.row, gd);
    return { id: resolvePortal(tileToId(ng.col, ng.row)), dir: gd };
  });

  let alive = true;
  for (let i = 0; i < ghosts.length; i++) {
    const moved = ghosts[i].id;
    const wasAt = node.ghosts[i].id;
    if (moved === np || (moved === node.pac && wasAt === np)) alive = false; // collide or swap
  }
  return { pac: np, pacDir: dir, ghosts, eaten, trapsHit, alive };
}
