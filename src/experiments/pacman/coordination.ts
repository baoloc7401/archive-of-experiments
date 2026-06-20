// Coordinated ghost mode (opt-in). Instead of each ghost chasing on its own
// heuristic, the active chasers share a blackboard and split roles to *surround*
// Pac-Man: one presses his tile (chaser), one cuts off the tile ahead of his
// heading (ambusher), and the rest take the two flanks (cutters) or hang back
// (lurker). The assignment is the teaching point - roles go to whichever ghost
// can reach each station soonest (greedy minimum-cost matching over true
// shortest-path distances), so the pincer emerges from who is where.
//
// This only sets each ghost's *target tile*; the movement rule (greedy turn, or
// the Warden's path-follow) is unchanged, keeping with the experiment's "every
// ghost moves the same way, they differ only in target" philosophy.

import { COLS, COORD_LOOKAHEAD, COORD_RING, DIR_VEC, ROWS, TIE_ORDER } from "./constants";
import { isPassableGhost, neighbor } from "./maze";
import type { CoordAssignment, Direction, Ghost, GhostId, GhostRole, Tile } from "./types";

const tileId = (col: number, row: number) => row * COLS + col;

// Reused BFS scratch (single agent, called serially per tick - no realloc).
const seen = new Int32Array(COLS * ROWS);
const queue = new Int32Array(COLS * ROWS);

/**
 * Shortest-path distance (in tiles, ghost-passable, tunnel-wrapped) from a
 * station to each given ghost. Stops once every ghost is reached.
 */
function distsToGhosts(station: Tile, ghosts: Ghost[]): Map<GhostId, number> {
  const out = new Map<GhostId, number>();
  if (ghosts.length === 0) return out;
  // Group ghosts by the tile they occupy so co-located ghosts both resolve.
  const want = new Map<number, GhostId[]>();
  for (const g of ghosts) {
    const k = tileId(Math.round(g.x), Math.round(g.y));
    const list = want.get(k);
    if (list) list.push(g.id);
    else want.set(k, [g.id]);
  }

  seen.fill(-1);
  const startId = tileId(station.col, station.row);
  seen[startId] = 0;
  let head = 0;
  let tail = 0;
  queue[tail++] = startId;
  const collect = (id: number, d: number) => {
    const list = want.get(id);
    if (list) for (const gid of list) if (!out.has(gid)) out.set(gid, d);
  };
  collect(startId, 0);

  while (head < tail && out.size < ghosts.length) {
    const cur = queue[head++];
    const cc = cur % COLS;
    const cr = (cur - cc) / COLS;
    for (const dir of TIE_ORDER) {
      const n = neighbor(cc, cr, dir);
      if (!isPassableGhost(n.col, n.row, false)) continue;
      const nk = tileId(n.col, n.row);
      if (seen[nk] >= 0) continue;
      seen[nk] = seen[cur] + 1;
      collect(nk, seen[nk]);
      queue[tail++] = nk;
    }
  }
  return out;
}

/** Snap an ideal station (which may land on a wall or off-board) to the nearest free tile. */
function nearestPassable(col0: number, row0: number): Tile {
  const col = ((col0 % COLS) + COLS) % COLS;
  const row = Math.max(0, Math.min(ROWS - 1, row0));
  if (isPassableGhost(col, row, false)) return { col, row };
  for (let rad = 1; rad <= COORD_RING; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue; // ring perimeter only
        const r = row + dr;
        if (r < 0 || r >= ROWS) continue;
        const c = ((col + dc) % COLS + COLS) % COLS;
        if (isPassableGhost(c, r, false)) return { col: c, row: r };
      }
    }
  }
  return { col, row };
}

/**
 * Build this tick's blackboard: assign every active chasing ghost a role + target
 * tile so they surround Pac-Man. `pacTile`/`pacDir` come from the hunted target
 * (the decoy phantom when one is active, so coordination chases the fake too).
 */
export function assignRoles(
  ghosts: Ghost[],
  pacTile: Tile,
  pacDir: Direction,
): Map<GhostId, CoordAssignment> {
  const L = COORD_LOOKAHEAD;
  const v = DIR_VEC[pacDir];
  // A vector perpendicular to Pac's heading, for the two flank stations.
  const perp = pacDir === "up" || pacDir === "down" ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };

  // Stations in priority order; the role label is fixed per station.
  const stations: { role: GhostRole; tile: Tile }[] = [
    { role: "chaser", tile: pacTile },
    { role: "ambusher", tile: nearestPassable(pacTile.col + v.dx * L, pacTile.row + v.dy * L) },
    { role: "cutter", tile: nearestPassable(pacTile.col + perp.dx * L, pacTile.row + perp.dy * L) },
    { role: "cutter", tile: nearestPassable(pacTile.col - perp.dx * L, pacTile.row - perp.dy * L) },
  ];

  const out = new Map<GhostId, CoordAssignment>();
  const remaining = ghosts.slice();
  for (const st of stations) {
    if (remaining.length === 0) break;
    const dists = distsToGhosts(st.tile, remaining);
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = dists.get(remaining[i].id);
      if (d !== undefined && d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) bestIdx = 0; // unreachable: still give the station to someone
    const g = remaining.splice(bestIdx, 1)[0];
    out.set(g.id, { role: st.role, target: st.tile });
  }
  // Any extras (e.g. the Warden as a 5th) hang back as a lurker on Pac's tile.
  for (const g of remaining) out.set(g.id, { role: "lurker", target: pacTile });
  return out;
}
