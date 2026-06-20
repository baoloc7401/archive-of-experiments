// Framework-free Pac-Man engine. Holds no React state; `step` mutates a
// PacmanState in place each fixed tick. Movement is lane-locked and decisions
// are made at tile centres, matching the arcade's tile-based logic. Ghost
// targeting lives in targeting.ts; this file owns movement, the mode
// scheduler, the ghost-house lifecycle, eating, collisions and win/lose.

import {
  COLS,
  DEATH_DURATION,
  DIR_VEC,
  EXTRA_LIFE_SCORE,
  FORCE_RELEASE_SECONDS,
  FRIGHT_WARN_SECONDS,
  FRUIT_INTERVAL,
  FRUIT_POINTS,
  FRUIT_TILE,
  FRUIT_TTL,
  GATE_COL,
  GATE_EXIT,
  GHOST_HOME,
  GHOST_POINTS,
  GHOST_START,
  HOUSE_ROW,
  OPPOSITE,
  PAC_START,
  POPUP_DURATION,
  RELEASE_DOTS,
  RELEASE_ORDER,
  SCATTER_TARGET,
  SCHEDULE,
  SPEED,
  SPEED_BOOST,
  START_LIVES,
  TUNNEL_ROW,
} from "./constants";
import {
  buildBoard,
  isPassableGhost,
  isPassablePac,
  neighbor,
  tileDistanceSq,
  tileKey,
} from "./maze";
import { chaseTarget, chooseDirection, chooseFlee, tileOf, wardenDecision } from "./targeting";
import { bfsPath } from "./bfs";
import { PAC_STRATEGIES, setPortalsFromState } from "./pacai";
import { assignRoles } from "./coordination";
import { PELLET_KINDS, SPECIAL_KINDS, effectiveKind, isGoalKind } from "./pellets/registry";
import type { SpecialKind } from "./pellets/registry";
import type {
  Actor,
  Direction,
  Ghost,
  GhostId,
  GhostMode,
  GhostSnapshot,
  PacmanState,
  Snapshot,
  Tile,
} from "./types";

const EPS = 1e-4;
const GHOST_IDS: GhostId[] = ["blinky", "pinky", "inky", "clyde", "warden"];

function energizerTiles(state: PacmanState): Tile[] {
  if (!state.enabledPellets.energizer) return [];
  const out: Tile[] = [];
  for (const [key, kind] of state.board) {
    if (kind === "energizer") {
      const [col, row] = key.split(",").map(Number);
      out.push({ col, row });
    }
  }
  return out;
}

function makeEnabledPellets(): Record<SpecialKind, boolean> {
  return Object.fromEntries(SPECIAL_KINDS.map((k) => [k, true])) as Record<SpecialKind, boolean>;
}

/** Count of remaining tiles that count toward clearing the board (traps excluded). */
function goalsRemaining(state: PacmanState): number {
  let n = 0;
  for (const [key] of state.board) {
    const k = effectiveKind(state, key);
    if (k && isGoalKind(k)) n++;
  }
  return n;
}

/** The tile ghost chase-targeting aims at: the decoy phantom, or the real Pac. */
function huntPac(state: PacmanState): Actor {
  const d = state.decoy;
  if (d && d.time > 0) return { x: d.x, y: d.y, dir: d.dir };
  return state.pac;
}

function makeGhost(id: GhostId): Ghost {
  const s = GHOST_START[id];
  return {
    id,
    x: s.x,
    y: s.y,
    dir: s.dir,
    pen: id === "blinky" ? "active" : "house",
    target: { ...SCATTER_TARGET[id] },
    chosen: s.dir,
    upOverflow: false,
    retreating: false,
    hunting: false,
  };
}

export function makeInitialState(): PacmanState {
  const { board, wormholes } = buildBoard();
  let goals = 0;
  for (const kind of board.values()) if (isGoalKind(kind)) goals++;
  return {
    pac: { x: PAC_START.x, y: PAC_START.y, dir: "left" },
    desired: "left",
    ghosts: GHOST_IDS.map(makeGhost),
    enabled: { blinky: true, pinky: true, inky: true, clyde: true, warden: true },
    board,
    wormholes,
    enabledPellets: makeEnabledPellets(),
    fruit: null,
    fruitTimer: 0,
    totalPellets: goals,
    score: 0,
    lives: START_LIVES,
    status: "playing",
    deathTimer: 0,
    phaseIndex: 0,
    phaseTime: 0,
    frightTime: 0,
    freezeTime: 0,
    speedTime: 0,
    pacStunTime: 0,
    decoy: null,
    ghostCombo: 0,
    dotsEaten: 0,
    releaseTimer: 0,
    mode: SCHEDULE[0].mode,
    pacController: "human",
    pacPlan: null,
    coverageTour: null,
    coordinated: false,
    blackboard: null,
    extraLifeAwarded: false,
    popups: [],
    sfx: [],
  };
}

/**
 * Reposition the actors after a death without touching the board, score, fruit
 * or toggles. Clears the transient board effects (a death cancels them).
 */
function resetActors(state: PacmanState) {
  state.pac = { x: PAC_START.x, y: PAC_START.y, dir: "left" };
  state.desired = "left";
  state.ghosts = GHOST_IDS.map(makeGhost);
  state.pacPlan = null; // keep the controller; clear the stale plan
  state.coverageTour = null; // rebuild the sweep from the respawn position
  state.blackboard = null; // keep coordinated mode; clear the stale assignment
  state.deathTimer = 0;
  state.phaseIndex = 0;
  state.phaseTime = 0;
  state.frightTime = 0;
  state.freezeTime = 0;
  state.speedTime = 0;
  state.pacStunTime = 0;
  state.decoy = null;
  state.ghostCombo = 0;
  state.releaseTimer = 0;
  state.mode = SCHEDULE[0].mode;
  state.popups = []; // a death clears any lingering floating popups
}

/** Spawn a floating "+N"/"-N" popup at a tile (rendered, ticked, then culled). */
function pushPopup(state: PacmanState, col: number, row: number, amount: number, label?: string) {
  state.popups.push({ col, row, amount, time: 0, label });
}

/** A ghost's effective mode this frame (eyes / frightened override the global). */
export function ghostMode(state: PacmanState, g: Ghost): GhostMode {
  if (g.pen === "eaten" || g.pen === "entering") return "eaten";
  if (g.pen === "active" && state.frightTime > 0) return "frightened";
  return state.mode === "frightened" ? "scatter" : state.mode;
}

function atCenter(a: Actor): boolean {
  return Math.abs(a.x - Math.round(a.x)) < EPS && Math.abs(a.y - Math.round(a.y)) < EPS;
}

function wrapX(a: Actor) {
  if (a.x < -0.5) a.x += COLS;
  else if (a.x > COLS - 0.5) a.x -= COLS;
}

/**
 * Advance an actor along its lane by `speed * dt`, invoking `decide` at each
 * tile centre to choose the next direction. `decide` returns the chosen
 * direction, or null to stop (a blocked Pac-Man).
 */
function advance(
  a: Actor,
  speed: number,
  dt: number,
  decide: (col: number, row: number) => Direction | null,
) {
  let remaining = speed * dt;
  let guard = 0;
  while (remaining > EPS && guard++ < 8) {
    if (atCenter(a)) {
      a.x = Math.round(a.x);
      a.y = Math.round(a.y);
      const nd = decide(a.x, a.y);
      if (nd == null) return;
      a.dir = nd;
    }
    const { dx, dy } = DIR_VEC[a.dir];
    let dist: number;
    if (dx !== 0) {
      const next = atCenter(a) ? a.x + dx : dx > 0 ? Math.ceil(a.x) : Math.floor(a.x);
      dist = Math.abs(next - a.x) || 1;
    } else {
      const next = atCenter(a) ? a.y + dy : dy > 0 ? Math.ceil(a.y) : Math.floor(a.y);
      dist = Math.abs(next - a.y) || 1;
    }
    const stepLen = Math.min(remaining, dist);
    a.x += dx * stepLen;
    a.y += dy * stepLen;
    remaining -= stepLen;
    wrapX(a);
  }
}

/** Direction from a tile toward an adjacent tile, accounting for tunnel wrap. */
function dirBetween(fromCol: number, fromRow: number, to: Tile): Direction {
  let dc = to.col - fromCol;
  const dr = to.row - fromRow;
  if (dc === COLS - 1) dc = -1;
  else if (dc === -(COLS - 1)) dc = 1;
  if (Math.abs(dc) >= Math.abs(dr)) return dc > 0 ? "right" : "left";
  return dr > 0 ? "down" : "up";
}

/**
 * Warden movement (custom, non-arcade): follow the true BFS shortest path to
 * its target, and once it arrives camp the tile by bouncing in place. Unlike
 * the canonical four it is allowed to reverse - that is what lets it sit
 * tightly on the energizer it is guarding instead of orbiting it.
 */
function wardenDirection(col: number, row: number, dir: Direction, target: Tile): Direction {
  const path = bfsPath({ col, row }, target);
  if (path && path.length >= 2) return dirBetween(col, row, path[1]);
  const back = neighbor(col, row, OPPOSITE[dir]);
  if (isPassableGhost(back.col, back.row, false)) return OPPOSITE[dir];
  return dir;
}

function reverseActiveGhosts(state: PacmanState) {
  for (const g of state.ghosts) {
    if (g.pen === "active") g.dir = OPPOSITE[g.dir];
  }
}

/** Release the next eligible ghost from the pen (dot counter or force timer). */
function tryRelease(state: PacmanState) {
  for (const id of RELEASE_ORDER) {
    const g = state.ghosts.find((x) => x.id === id);
    if (!g || !state.enabled[id]) continue; // disabled ghosts never block the queue
    if (g.pen !== "house") continue;
    if (state.dotsEaten >= RELEASE_DOTS[id] || state.releaseTimer >= FORCE_RELEASE_SECONDS) {
      g.pen = "leaving";
      g.y = HOUSE_ROW;
      state.releaseTimer = 0;
    }
    return; // only the front-most penned ghost is considered each tick
  }
}

function stepGhostHouse(g: Ghost, dt: number) {
  // Bob up and down inside the house until released.
  const speed = SPEED.ghost * 0.45;
  const homeCol = GHOST_HOME[g.id].col;
  g.x = homeCol;
  if (g.dir !== "up" && g.dir !== "down") g.dir = "up";
  g.y += (g.dir === "up" ? -1 : 1) * speed * dt;
  if (g.y <= 13) {
    g.y = 13;
    g.dir = "down";
  } else if (g.y >= 15) {
    g.y = 15;
    g.dir = "up";
  }
}

function stepGhostLeaving(g: Ghost, dt: number) {
  const speed = SPEED.ghost;
  const move = speed * dt;
  if (Math.abs(g.x - GATE_COL) > EPS) {
    g.y = HOUSE_ROW;
    const step = Math.min(move, Math.abs(g.x - GATE_COL));
    g.dir = g.x < GATE_COL ? "right" : "left";
    g.x += (g.dir === "right" ? 1 : -1) * step;
    return;
  }
  g.x = GATE_COL;
  g.dir = "up";
  g.y -= move;
  if (g.y <= GATE_EXIT.row) {
    g.y = GATE_EXIT.row;
    g.pen = "active";
    g.dir = "left";
  }
}

function stepGhostEntering(g: Ghost, dt: number) {
  const speed = SPEED.eaten;
  const move = speed * dt;
  const homeCol = GHOST_HOME[g.id].col;
  if (g.y < HOUSE_ROW) {
    g.x = GATE_COL;
    g.dir = "down";
    g.y = Math.min(HOUSE_ROW, g.y + move);
    return;
  }
  g.y = HOUSE_ROW;
  if (Math.abs(g.x - homeCol) > EPS) {
    g.dir = g.x < homeCol ? "right" : "left";
    g.x += (g.dir === "right" ? 1 : -1) * Math.min(move, Math.abs(g.x - homeCol));
    return;
  }
  g.x = homeCol;
  g.pen = "leaving"; // regenerated - head back out
}

function ghostSpeed(g: Ghost, em: GhostMode): number {
  if (em === "eaten") return SPEED.eaten;
  if (em === "frightened") return SPEED.frightened;
  if (Math.round(g.y) === TUNNEL_ROW) return SPEED.tunnel;
  return SPEED.ghost;
}

/**
 * Coordinated mode's per-tick role assignment, or null when it does not apply
 * (mode off, frightened, scattering, or no active chasers). Built over the
 * hunted target so a decoy still misdirects the whole pack.
 */
function computeBlackboard(state: PacmanState): PacmanState["blackboard"] {
  if (!state.coordinated || state.frightTime > 0 || state.mode !== "chase") return null;
  const active = state.ghosts.filter((g) => state.enabled[g.id] && g.pen === "active");
  if (active.length === 0) return null;
  const hp = huntPac(state);
  return assignRoles(active, tileOf(hp), hp.dir);
}

function stepGhostActive(state: PacmanState, g: Ghost, dt: number) {
  const em = ghostMode(state, g);

  // Resolve the target tile for this frame.
  g.role = undefined;
  const coord = em === "chase" ? state.blackboard?.get(g.id) : undefined;
  if (em === "eaten") {
    g.target = { ...GATE_EXIT };
    g.upOverflow = false;
    g.retreating = false;
  } else if (em === "frightened") {
    g.target = tileOf(state.pac);
    g.upOverflow = false;
    g.retreating = false;
  } else if (coord) {
    // Coordinated chase: take the blackboard's role + station instead of the
    // ghost's own heuristic. (Movement rule below is unchanged.)
    g.target = { ...coord.target };
    g.role = coord.role;
    g.hunting = false;
    g.upOverflow = false;
    g.retreating = false;
  } else if (g.id === "warden") {
    // Custom guardian: guard the nearest energizer, hunt Pac-Man, or pounce.
    // A live decoy hijacks the "Pac-Man" it hunts.
    const hp = huntPac(state);
    const dec = wardenDecision(tileOf(hp), hp.dir, tileOf(g), energizerTiles(state));
    g.target = dec.target;
    g.hunting = dec.hunting;
    g.upOverflow = false;
    g.retreating = false;
  } else if (em === "scatter") {
    g.target = { ...SCATTER_TARGET[g.id] };
    g.upOverflow = false;
    g.retreating = false;
  } else {
    // Chase: a live decoy makes the ghosts target the phantom, not the real Pac.
    const blinky = state.ghosts.find((x) => x.id === "blinky") ?? state.ghosts[0];
    const res = chaseTarget(g, huntPac(state), blinky);
    g.target = res.target;
    g.upOverflow = res.upOverflow;
    g.retreating = res.retreating;
  }

  const throughGate = em === "eaten";
  const speed = ghostSpeed(g, em);

  advance(g, speed, dt, (col, row) => {
    let dir: Direction;
    if (em === "frightened") {
      dir = chooseFlee(col, row, g.dir, tileOf(state.pac), false);
    } else if (g.id === "warden" && em !== "eaten") {
      dir = wardenDirection(col, row, g.dir, g.target);
    } else {
      dir = chooseDirection(col, row, g.dir, g.target, throughGate, em);
    }
    g.chosen = dir;
    return dir;
  });

  // Eyes that have reached the gate exit descend into the house.
  if (em === "eaten" && Math.round(g.x) === GATE_EXIT.col && Math.round(g.y) === GATE_EXIT.row) {
    g.x = GATE_EXIT.col;
    g.y = GATE_EXIT.row;
    g.pen = "entering";
  }
}

function stepPac(state: PacmanState, dt: number) {
  const pac = state.pac;
  const ctrl = state.pacController;
  if (state.pacStunTime > 0) return; // stunned by a trap: hold position
  const speed = SPEED.pac * (state.speedTime > 0 ? SPEED_BOOST : 1);

  if (ctrl !== "human") {
    // AI driver: the active strategy decides at each tile centre. The plan is
    // stashed for the overlay; the returned direction feeds the same movement.
    const strat = PAC_STRATEGIES[ctrl];
    advance(pac, speed, dt, (col, row) => {
      setPortalsFromState(state); // make wormhole edges visible to the graph searches
      const plan = strat.choose(state, col, row);
      state.pacPlan = plan;
      const want = neighbor(col, row, plan.dir);
      if (isPassablePac(want.col, want.row)) return plan.dir;
      const ahead = neighbor(col, row, pac.dir);
      if (isPassablePac(ahead.col, ahead.row)) return pac.dir;
      return null;
    });
    return;
  }

  // Human: buffered turn, with an immediate reverse mid-lane for responsiveness.
  if (state.pacPlan) state.pacPlan = null;
  if (state.desired === OPPOSITE[pac.dir]) pac.dir = state.desired;
  advance(pac, speed, dt, (col, row) => {
    const want = neighbor(col, row, state.desired);
    if (isPassablePac(want.col, want.row)) return state.desired;
    const ahead = neighbor(col, row, pac.dir);
    if (isPassablePac(ahead.col, ahead.row)) return pac.dir;
    return null;
  });
}

function eatContent(state: PacmanState) {
  const col = Math.round(state.pac.x);
  const row = Math.round(state.pac.y);
  const key = tileKey(col, row);

  // Transient bonus fruit.
  if (state.fruit) {
    const fk = tileKey(state.fruit.tile.col, state.fruit.tile.row);
    if (fk === key) {
      state.score += FRUIT_POINTS;
      state.fruit = null;
      pushPopup(state, col, row, FRUIT_POINTS);
      state.sfx.push("fruit");
    }
  }

  const kind = effectiveKind(state, key);
  if (!kind) return;
  const def = PELLET_KINDS[kind];
  state.board.delete(key);
  const before = state.score;
  state.score += def.points;
  if (isGoalKind(kind)) state.dotsEaten += 1;
  def.onEat?.(state); // a trap docks points here, so read the net delta below
  if (kind === "energizer") reverseActiveGhosts(state);

  // A distinct sound cue per kind (dots get the alternating waka). This relies on
  // every non-dot PelletKind name also being a valid SfxCue tag - adding a pellet
  // kind without a matching cue is caught here by tsc.
  state.sfx.push(kind === "dot" ? "chomp" : kind);

  // Float the net score change wherever the score mutates, up or down - dots
  // included (rendered smaller, so a stream of "+10"s stays subtle).
  const delta = state.score - before;
  if (delta !== 0) pushPopup(state, col, row, delta);
}

/** Bonus fruit spawner: appears on a timer, lingers, then vanishes. */
function updateFruit(state: PacmanState, dt: number) {
  if (!state.enabledPellets.fruit) {
    state.fruit = null;
    return;
  }
  if (state.fruit) {
    state.fruit.ttl -= dt;
    if (state.fruit.ttl <= 0) state.fruit = null;
    return;
  }
  state.fruitTimer += dt;
  if (state.fruitTimer >= FRUIT_INTERVAL) {
    state.fruitTimer = 0;
    state.fruit = { tile: { ...FRUIT_TILE }, ttl: FRUIT_TTL };
    state.sfx.push("fruitspawn");
  }
}

/** Wormhole transport: entering one endpoint relocates an actor to the other. */
function teleportActor(state: PacmanState, a: Actor) {
  const id = Math.round(a.y) * COLS + Math.round(a.x);
  if (a.atTile === id) return; // already handled while sitting on this tile
  const dest = state.enabledPellets.teleport
    ? state.wormholes.get(tileKey(Math.round(a.x), Math.round(a.y)))
    : undefined;
  if (dest) {
    const [dc, dr] = dest.split(",").map(Number);
    a.x = dc;
    a.y = dr;
    a.atTile = dr * COLS + dc; // land on the exit without re-triggering
  } else {
    a.atTile = id;
  }
}

function applyTeleports(state: PacmanState) {
  teleportActor(state, state.pac);
  for (const g of state.ghosts) if (state.enabled[g.id]) teleportActor(state, g);
}

function handleCollisions(state: PacmanState): "none" | "death" {
  const pacTile = tileOf(state.pac);
  for (const g of state.ghosts) {
    if (!state.enabled[g.id]) continue;
    if (Math.round(g.x) !== pacTile.col || Math.round(g.y) !== pacTile.row) continue;
    const em = ghostMode(state, g);
    if (em === "frightened") {
      g.pen = "eaten";
      const pts = GHOST_POINTS[Math.min(state.ghostCombo, GHOST_POINTS.length - 1)];
      state.score += pts;
      state.ghostCombo += 1;
      pushPopup(state, Math.round(g.x), Math.round(g.y), pts);
      state.sfx.push("eatghost");
    } else if (g.pen === "active" && (em === "scatter" || em === "chase")) {
      return "death";
    }
  }
  return "none";
}

function advanceSchedule(state: PacmanState, dt: number) {
  if (state.frightTime > 0) return; // schedule timer pauses while frightened
  const phase = SCHEDULE[state.phaseIndex];
  if (phase.seconds === Infinity) return;
  state.phaseTime += dt;
  if (state.phaseTime >= phase.seconds && state.phaseIndex < SCHEDULE.length - 1) {
    state.phaseIndex += 1;
    state.phaseTime = 0;
    state.mode = SCHEDULE[state.phaseIndex].mode;
    reverseActiveGhosts(state);
  }
}

/** Advance the whole simulation by one fixed tick. */
export function step(state: PacmanState, dt: number) {
  // Death sequence: hold everything frozen while Pac-Man's animation plays, then
  // respawn the board (or end the game if no lives remain).
  if (state.status === "dying") {
    state.deathTimer += dt;
    if (state.deathTimer >= DEATH_DURATION) {
      state.lives -= 1;
      if (state.lives < 0) {
        state.lives = 0;
        state.status = "lost";
      } else {
        resetActors(state);
        state.status = "playing";
      }
    }
    return;
  }
  if (state.status !== "playing") return;

  state.releaseTimer += dt;
  tryRelease(state);
  advanceSchedule(state, dt);

  // Tick down the timed board effects.
  if (state.frightTime > 0) {
    const prev = state.frightTime;
    state.frightTime = Math.max(0, state.frightTime - dt);
    // One "running out" blip as the timer dips past the warning threshold.
    if (prev > FRIGHT_WARN_SECONDS && state.frightTime <= FRIGHT_WARN_SECONDS && state.frightTime > 0) {
      state.sfx.push("frightwarn");
    }
  }
  if (state.freezeTime > 0) state.freezeTime = Math.max(0, state.freezeTime - dt);
  if (state.speedTime > 0) state.speedTime = Math.max(0, state.speedTime - dt);
  if (state.pacStunTime > 0) state.pacStunTime = Math.max(0, state.pacStunTime - dt);
  if (state.decoy) {
    state.decoy.time -= dt;
    if (state.decoy.time <= 0) state.decoy = null;
  }
  updateFruit(state, dt);

  // Age and cull the floating score popups in place (zero-alloc compaction).
  if (state.popups.length) {
    let w = 0;
    for (let i = 0; i < state.popups.length; i++) {
      const p = state.popups[i];
      p.time += dt;
      if (p.time < POPUP_DURATION) state.popups[w++] = p;
    }
    state.popups.length = w;
  }

  stepPac(state, dt);
  eatContent(state);

  // Coordinated mode: rebuild the shared blackboard for this tick (chase only).
  state.blackboard = computeBlackboard(state);

  // Freeze pellet: ghosts hold position entirely while it is active.
  if (state.freezeTime <= 0) {
    for (const g of state.ghosts) {
      if (!state.enabled[g.id]) continue; // switched off: frozen and harmless
      if (g.pen === "house") stepGhostHouse(g, dt);
      else if (g.pen === "leaving") stepGhostLeaving(g, dt);
      else if (g.pen === "entering") stepGhostEntering(g, dt);
      else stepGhostActive(state, g, dt);
    }
  }

  applyTeleports(state);

  // A same-tile overlap with a lethal ghost starts the death animation; the
  // lives/respawn bookkeeping happens when that animation finishes (above).
  if (handleCollisions(state) === "death") {
    state.status = "dying";
    state.deathTimer = 0;
    state.popups = []; // drop floating popups so they do not freeze mid-death
    state.sfx.push("death");
    return;
  }

  // Bonus life the first time the score crosses the 1UP threshold.
  if (!state.extraLifeAwarded && state.score >= EXTRA_LIFE_SCORE) {
    state.extraLifeAwarded = true;
    state.lives += 1;
    pushPopup(state, Math.round(state.pac.x), Math.round(state.pac.y), 0, "1UP");
    state.sfx.push("extralife");
  }

  if (goalsRemaining(state) === 0) {
    state.status = "won";
    state.sfx.push("win");
  }
}

function ghostDistance(state: PacmanState, g: Ghost): number {
  return Math.round(Math.sqrt(tileDistanceSq(tileOf(g), tileOf(state.pac))));
}

export function computeSnapshot(state: PacmanState): Snapshot {
  const ghosts: GhostSnapshot[] = state.ghosts.map((g) => ({
    id: g.id,
    mode: ghostMode(state, g),
    pen: g.pen,
    target: g.target,
    chosen: g.chosen,
    distance: ghostDistance(state, g),
    upOverflow: g.upOverflow,
    retreating: g.retreating,
    hunting: g.hunting,
    role: g.role ?? null,
  }));
  return {
    status: state.status,
    score: state.score,
    lives: state.lives,
    pelletsLeft: goalsRemaining(state),
    totalPellets: state.totalPellets,
    mode: state.frightTime > 0 ? "frightened" : state.mode,
    frightened: state.frightTime > 0,
    ghosts,
    pac: {
      controller: state.pacController,
      noteKey: state.pacController === "human" ? "human" : state.pacPlan?.noteKey ?? "idle",
      target: state.pacController === "human" ? null : state.pacPlan?.target ?? null,
    },
    effects: {
      frightened: state.frightTime,
      freeze: state.freezeTime,
      speed: state.speedTime,
      stun: state.pacStunTime,
      decoy: state.decoy?.time ?? 0,
    },
    fruit: state.fruit !== null,
  };
}
