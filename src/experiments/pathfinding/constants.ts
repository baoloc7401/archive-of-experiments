import type { AlgorithmDef, MazeOptions, RouteDensity, TerrainType } from './types';

export const ALGORITHMS: AlgorithmDef[] = [
  {
    id: 'bfs',
    name: 'Breadth-First Search',
    category: 'unweighted',
    description:
      'Explores all neighbours level by level using a queue. Guaranteed to find the shortest path in an unweighted graph.',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
  },
  {
    id: 'dfs',
    name: 'Depth-First Search',
    category: 'unweighted',
    description:
      'Dives as deep as possible along each branch before backtracking. Simple, low memory, but does not guarantee shortest path.',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: false,
  },
  {
    id: 'dijkstra',
    name: "Dijkstra's Algorithm",
    category: 'weighted',
    description:
      'Always expands the lowest-cost unvisited node. On uniform-cost grids it equals BFS, but shines on weighted terrain.',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
  },
  {
    id: 'astar',
    name: 'A* Search',
    category: 'heuristic',
    description:
      'Combines path cost with a Manhattan-distance heuristic to steer the search toward the goal. Optimal and usually faster than Dijkstra.',
    timeComplexity: 'O(E log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
  },
  {
    id: 'greedy',
    name: 'Greedy Best-First',
    category: 'heuristic',
    description:
      'Always moves toward the node that looks closest to the goal by heuristic alone, ignoring path cost. Very fast but not optimal.',
    timeComplexity: 'O(E log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: false,
  },
  {
    id: 'bidirectional-bfs',
    name: 'Bidirectional BFS',
    category: 'unweighted',
    description:
      'Runs BFS simultaneously from both start and end, meeting in the middle. Explores roughly the square root of the nodes plain BFS would.',
    timeComplexity: 'O(b^(d/2))',
    spaceComplexity: 'O(b^(d/2))',
    guaranteesShortest: true,
  },
  {
    id: 'jps',
    name: 'Jump Point Search',
    category: 'heuristic',
    description:
      'Accelerates A* on uniform-cost grids by pruning symmetric, redundant paths via "jump points". Dramatically fewer node expansions on open grids.',
    timeComplexity: 'O(E log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
  },
];

export interface TerrainDef {
  id: TerrainType;
  label: string;
  weight: number;
  symbol: string;
  desc: string;
}

export const TERRAIN_DEFS: TerrainDef[] = [
  { id: 'plain',    label: 'plain',    weight: 1,  symbol: '·', desc: 'Normal ground — base cost ×1' },
  { id: 'grass',    label: 'grass',    weight: 2,  symbol: '⊹', desc: 'Light vegetation — cost ×2' },
  { id: 'sand',     label: 'sand',     weight: 3,  symbol: '~', desc: 'Sandy terrain — cost ×3' },
  { id: 'water',    label: 'water',    weight: 5,  symbol: '≋', desc: 'Shallow water — cost ×5' },
  { id: 'mountain', label: 'mountain', weight: 10, symbol: '▲', desc: 'Steep slopes — cost ×10' },
];

export const CELL_WEIGHT: Record<string, number> = {
  plain: 1, grass: 2, sand: 3, water: 5, mountain: 10,
  wall: Infinity, start: 1, end: 1,
};

export const DENSITY_LABELS: Record<RouteDensity, string> = {
  sparse: 'sparse',
  moderate: 'moderate',
  dense: 'dense',
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
};
