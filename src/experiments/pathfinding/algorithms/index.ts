import type { AlgorithmId } from '../types';
import type { AlgoFactory } from './types';
import { bfs } from './bfs';
import { dfs } from './dfs';
import { dijkstra } from './dijkstra';
import { astar } from './astar';
import { greedy } from './greedy';
import { bidirectionalBfs } from './bidirectional-bfs';
import { jps } from './jps';

export const ALGO_FACTORIES: Record<AlgorithmId, AlgoFactory> = {
  'bfs':               bfs,
  'dfs':               dfs,
  'dijkstra':          dijkstra,
  'astar':             astar,
  'greedy':            greedy,
  'bidirectional-bfs': bidirectionalBfs,
  'jps':               jps,
};

export type { AlgoState, AlgoGen, AlgoFactory } from './types';
