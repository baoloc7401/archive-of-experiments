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
  /** Proper-noun algorithm name (kept untranslated). Description lives in i18n
   *  at experiments.pathfinding.algo.<id>. */
  name: string;
  category: AlgorithmCategory;
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

export interface TerrainConfig {
  enabled: boolean;
  weight: number;
}

export interface MazeOptions {
  weighted: boolean;
  routeDensity: RouteDensity;
  minPathLength: number;
  terrainConfig: Partial<Record<TerrainType, TerrainConfig>>;
}

export interface GridConfig {
  rows: number;
  cols: number;
  cells: CellState[][];
  start: [number, number];
  end: [number, number];
  // Custom traversal weights per terrain type; overrides CELL_WEIGHT defaults in algorithms
  terrainWeights?: Partial<Record<TerrainType, number>>;
}

export type AppScreen = 'algorithm-select' | 'maze-builder' | 'run';
