// The four ghost targeting heuristics and the shared greedy intersection
// chooser. Pure functions - no React, no mutation of inputs. This is the heart
// of the experiment: each ghost differs only in how it computes its target
// tile; the movement rule below is identical for all of them.

import {
  CLYDE_RADIUS,
  DIR_VEC,
  NO_UP_TILES,
  OPPOSITE,
  SCATTER_TARGET,
  TIE_ORDER,
  WARDEN_GUARD_RADIUS,
  WARDEN_OPPORTUNISM,
} from "./constants";
import { isPassableGhost, neighbor, tileDistanceSq, tileKey } from "./maze";
import type { Actor, Direction, Ghost, GhostMode, Tile } from "./types";

export function tileOf(a: { x: number; y: number }): Tile {
  return { col: Math.round(a.x), row: Math.round(a.y) };
}

/**
 * Tile `n` steps ahead of Pac-Man along his heading. Faithfully reproduces the
 * original overflow bug: when Pac-Man faces up the offset also shifts `n` tiles
 * left. `overflow` is true whenever that buggy left-shift was applied.
 */
export function offsetAhead(
  pacTile: Tile,
  pacDir: Direction,
  n: number,
): { tile: Tile; overflow: boolean } {
  switch (pacDir) {
    case "up":
      return { tile: { col: pacTile.col - n, row: pacTile.row - n }, overflow: true };
    case "down":
      return { tile: { col: pacTile.col, row: pacTile.row + n }, overflow: false };
    case "left":
      return { tile: { col: pacTile.col - n, row: pacTile.row }, overflow: false };
    case "right":
      return { tile: { col: pacTile.col + n, row: pacTile.row }, overflow: false };
  }
}

export interface TargetResult {
  target: Tile;
  upOverflow: boolean;
  retreating: boolean;
}

/** Blinky: chase Pac-Man's current tile directly. */
export function blinkyTarget(pacTile: Tile): TargetResult {
  return { target: pacTile, upOverflow: false, retreating: false };
}

/** Pinky: four tiles ahead of Pac-Man (with the up-overflow bug). */
export function pinkyTarget(pacTile: Tile, pacDir: Direction): TargetResult {
  const { tile, overflow } = offsetAhead(pacTile, pacDir, 4);
  return { target: tile, upOverflow: overflow, retreating: false };
}

/**
 * Inky: take the tile two ahead of Pac-Man (with overflow), draw the vector
 * from Blinky to it, and double it. Depends on Blinky's live position.
 */
export function inkyTarget(pacTile: Tile, pacDir: Direction, blinkyTile: Tile): TargetResult {
  const { tile: pivot, overflow } = offsetAhead(pacTile, pacDir, 2);
  return {
    target: {
      col: pivot.col * 2 - blinkyTile.col,
      row: pivot.row * 2 - blinkyTile.row,
    },
    upOverflow: overflow,
    retreating: false,
  };
}

/** Clyde: chase like Blinky when far, flee to his corner within 8 tiles. */
export function clydeTarget(clydeTile: Tile, pacTile: Tile): TargetResult {
  const near = tileDistanceSq(clydeTile, pacTile) <= CLYDE_RADIUS * CLYDE_RADIUS;
  return {
    target: near ? SCATTER_TARGET.clyde : pacTile,
    upOverflow: false,
    retreating: near,
  };
}

/**
 * Warden (custom, non-arcade): guard the energizer closest to Pac-Man, racing
 * to sit on it before he can. Falls back to chasing Pac-Man's tile once every
 * energizer is gone.
 */
export function wardenTarget(pacTile: Tile, energizers: Tile[]): TargetResult {
  if (energizers.length === 0) {
    return { target: pacTile, upOverflow: false, retreating: false };
  }
  let best = energizers[0];
  let bestD = tileDistanceSq(best, pacTile);
  for (let i = 1; i < energizers.length; i++) {
    const d = tileDistanceSq(energizers[i], pacTile);
    if (d < bestD) {
      bestD = d;
      best = energizers[i];
    }
  }
  return { target: best, upOverflow: false, retreating: false };
}

export interface WardenDecision {
  target: Tile;
  /** True when the Warden is chasing Pac-Man rather than guarding an energizer. */
  hunting: boolean;
}

/**
 * Warden's per-frame intent (custom, non-arcade). It guards the energizer
 * nearest Pac-Man while he is threatening it (heading toward it or already
 * close), but switches to hunting Pac-Man directly when his intent is clearly
 * elsewhere - and pounces opportunistically whenever Pac-Man is catchable.
 */
export function wardenDecision(
  pacTile: Tile,
  pacDir: Direction,
  wardenTile: Tile,
  energizers: Tile[],
): WardenDecision {
  if (energizers.length === 0) return { target: pacTile, hunting: true };
  const nearestE = wardenTarget(pacTile, energizers).target;

  // Opportunism: Pac-Man is within striking range, so go for the kill.
  if (tileDistanceSq(wardenTile, pacTile) <= WARDEN_OPPORTUNISM * WARDEN_OPPORTUNISM) {
    return { target: pacTile, hunting: true };
  }

  // Read intent: is Pac-Man stepping toward the energizer, or already near it?
  const pacNext: Tile = {
    col: pacTile.col + DIR_VEC[pacDir].dx,
    row: pacTile.row + DIR_VEC[pacDir].dy,
  };
  const headingToward = tileDistanceSq(pacNext, nearestE) < tileDistanceSq(pacTile, nearestE);
  const nearE = tileDistanceSq(pacTile, nearestE) <= WARDEN_GUARD_RADIUS * WARDEN_GUARD_RADIUS;
  if (headingToward || nearE) return { target: nearestE, hunting: false };

  // Intent is elsewhere - hunt him down.
  return { target: pacTile, hunting: true };
}

/** Resolve a ghost's chase/scatter target for the current frame. */
export function chaseTarget(ghost: Ghost, pac: Actor, blinky: Ghost): TargetResult {
  const pacTile = tileOf(pac);
  switch (ghost.id) {
    case "blinky":
      return blinkyTarget(pacTile);
    case "pinky":
      return pinkyTarget(pacTile, pac.dir);
    case "inky":
      return inkyTarget(pacTile, pac.dir, tileOf(blinky));
    case "clyde":
      return clydeTarget(tileOf(ghost), pacTile);
    default:
      // Warden is resolved by wardenTarget in the simulation; fall back to a
      // direct chase here for exhaustiveness.
      return blinkyTarget(pacTile);
  }
}

/**
 * Greedy decision at a tile: of the legal exits (no reverse, gate rules, and
 * the no-up restriction in scatter/chase), pick the one whose neighbour tile is
 * closest in straight-line distance to `target`. Ties break up > left > down >
 * right. Falls back to reversing only at a genuine dead end.
 */
export function chooseDirection(
  fromCol: number,
  fromRow: number,
  dir: Direction,
  target: Tile,
  throughGate: boolean,
  mode: GhostMode,
): Direction {
  const back = OPPOSITE[dir];
  const restrictUp = mode === "scatter" || mode === "chase";
  let best: Direction | null = null;
  let bestDist = Infinity;

  // Iterate in tie-break priority so equal distances keep the first (best) one.
  for (const d of TIE_ORDER) {
    if (d === back) continue;
    if (d === "up" && restrictUp && NO_UP_TILES.has(tileKey(fromCol, fromRow))) continue;
    const n = neighbor(fromCol, fromRow, d);
    if (!isPassableGhost(n.col, n.row, throughGate)) continue;
    const dist = tileDistanceSq(n, target);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best ?? back;
}

/**
 * Frightened movement (improvement over the arcade's pure random walk): of the
 * legal non-reverse exits, take the one that gets *farthest* from Pac-Man, so a
 * frightened ghost actively flees rather than wandering. Ties keep the standard
 * up > left > down > right preference.
 */
export function chooseFlee(
  fromCol: number,
  fromRow: number,
  dir: Direction,
  pacTile: Tile,
  throughGate: boolean,
): Direction {
  const back = OPPOSITE[dir];
  let best: Direction | null = null;
  let bestDist = -Infinity;
  for (const d of TIE_ORDER) {
    if (d === back) continue;
    const n = neighbor(fromCol, fromRow, d);
    if (!isPassableGhost(n.col, n.row, throughGate)) continue;
    const dist = tileDistanceSq(n, pacTile);
    if (dist > bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best ?? back;
}
