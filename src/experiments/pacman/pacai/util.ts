import { isPassablePac, neighbor } from "../maze";
import type { Direction, PacmanState } from "../types";
import { tileToId } from "./graph";

/** Pac-Man's current tile id. */
export function pacId(state: PacmanState): number {
  return tileToId(Math.round(state.pac.x), Math.round(state.pac.y));
}

/** Ids of every remaining pellet and energizer. */
export function pelletIds(state: PacmanState): Set<number> {
  const out = new Set<number>();
  for (const key of state.pellets) {
    const [c, r] = key.split(",").map(Number);
    out.add(tileToId(c, r));
  }
  for (const key of state.energizers) {
    const [c, r] = key.split(",").map(Number);
    out.add(tileToId(c, r));
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
