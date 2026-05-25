import type { CellState } from '../types';
import { CELL_WEIGHT } from '../constants';

export const DIRS: readonly [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export const key = (r: number, c: number): string => `${r},${c}`;

export function parseKey(k: string): [number, number] {
  const i = k.indexOf(',');
  return [parseInt(k.slice(0, i), 10), parseInt(k.slice(i + 1), 10)];
}

export function inBounds(r: number, c: number, rows: number, cols: number): boolean {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

export function cellWeight(state: CellState): number {
  return CELL_WEIGHT[state] ?? 1;
}

export function manhattan(r1: number, c1: number, r2: number, c2: number): number {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

export function reconstructPath(
  parent: Record<string, string | null>,
  endKey: string,
): string[] {
  const path: string[] = [];
  let cur: string | null = endKey;
  while (cur !== null) {
    path.unshift(cur);
    cur = parent[cur];
  }
  return path;
}
