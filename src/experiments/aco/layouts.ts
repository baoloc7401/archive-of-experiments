import type { LayoutId, Point } from "./types";

// Cities live in a normalized [0,1]² box with a small margin so nodes never
// touch the canvas edge. Each generator returns `count` points.
const M = 0.07; // margin
const span = 1 - 2 * M;

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export function generateCities(layout: LayoutId, count: number): Point[] {
  switch (layout) {
    case "circle":
      return ring(count);
    case "clusters":
      return clusters(count);
    case "grid":
      return grid(count);
    case "random":
    default:
      return scatter(count);
  }
}

function scatter(count: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < count; i++) {
    pts.push({ x: rnd(M, 1 - M), y: rnd(M, 1 - M) });
  }
  return pts;
}

function ring(count: number): Point[] {
  const pts: Point[] = [];
  const cx = 0.5;
  const cy = 0.5;
  const r = span / 2;
  // Start angle offset so the ring isn't perfectly axis-aligned every time.
  const off = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const a = off + (i / count) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function clusters(count: number): Point[] {
  const k = Math.max(2, Math.round(count / 6));
  const centers: Point[] = [];
  for (let c = 0; c < k; c++) {
    centers.push({ x: rnd(M + 0.1, 1 - M - 0.1), y: rnd(M + 0.1, 1 - M - 0.1) });
  }
  const pts: Point[] = [];
  for (let i = 0; i < count; i++) {
    const c = centers[i % k];
    const x = Math.min(1 - M, Math.max(M, c.x + rnd(-0.08, 0.08)));
    const y = Math.min(1 - M, Math.max(M, c.y + rnd(-0.08, 0.08)));
    pts.push({ x, y });
  }
  return pts;
}

function grid(count: number): Point[] {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const pts: Point[] = [];
  const jx = span / cols / 4;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = M + ((c + 0.5) / cols) * span + rnd(-jx, jx);
    const y = M + ((r + 0.5) / rows) * span + rnd(-jx, jx);
    pts.push({ x: Math.min(1 - M, Math.max(M, x)), y: Math.min(1 - M, Math.max(M, y)) });
  }
  return pts;
}
