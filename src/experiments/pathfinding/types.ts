export type AlgorithmId =
  | 'bfs'
  | 'dfs'
  | 'dijkstra'
  | 'astar'
  | 'greedy'
  | 'bidirectional-bfs'
  | 'jps';

export type AlgorithmCategory = 'unweighted' | 'weighted' | 'heuristic';

export interface AlgorithmDef {
  id: AlgorithmId;
  name: string;
  category: AlgorithmCategory;
  description: string;
  timeComplexity: string;
  spaceComplexity: string;
  guaranteesShortest: boolean;
}

// Terrain types carry traversal cost; wall = impassable
export type TerrainType = 'plain' | 'grass' | 'sand' | 'water' | 'mountain';
export type CellState = TerrainType | 'wall' | 'start' | 'end';

// Drawing a cell means placing that state; 'plain' acts as erase
export type DrawMode = CellState;

export type RouteDensity = 'sparse' | 'moderate' | 'dense';

export interface MazeOptions {
  weighted: boolean;
  routeDensity: RouteDensity;
  minPathLength: number; // 0 = unconstrained
}

export interface GridConfig {
  rows: number;
  cols: number;
  cells: CellState[][];
  start: [number, number];
  end: [number, number];
}

export type AppScreen = 'algorithm-select' | 'maze-builder' | 'run';
