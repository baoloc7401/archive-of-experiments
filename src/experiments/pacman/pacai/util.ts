import { isPassablePac, neighbor } from "../maze";
import { effectiveKind, isGoalKind } from "../pellets/registry";
import type { Direction, PacmanState } from "../types";
import { tileToId } from "./graph";

/** Pac-Man's current tile id. */
export function pacId(state: PacmanState): number {
  return tileToId(Math.round(state.pac.x), Math.round(state.pac.y));
}

/**
 * Ids of every tile worth eating - what the AI aims for. Traps are excluded
 * (non-goal hazards routed around, see {@link trapIds}); disabled specials read
 * as plain dots and are included; the live bonus fruit is included while it is
 * on the board (200 points the driver should grab before it expires).
 */
export function pelletIds(state: PacmanState): Set<number> {
  const out = new Set<number>();
  for (const [key] of state.board) {
    const kind = effectiveKind(state, key);
    if (kind && isGoalKind(kind)) {
      const [c, r] = key.split(",").map(Number);
      out.add(tileToId(c, r));
    }
  }
  if (state.fruit) out.add(tileToId(state.fruit.tile.col, state.fruit.tile.row));
  return out;
}

/** Ids of active trap tiles - hazards every driver routes around. */
export function trapIds(state: PacmanState): Set<number> {
  const out = new Set<number>();
  for (const [key] of state.board) {
    if (effectiveKind(state, key) === "trap") {
      const [c, r] = key.split(",").map(Number);
      out.add(tileToId(c, r));
    }
  }
  return out;
}

/** Ids of active energizer tiles - the "turn the tables" escape when cornered. */
export function energizerIds(state: PacmanState): Set<number> {
  const out = new Set<number>();
  for (const [key] of state.board) {
    if (effectiveKind(state, key) === "energizer") {
      const [c, r] = key.split(",").map(Number);
      out.add(tileToId(c, r));
    }
  }
  return out;
}

/** A safe legal direction to keep moving when no plan is available. */
export function fallbackDir(col: number, row: number, prev: Direction): Direction {
  const ahead = neighbor(col, row, prev);
  if (isPassablePac(ahead.col, ahead.row)) return prev;
  for (const d of ["up", "left", "down", "right"] as Direction[]) {
    const n = neighbor(col, row, d);
    if (isPassablePac(n.col, n.row)) return d;
  }
  return prev;
}
