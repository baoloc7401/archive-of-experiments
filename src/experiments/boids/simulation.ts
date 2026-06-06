import {
  DEG,
  EDGE_AVOID_WEIGHT,
  EDGE_MARGIN,
  FLOW_SCALE,
  GOAL_REACH,
  GOAL_WEIGHT,
  GRID_MIN_CELLS,
  HAWK_CATCH,
  HAWK_FLEE_RADIUS,
  HAWK_FLEE_WEIGHT,
  HAWK_SPEED_FACTOR,
  HAWK_TURN,
  MAX_FORCE,
  MIN_SPEED_FRAC,
  OBSTACLE_MARGIN,
  OBSTACLE_WEIGHT,
  PREDATOR_RADIUS,
  PREDATOR_WEIGHT,
  SEP_RADIUS_FACTOR,
} from "./constants";
import { respawnAtEdge } from "./flock";
import type { BoidParams, BoidSnapshot, Flock, Pointer, World } from "./types";

/** Reusable per-tick buffers, allocated once at capacity (head grows lazily). */
export interface Scratch {
  accX: Float64Array;
  accY: Float64Array;
  next: Int32Array;
  head: Int32Array;
  density: Int32Array;
}

export function makeScratch(capacity: number): Scratch {
  return {
    accX: new Float64Array(capacity),
    accY: new Float64Array(capacity),
    next: new Int32Array(capacity),
    head: new Int32Array(0),
    density: new Int32Array(capacity),
  };
}

/** Shortest signed delta on a wrapped (toroidal) axis. */
export function wrapDelta(d: number, size: number): number {
  if (d > size * 0.5) return d - size;
  if (d < -size * 0.5) return d + size;
  return d;
}

// Per-boid neighbor accumulators, reused across boids (reset between each).
interface Sums {
  sX: number;
  sY: number;
  sC: number;
  aX: number;
  aY: number;
  aC: number;
  cX: number;
  cY: number;
  cC: number;
}

function newSums(): Sums {
  return { sX: 0, sY: 0, sC: 0, aX: 0, aY: 0, aC: 0, cX: 0, cY: 0, cC: 0 };
}

function resetSums(s: Sums): void {
  s.sX = 0;
  s.sY = 0;
  s.sC = 0;
  s.aX = 0;
  s.aY = 0;
  s.aC = 0;
  s.cX = 0;
  s.cY = 0;
  s.cC = 0;
}

// Fold neighbor `o` into `sums`. Separation acts on all neighbors; alignment and
// cohesion only when `sameRules` (same species, or species off). Returns true if
// `o` is within the perception radius+cone (for neighbor-count / focus use).
function gatherInto(
  sums: Sums,
  bx: number,
  by: number,
  bvx: number,
  bvy: number,
  ox: number,
  oy: number,
  ovx: number,
  ovy: number,
  w: number,
  h: number,
  r2: number,
  sepR2: number,
  wrap: boolean,
  applyFov: boolean,
  cosFov: number,
  sameRules: boolean,
): boolean {
  const dx = wrap ? wrapDelta(bx - ox, w) : bx - ox;
  const dy = wrap ? wrapDelta(by - oy, h) : by - oy;
  const d2 = dx * dx + dy * dy;
  if (d2 > r2 || d2 === 0) return false;
  if (applyFov) {
    const v2 = bvx * bvx + bvy * bvy;
    if (v2 > 1e-6) {
      const dot = -(bvx * dx + bvy * dy);
      if (dot < cosFov * Math.sqrt(v2 * d2)) return false; // behind the blind spot
    }
  }
  if (d2 < sepR2) {
    const inv = 1 / d2; // inverse-square so the closest neighbors push hardest
    sums.sX += dx * inv;
    sums.sY += dy * inv;
    sums.sC++;
  }
  if (sameRules) {
    sums.aX += ovx;
    sums.aY += ovy;
    sums.aC++;
    sums.cX -= dx;
    sums.cY -= dy;
    sums.cC++;
  }
  return true;
}

// Reynolds: steer = setMag(desired, maxSpeed) - velocity, clamped to maxForce.
function addSteer(
  out: [number, number],
  dirX: number,
  dirY: number,
  vx: number,
  vy: number,
  maxSpeed: number,
  weight: number,
): void {
  const m = Math.hypot(dirX, dirY);
  if (m === 0) return;
  let sx = (dirX / m) * maxSpeed - vx;
  let sy = (dirY / m) * maxSpeed - vy;
  const sm = Math.hypot(sx, sy);
  if (sm > MAX_FORCE) {
    const f = MAX_FORCE / sm;
    sx *= f;
    sy *= f;
  }
  out[0] += sx * weight;
  out[1] += sy * weight;
}

// Resolve gathered sums into the three weighted steering vectors. Shared by the
// simulation step and the focus overlay so they can never drift apart.
function combineForces(
  sums: Sums,
  vx: number,
  vy: number,
  p: BoidParams,
  sep: [number, number],
  ali: [number, number],
  coh: [number, number],
): void {
  sep[0] = 0;
  sep[1] = 0;
  ali[0] = 0;
  ali[1] = 0;
  coh[0] = 0;
  coh[1] = 0;
  if (sums.sC > 0) addSteer(sep, sums.sX, sums.sY, vx, vy, p.maxSpeed, p.separation);
  if (sums.aC > 0) addSteer(ali, sums.aX / sums.aC, sums.aY / sums.aC, vx, vy, p.maxSpeed, p.alignment);
  if (sums.cC > 0) addSteer(coh, sums.cX / sums.cC, sums.cY / sums.cC, vx, vy, p.maxSpeed, p.cohesion);
}

/** Drifting pseudo-noise flow field direction at (x, y, t). */
function flowAngle(x: number, y: number, t: number): number {
  return (
    (Math.sin(x * FLOW_SCALE + t) +
      Math.cos(y * FLOW_SCALE - t * 0.8) +
      Math.sin((x + y) * FLOW_SCALE * 0.6 + t * 0.5)) *
    1.1
  );
}

// Move every predator toward its nearest boid and respawn any boid it catches.
function updatePredators(flock: Flock, world: World, p: BoidParams, w: number, h: number): void {
  const preds = world.predators;
  if (preds.length === 0) return;
  const { x, y, count } = flock;
  const pmax = p.maxSpeed * HAWK_SPEED_FACTOR;
  const pm2 = pmax * pmax;
  const catch2 = HAWK_CATCH * HAWK_CATCH;
  for (const hk of preds) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < count; i++) {
      const dx = x[i] - hk.x;
      const dy = y[i] - hk.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = i;
      }
    }
    if (best >= 0) {
      const dx = x[best] - hk.x;
      const dy = y[best] - hk.y;
      const m = Math.hypot(dx, dy) || 1;
      let dvx = (dx / m) * pmax - hk.vx;
      let dvy = (dy / m) * pmax - hk.vy;
      const dm = Math.hypot(dvx, dvy);
      if (dm > HAWK_TURN) {
        const f = HAWK_TURN / dm;
        dvx *= f;
        dvy *= f;
      }
      hk.vx += dvx;
      hk.vy += dvy;
      const sp2 = hk.vx * hk.vx + hk.vy * hk.vy;
      if (sp2 > pm2 && sp2 > 0) {
        const s = pmax / Math.sqrt(sp2);
        hk.vx *= s;
        hk.vy *= s;
      }
      if (bestD < catch2) respawnAtEdge(flock, best, w, h, p.maxSpeed);
    }
    hk.x += hk.vx;
    hk.y += hk.vy;
    if (hk.x < 0) hk.x += w;
    else if (hk.x >= w) hk.x -= w;
    if (hk.y < 0) hk.y += h;
    else if (hk.y >= h) hk.y -= h;
  }
}

/** The per-rule steering vectors (and neighbor set) for one boid - the hover overlay. */
export interface FocusForces {
  neighbors: number[];
  sep: [number, number];
  ali: [number, number];
  coh: [number, number];
  sum: [number, number];
}

export function computeFocusForces(flock: Flock, idx: number, p: BoidParams, w: number, h: number): FocusForces {
  const { x, y, vx, vy, species, count } = flock;
  const r2 = p.radius * p.radius;
  const sepR2 = (p.radius * SEP_RADIUS_FACTOR) ** 2;
  const wrap = p.edges === "wrap";
  const applyFov = p.fov < 359.5;
  const cosFov = Math.cos((p.fov * DEG) / 2);
  const speciesActive = p.speciesCount > 1;
  const sums = newSums();
  const neighbors: number[] = [];
  const bx = x[idx];
  const by = y[idx];
  const bvx = vx[idx];
  const bvy = vy[idx];
  const bSpecies = species[idx];
  for (let j = 0; j < count; j++) {
    if (j === idx) continue;
    const sameRules = !speciesActive || bSpecies === species[j];
    if (gatherInto(sums, bx, by, bvx, bvy, x[j], y[j], vx[j], vy[j], w, h, r2, sepR2, wrap, applyFov, cosFov, sameRules)) {
      neighbors.push(j);
    }
  }
  const sep: [number, number] = [0, 0];
  const ali: [number, number] = [0, 0];
  const coh: [number, number] = [0, 0];
  combineForces(sums, bvx, bvy, p, sep, ali, coh);
  return { neighbors, sep, ali, coh, sum: [sep[0] + ali[0] + coh[0], sep[1] + ali[1] + coh[1]] };
}

/** Aggregate live telemetry: count, fps (passed in), avg speed, Vicsek order. */
export function computeSnapshot(flock: Flock, fps: number): BoidSnapshot {
  const n = flock.count;
  const { vx, vy } = flock;
  let sum = 0;
  let ox = 0;
  let oy = 0;
  let moving = 0;
  for (let i = 0; i < n; i++) {
    const sp = Math.hypot(vx[i], vy[i]);
    sum += sp;
    if (sp > 1e-3) {
      ox += vx[i] / sp;
      oy += vy[i] / sp;
      moving++;
    }
  }
  return {
    count: n,
    fps,
    avgSpeed: n ? sum / n : 0,
    order: moving ? Math.hypot(ox, oy) / moving : 0,
  };
}

// One simulation tick over the SoA flock: grid-accelerated three-rule steering,
// plus flow / obstacle / goal / predator / pointer / edge forces folded in during
// integration, then the autonomous predators move. Writes per-boid neighbor
// counts into scratch.density for the density colouring.
export function stepBoids(
  flock: Flock,
  p: BoidParams,
  w: number,
  h: number,
  pointer: Pointer,
  scratch: Scratch,
  world: World,
  time: number,
): void {
  const n = flock.count;
  if (n === 0) return;
  const { x, y, vx, vy, species } = flock;
  const r2 = p.radius * p.radius;
  const sepR2 = (p.radius * SEP_RADIUS_FACTOR) ** 2;
  const ms2 = p.maxSpeed * p.maxSpeed;
  const minSp = p.maxSpeed * MIN_SPEED_FRAC;
  const minSp2 = minSp * minSp;
  const wrap = p.edges === "wrap";
  const applyFov = p.fov < 359.5;
  const cosFov = Math.cos((p.fov * DEG) / 2);
  const speciesActive = p.speciesCount > 1;
  const { accX, accY, next, density } = scratch;
  const sums = newSums();
  const sep: [number, number] = [0, 0];
  const ali: [number, number] = [0, 0];
  const coh: [number, number] = [0, 0];

  const cell = Math.max(1, p.radius);
  const cols = Math.floor(w / cell);
  const rows = Math.floor(h / cell);
  const useGrid = cols >= GRID_MIN_CELLS && rows >= GRID_MIN_CELLS;

  if (useGrid) {
    const cellW = w / cols;
    const cellH = h / rows;
    const cellCount = cols * rows;
    let head = scratch.head;
    if (head.length < cellCount) {
      head = new Int32Array(cellCount);
      scratch.head = head;
    }
    head.fill(-1, 0, cellCount);
    for (let i = 0; i < n; i++) {
      let cx = Math.floor(x[i] / cellW);
      let cy = Math.floor(y[i] / cellH);
      if (cx < 0) cx = 0;
      else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0;
      else if (cy >= rows) cy = rows - 1;
      const c = cy * cols + cx;
      next[i] = head[c];
      head[c] = i;
    }
    for (let i = 0; i < n; i++) {
      const bx = x[i];
      const by = y[i];
      const bvx = vx[i];
      const bvy = vy[i];
      const bSpecies = species[i];
      let cx = Math.floor(bx / cellW);
      let cy = Math.floor(by / cellH);
      if (cx < 0) cx = 0;
      else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0;
      else if (cy >= rows) cy = rows - 1;
      resetSums(sums);
      let nb = 0;
      for (let ox = -1; ox <= 1; ox++) {
        const ncx = (((cx + ox) % cols) + cols) % cols;
        for (let oy = -1; oy <= 1; oy++) {
          const ncy = (((cy + oy) % rows) + rows) % rows;
          let j = head[ncy * cols + ncx];
          while (j !== -1) {
            if (j !== i) {
              const sameRules = !speciesActive || bSpecies === species[j];
              if (gatherInto(sums, bx, by, bvx, bvy, x[j], y[j], vx[j], vy[j], w, h, r2, sepR2, wrap, applyFov, cosFov, sameRules)) {
                nb++;
              }
            }
            j = next[j];
          }
        }
      }
      density[i] = nb;
      combineForces(sums, bvx, bvy, p, sep, ali, coh);
      accX[i] = sep[0] + ali[0] + coh[0];
      accY[i] = sep[1] + ali[1] + coh[1];
    }
  } else {
    for (let i = 0; i < n; i++) {
      const bx = x[i];
      const by = y[i];
      const bvx = vx[i];
      const bvy = vy[i];
      const bSpecies = species[i];
      resetSums(sums);
      let nb = 0;
      for (let j = 0; j < n; j++) {
        if (j !== i) {
          const sameRules = !speciesActive || bSpecies === species[j];
          if (gatherInto(sums, bx, by, bvx, bvy, x[j], y[j], vx[j], vy[j], w, h, r2, sepR2, wrap, applyFov, cosFov, sameRules)) {
            nb++;
          }
        }
      }
      density[i] = nb;
      combineForces(sums, bvx, bvy, p, sep, ali, coh);
      accX[i] = sep[0] + ali[0] + coh[0];
      accY[i] = sep[1] + ali[1] + coh[1];
    }
  }

  const goals = world.goals;
  const hasGoal = goals.length > 0;
  let gx = 0;
  let gy = 0;
  if (hasGoal) {
    const g = goals[world.goalIndex % goals.length];
    gx = g.x;
    gy = g.y;
  }
  const obstacles = world.obstacles;
  const preds = world.predators;
  const flowOn = p.flow > 0;
  const ptrActive = pointer.active && p.pointerTool === "push";
  const ptrR2 = PREDATOR_RADIUS * PREDATOR_RADIUS;
  const ptrSign = p.pointerMode === "attract" ? -1 : 1;
  const fleeR2 = HAWK_FLEE_RADIUS * HAWK_FLEE_RADIUS;
  const tmp: [number, number] = [0, 0];
  let sumX = 0;
  let sumY = 0;

  for (let i = 0; i < n; i++) {
    const ovx = vx[i];
    const ovy = vy[i];
    let ax = accX[i];
    let ay = accY[i];

    if (flowOn) {
      const ang = flowAngle(x[i], y[i], time);
      tmp[0] = 0;
      tmp[1] = 0;
      addSteer(tmp, Math.cos(ang), Math.sin(ang), ovx, ovy, p.maxSpeed, p.flow);
      ax += tmp[0];
      ay += tmp[1];
    }

    if (hasGoal) {
      tmp[0] = 0;
      tmp[1] = 0;
      addSteer(tmp, gx - x[i], gy - y[i], ovx, ovy, p.maxSpeed, GOAL_WEIGHT);
      ax += tmp[0];
      ay += tmp[1];
    }

    for (let o = 0; o < obstacles.length; o++) {
      const ob = obstacles[o];
      const dx = x[i] - ob.x;
      const dy = y[i] - ob.y;
      const d = Math.hypot(dx, dy);
      const range = ob.r + OBSTACLE_MARGIN;
      if (d < range && d > 0) {
        const strength = (range - d) / range;
        tmp[0] = 0;
        tmp[1] = 0;
        addSteer(tmp, dx, dy, ovx, ovy, p.maxSpeed, OBSTACLE_WEIGHT * strength);
        ax += tmp[0];
        ay += tmp[1];
      }
    }

    for (let pi = 0; pi < preds.length; pi++) {
      const hk = preds[pi];
      const dx = x[i] - hk.x;
      const dy = y[i] - hk.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < fleeR2 && d2 > 0) {
        const strength = 1 - Math.sqrt(d2) / HAWK_FLEE_RADIUS;
        tmp[0] = 0;
        tmp[1] = 0;
        addSteer(tmp, dx, dy, ovx, ovy, p.maxSpeed, HAWK_FLEE_WEIGHT * strength);
        ax += tmp[0];
        ay += tmp[1];
      }
    }

    if (p.edges === "avoid") {
      let wx = 0;
      let wy = 0;
      if (x[i] < EDGE_MARGIN) wx = 1;
      else if (x[i] > w - EDGE_MARGIN) wx = -1;
      if (y[i] < EDGE_MARGIN) wy = 1;
      else if (y[i] > h - EDGE_MARGIN) wy = -1;
      if (wx !== 0 || wy !== 0) {
        tmp[0] = 0;
        tmp[1] = 0;
        addSteer(tmp, wx, wy, ovx, ovy, p.maxSpeed, EDGE_AVOID_WEIGHT);
        ax += tmp[0];
        ay += tmp[1];
      }
    }

    if (ptrActive) {
      const dx = x[i] - pointer.x;
      const dy = y[i] - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < ptrR2 && d2 > 0) {
        const strength = 1 - Math.sqrt(d2) / PREDATOR_RADIUS;
        tmp[0] = 0;
        tmp[1] = 0;
        addSteer(tmp, ptrSign * dx, ptrSign * dy, ovx, ovy, p.maxSpeed, PREDATOR_WEIGHT * strength);
        ax += tmp[0];
        ay += tmp[1];
      }
    }

    let nvx = ovx + ax;
    let nvy = ovy + ay;
    const sp2 = nvx * nvx + nvy * nvy;
    if (sp2 > ms2 && sp2 > 0) {
      const s = p.maxSpeed / Math.sqrt(sp2);
      nvx *= s;
      nvy *= s;
    } else if (sp2 > 0 && sp2 < minSp2) {
      const s = minSp / Math.sqrt(sp2);
      nvx *= s;
      nvy *= s;
    }
    vx[i] = nvx;
    vy[i] = nvy;

    let nx = x[i] + nvx;
    let ny = y[i] + nvy;
    if (p.edges === "wrap") {
      if (nx < 0) nx += w;
      else if (nx >= w) nx -= w;
      if (ny < 0) ny += h;
      else if (ny >= h) ny -= h;
    } else if (p.edges === "bounce") {
      if (nx < 0) {
        nx = 0;
        vx[i] = -vx[i];
      } else if (nx > w) {
        nx = w;
        vx[i] = -vx[i];
      }
      if (ny < 0) {
        ny = 0;
        vy[i] = -vy[i];
      } else if (ny > h) {
        ny = h;
        vy[i] = -vy[i];
      }
    } else {
      if (nx < 0) nx = 0;
      else if (nx > w) nx = w;
      if (ny < 0) ny = 0;
      else if (ny > h) ny = h;
    }

    // Resolve any penetration into an obstacle by pushing to its rim.
    for (let o = 0; o < obstacles.length; o++) {
      const ob = obstacles[o];
      const dx = nx - ob.x;
      const dy = ny - ob.y;
      const d = Math.hypot(dx, dy);
      if (d < ob.r && d > 0) {
        const s = ob.r / d;
        nx = ob.x + dx * s;
        ny = ob.y + dy * s;
      }
    }

    x[i] = nx;
    y[i] = ny;
    sumX += nx;
    sumY += ny;
  }

  if (hasGoal) {
    const cxg = sumX / n - gx;
    const cyg = sumY / n - gy;
    if (cxg * cxg + cyg * cyg < GOAL_REACH * GOAL_REACH) {
      world.goalIndex = (world.goalIndex + 1) % goals.length;
    }
  }

  updatePredators(flock, world, p, w, h);
}
