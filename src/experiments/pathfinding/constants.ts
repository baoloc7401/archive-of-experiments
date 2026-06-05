import type { AlgorithmDef, MazeOptions, RouteDensity, TerrainConfig, TerrainType } from './types';

// Proper-noun `name` is kept untranslated; descriptions live in i18n at
// experiments.pathfinding.algo.<id>.
export const ALGORITHMS: AlgorithmDef[] = [
  {
    id: 'bfs',
    name: 'Breadth-First Search',
    category: 'unweighted',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
  },
  {
    id: 'dfs',
    name: 'Depth-First Search',
    category: 'unweighted',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: false,
  },
  {
    id: 'dijkstra',
    name: "Dijkstra's Algorithm",
    category: 'weighted',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
  },
  {
    id: 'astar',
    name: 'A* Search',
    category: 'heuristic',
    timeComplexity: 'O(E log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
  },
  {
    id: 'greedy',
    name: 'Greedy Best-First',
    category: 'heuristic',
    timeComplexity: 'O(E log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: false,
  },
  {
    id: 'bidirectional-bfs',
    name: 'Bidirectional BFS',
    category: 'unweighted',
    timeComplexity: 'O(b^(d/2))',
    spaceComplexity: 'O(b^(d/2))',
    guaranteesShortest: true,
  },
  {
    id: 'jps',
    name: 'Jump Point Search',
    category: 'heuristic',
    timeComplexity: 'O(E log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
  },
];

// `label`/`desc` live in i18n at experiments.pathfinding.terrain.<id>_{label,desc}.
export interface TerrainDef {
  id: TerrainType;
  weight: number;
  symbol: string;
}

export const TERRAIN_DEFS: TerrainDef[] = [
  { id: 'plain',    weight: 1,  symbol: '·' },
  { id: 'grass',    weight: 2,  symbol: '⊹' },
  { id: 'sand',     weight: 3,  symbol: '~' },
  { id: 'water',    weight: 5,  symbol: '≋' },
  { id: 'mountain', weight: 10, symbol: '▲' },
];

export const CELL_WEIGHT: Record<string, number> = {
  plain: 1, grass: 2, sand: 3, water: 5, mountain: 10,
  wall: Infinity, start: 1, end: 1,
};

// Non-plain terrains with their default weights and enabled state
export const DEFAULT_TERRAIN_CONFIG: Partial<Record<TerrainType, TerrainConfig>> = {
  grass:    { enabled: true, weight: 2 },
  sand:     { enabled: true, weight: 3 },
  water:    { enabled: true, weight: 5 },
  mountain: { enabled: true, weight: 10 },
};

// Fraction of "loop-eligible" walls to remove
export const DENSITY_REMOVAL: Record<RouteDensity, number> = {
  sparse:   0.04,
  moderate: 0.20,
  dense:    0.45,
};

// Terrain distribution for weighted maze (indices into TERRAIN_DEFS)
// More plains, less extreme terrain
export const WEIGHTED_DISTRIBUTION: TerrainType[] = [
  'plain', 'plain', 'plain', 'plain',
  'grass', 'grass', 'grass',
  'sand',  'sand',
  'water',
  'mountain',
];

export const DEFAULT_ROWS = 15;
export const DEFAULT_COLS = 25;
export const MIN_ROWS = 5;
export const MAX_ROWS = 35;
export const MIN_COLS = 5;
export const MAX_COLS = 51;
export const CELL_PX = 20;

export const DEFAULT_MAZE_OPTIONS: MazeOptions = {
  weighted: false,
  routeDensity: 'moderate',
  minPathLength: 0,
  terrainConfig: DEFAULT_TERRAIN_CONFIG,
};
