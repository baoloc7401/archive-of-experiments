import type { GridConfig } from '../types';

export interface AlgoState {
  visited: ReadonlySet<string>;
  /** Primary open set (forward frontier for bidirectional) */
  frontier: ReadonlySet<string>;
  /** Backward frontier — bidirectional BFS only */
  frontierB?: ReadonlySet<string>;
  current: string | null;
  path: readonly string[] | null;
  status: 'running' | 'found' | 'no-path';
  steps: number;
  /** Weighted path cost (hop count for unweighted algorithms) */
  pathCost: number;
}

export type AlgoGen = Generator<AlgoState, void, unknown>;
export type AlgoFactory = (grid: GridConfig) => AlgoGen;
