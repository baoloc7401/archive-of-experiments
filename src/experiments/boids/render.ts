import {
  ARROW_GAIN,
  BOID_SIZE,
  DEG,
  DENSITY_MAX,
  HAWK_FLEE_RADIUS,
  HUE_BUCKETS,
  PREDATOR_RADIUS,
  RAD_TO_DEG,
  TAIL,
  TWO_PI,
} from "./constants";
import type { Palette } from "./palette";
import { computeFocusForces } from "./simulation";
import type { Theme } from "../../hooks/useTheme";
import type { BoidParams, Flock, Pointer, World } from "./types";

export interface DrawState {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
  palette: Palette;
  params: BoidParams;
  reduced: boolean;
  theme: Theme;
  flock: Flock;
  /** Per-boid neighbor counts from the last step (for density colouring). */
  density: Int32Array;
  world: World;
  pointer: Pointer;
  /** Index of the hovered boid, or -1. */
  focusIdx: number;
}

// Append one heading-oriented triangle to `path` (manual rotation, no transform),
// so thousands of bodies batch into a single fill.
function addTriangle(path: Path2D, px: number, py: number, c: number, s: number): void {
  const tip = BOID_SIZE;
  const bx = -BOID_SIZE * 0.62;
  const by = BOID_SIZE * 0.5;
  path.moveTo(px + c * tip, py + s * tip);
  path.lineTo(px + c * bx - s * by, py + s * bx + c * by);
  path.lineTo(px + c * bx + s * by, py + s * bx - c * by);
  path.closePath();
}

/** Render the whole scene: backdrop, obstacles, goals, focus overlay, flock, predators. */
export function drawScene(state: DrawState): void {
  const { ctx, w, h, dpr, palette: pal, params: p, flock, density, world, pointer: ptr } = state;
  const reducedMotion = state.reduced;
  const maxSpeed = p.maxSpeed || 1;
  const light = state.theme === "light" ? 45 : 62;
  const n = flock.count;
  const { x, y, vx, vy, species } = flock;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (p.trails && !reducedMotion) {
    // Long exposure: fade the previous frame instead of clearing (#18).
    ctx.fillStyle = `rgba(${pal.bgRgb},0.16)`;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  const drawTail = !reducedMotion && !p.trails;

  // Obstacles (under the flock).
  for (const ob of world.obstacles) {
    ctx.beginPath();
    ctx.arc(ob.x, ob.y, ob.r, 0, TWO_PI);
    ctx.fillStyle = `rgba(${pal.textDimRgb},0.35)`;
    ctx.fill();
    ctx.strokeStyle = pal.textHi;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // Goal waypoints + path.
  if (world.goals.length > 0) {
    ctx.strokeStyle = `rgba(${pal.accentRgb},0.4)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    world.goals.forEach((g, i) => {
      if (i === 0) ctx.moveTo(g.x, g.y);
      else ctx.lineTo(g.x, g.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    const currentGoal = world.goalIndex % world.goals.length;
    world.goals.forEach((g, i) => {
      const current = i === currentGoal;
      ctx.beginPath();
      ctx.arc(g.x, g.y, current ? 7 : 5, 0, TWO_PI);
      ctx.strokeStyle = current ? pal.accent : `rgba(${pal.accentRgb},0.5)`;
      ctx.lineWidth = current ? 2 : 1.2;
      ctx.stroke();
    });
  }

  // Focus overlay (under): perception wedge / radius ring + neighbors.
  const focusIdx = state.focusIdx;
  const showFocus = focusIdx >= 0 && focusIdx < n && !ptr.active;
  const forces = showFocus ? computeFocusForces(flock, focusIdx, p, w, h) : null;
  if (forces) {
    const fx = x[focusIdx];
    const fy = y[focusIdx];
    const v2 = vx[focusIdx] * vx[focusIdx] + vy[focusIdx] * vy[focusIdx];
    if (p.fov < 360 && v2 > 1e-6) {
      const heading = Math.atan2(vy[focusIdx], vx[focusIdx]);
      const half = (p.fov * DEG) / 2;
      ctx.fillStyle = `rgba(${pal.accentRgb},0.07)`;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.arc(fx, fy, p.radius, heading - half, heading + half);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(${pal.accentRgb},0.16)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(fx, fy, p.radius, 0, TWO_PI);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${pal.accentRgb},0.5)`;
    ctx.lineWidth = 1.4;
    for (const j of forces.neighbors) {
      ctx.beginPath();
      ctx.arc(x[j], y[j], 7, 0, TWO_PI);
      ctx.stroke();
    }
  }

  // Tails (batched, single stroke).
  if (drawTail) {
    const tail = new Path2D();
    for (let i = 0; i < n; i++) {
      tail.moveTo(x[i] - vx[i] * TAIL, y[i] - vy[i] * TAIL);
      tail.lineTo(x[i], y[i]);
    }
    ctx.strokeStyle = `rgba(${pal.accentRgb},0.16)`;
    ctx.lineWidth = 1.2;
    ctx.stroke(tail);
  }

  // Bodies: triangles batched into a few Path2D buckets, one fill per bucket.
  if (p.speciesCount > 1) {
    const buckets: Path2D[] = [];
    for (let k = 0; k < p.speciesCount; k++) buckets[k] = new Path2D();
    for (let i = 0; i < n; i++) {
      const angle = Math.atan2(vy[i], vx[i]);
      addTriangle(buckets[species[i]], x[i], y[i], Math.cos(angle), Math.sin(angle));
    }
    for (let k = 0; k < p.speciesCount; k++) {
      ctx.fillStyle = `hsl(${Math.round((k / p.speciesCount) * 360)} 72% ${light}%)`;
      ctx.fill(buckets[k]);
    }
  } else if (p.colorMode === "heading") {
    const span = 360 / HUE_BUCKETS;
    const buckets: Path2D[] = [];
    for (let k = 0; k < HUE_BUCKETS; k++) buckets[k] = new Path2D();
    for (let i = 0; i < n; i++) {
      const angle = Math.atan2(vy[i], vx[i]);
      const hue = (angle * RAD_TO_DEG + 360) % 360;
      let bk = (hue / span) | 0;
      if (bk >= HUE_BUCKETS) bk = HUE_BUCKETS - 1;
      addTriangle(buckets[bk], x[i], y[i], Math.cos(angle), Math.sin(angle));
    }
    for (let k = 0; k < HUE_BUCKETS; k++) {
      ctx.fillStyle = `hsl(${((k + 0.5) * span).toFixed(0)} 75% ${light}%)`;
      ctx.fill(buckets[k]);
    }
  } else if (p.colorMode === "density") {
    const DB = 12;
    const buckets: Path2D[] = [];
    for (let k = 0; k < DB; k++) buckets[k] = new Path2D();
    for (let i = 0; i < n; i++) {
      const tnorm = Math.min(1, density[i] / DENSITY_MAX);
      let bk = (tnorm * DB) | 0;
      if (bk >= DB) bk = DB - 1;
      const angle = Math.atan2(vy[i], vx[i]);
      addTriangle(buckets[bk], x[i], y[i], Math.cos(angle), Math.sin(angle));
    }
    for (let k = 0; k < DB; k++) {
      const tnorm = (k + 0.5) / DB;
      ctx.fillStyle = `hsl(${Math.round(210 * (1 - tnorm))} 80% ${light}%)`; // cool -> hot
      ctx.fill(buckets[k]);
    }
  } else {
    const slow = new Path2D();
    const fast = new Path2D();
    for (let i = 0; i < n; i++) {
      const angle = Math.atan2(vy[i], vx[i]);
      const target = Math.hypot(vx[i], vy[i]) / maxSpeed > 0.66 ? fast : slow;
      addTriangle(target, x[i], y[i], Math.cos(angle), Math.sin(angle));
    }
    ctx.fillStyle = pal.accent;
    ctx.fill(slow);
    ctx.fillStyle = pal.accent2;
    ctx.fill(fast);
  }

  // Predators (over the flock): bigger triangles + a faint danger ring.
  for (const hk of world.predators) {
    const angle = Math.atan2(hk.vy, hk.vx);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const sz = BOID_SIZE * 1.9;
    ctx.fillStyle = pal.wip;
    ctx.beginPath();
    ctx.moveTo(hk.x + c * sz, hk.y + s * sz);
    ctx.lineTo(hk.x + c * -sz * 0.6 - s * sz * 0.55, hk.y + s * -sz * 0.6 + c * sz * 0.55);
    ctx.lineTo(hk.x + c * -sz * 0.6 + s * sz * 0.55, hk.y + s * -sz * 0.6 - c * sz * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${pal.textDimRgb},0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(hk.x, hk.y, HAWK_FLEE_RADIUS, 0, TWO_PI);
    ctx.stroke();
  }

  // Focus overlay (over): steering arrows + marker ring.
  if (forces) {
    const fx = x[focusIdx];
    const fy = y[focusIdx];
    const arrow = (avx: number, avy: number, color: string, width: number) => {
      let lx = avx * ARROW_GAIN;
      let ly = avy * ARROW_GAIN;
      const len = Math.hypot(lx, ly);
      if (len < 1) return;
      const cap = p.radius * 2;
      if (len > cap) {
        const f = cap / len;
        lx *= f;
        ly *= f;
      }
      const ex = fx + lx;
      const ey = fy + ly;
      const a = Math.atan2(ly, lx);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 7 * Math.cos(a - 0.4), ey - 7 * Math.sin(a - 0.4));
      ctx.lineTo(ex - 7 * Math.cos(a + 0.4), ey - 7 * Math.sin(a + 0.4));
      ctx.closePath();
      ctx.fill();
    };
    arrow(forces.coh[0], forces.coh[1], pal.accent, 2);
    arrow(forces.ali[0], forces.ali[1], pal.accent2, 2);
    arrow(forces.sep[0], forces.sep[1], pal.wip, 2);
    arrow(forces.sum[0], forces.sum[1], pal.textHi, 2.6);
    ctx.strokeStyle = pal.textHi;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx, fy, 9, 0, TWO_PI);
    ctx.stroke();
  }

  // Held-pointer push field.
  if (ptr.active && p.pointerTool === "push") {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = p.pointerMode === "attract" ? pal.accent : pal.wip;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(ptr.x, ptr.y, PREDATOR_RADIUS, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = p.pointerMode === "attract" ? pal.accent : pal.wip;
    ctx.beginPath();
    ctx.arc(ptr.x, ptr.y, 4, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }
}
