import { TWO_PI } from "./constants";
import type { Flock, SeedMode } from "./types";

/** Allocate the SoA buffers once at `capacity`; `count` starts empty. */
export function makeFlock(capacity: number): Flock {
  return {
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    vx: new Float32Array(capacity),
    vy: new Float32Array(capacity),
    species: new Uint8Array(capacity),
    count: 0,
    capacity,
  };
}

/** Give boid `i` a random heading at half to full max speed. */
export function setVelocity(flock: Flock, i: number, maxSpeed: number): void {
  const a = Math.random() * TWO_PI;
  const sp = maxSpeed * (0.5 + Math.random() * 0.5);
  flock.vx[i] = Math.cos(a) * sp;
  flock.vy[i] = Math.sin(a) * sp;
}

/** Lay the active flock out in the chosen starting formation (velocities untouched). */
export function placeFormation(flock: Flock, mode: SeedMode, w: number, h: number): void {
  const n = flock.count;
  const { x, y } = flock;
  const cx = w / 2;
  const cy = h / 2;
  if (mode === "ring") {
    const rad = Math.min(w, h) * 0.36;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TWO_PI;
      x[i] = cx + Math.cos(a) * rad;
      y[i] = cy + Math.sin(a) * rad;
    }
  } else if (mode === "grid") {
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / cols);
    const gap = (Math.min(w, h) * 0.8) / Math.max(cols, rows);
    const ox = cx - ((cols - 1) * gap) / 2;
    const oy = cy - ((rows - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      x[i] = ox + (i % cols) * gap;
      y[i] = oy + Math.floor(i / cols) * gap;
    }
  } else if (mode === "clumps") {
    const off = Math.min(w, h) * 0.22;
    for (let i = 0; i < n; i++) {
      const bx = cx + (i % 2 === 0 ? -off : off);
      x[i] = bx + (Math.random() - 0.5) * off;
      y[i] = cy + (Math.random() - 0.5) * off;
    }
  } else if (mode === "point") {
    for (let i = 0; i < n; i++) {
      x[i] = cx + (Math.random() - 0.5) * 8;
      y[i] = cy + (Math.random() - 0.5) * 8;
    }
  } else {
    for (let i = 0; i < n; i++) {
      x[i] = Math.random() * w;
      y[i] = Math.random() * h;
    }
  }
}

/** A caught boid reappears at a random edge, heading inward-ish. */
export function respawnAtEdge(flock: Flock, i: number, w: number, h: number, maxSpeed: number): void {
  const edge = (Math.random() * 4) | 0;
  if (edge === 0) {
    flock.x[i] = Math.random() * w;
    flock.y[i] = 0;
  } else if (edge === 1) {
    flock.x[i] = Math.random() * w;
    flock.y[i] = h;
  } else if (edge === 2) {
    flock.x[i] = 0;
    flock.y[i] = Math.random() * h;
  } else {
    flock.x[i] = w;
    flock.y[i] = Math.random() * h;
  }
  setVelocity(flock, i, maxSpeed * 0.8);
}
