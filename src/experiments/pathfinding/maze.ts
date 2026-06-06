import type { CellState, GridConfig, MazeOptions, TerrainConfig, TerrainType } from './types';
import { DENSITY_REMOVAL } from './constants';

const NON_PLAIN_TERRAINS: TerrainType[] = ['grass', 'sand', 'water', 'mountain'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// BFS returning ordered cell list of shortest path, or null if unreachable.
// Ignores cell weights - used for structural path-length enforcement.
function bfsPath(grid: GridConfig): [number, number][] | null {
  const { rows, cols, cells, start, end } = grid;
  const k = (r: number, c: number) => `${r},${c}`;
  const parent: Record<string, string | null> = {};
  parent[k(...start)] = null;
  const queue: [number, number][] = [[start[0], start[1]]];
  const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let found = false;

  outer: while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (cells[nr][nc] === 'wall') continue;
      const nk = k(nr, nc);
      if (nk in parent) continue;
      parent[nk] = k(r, c);
      if (nr === end[0] && nc === end[1]) { found = true; break outer; }
      queue.push([nr, nc]);
    }
  }

  if (!found) return null;

  const path: [number, number][] = [];
  let cur: string | null = k(...end);
  while (cur !== null) {
    const [r, c] = cur.split(',').map(Number) as [number, number];
    path.unshift([r, c]);
    cur = parent[cur];
  }
  return path;
}

// Iteratively forces the shortest BFS path to be at least `minLength` cells
// by walling off path cells. Gives up gracefully if it can't reach the target.
function enforceMinPath(grid: GridConfig, minLength: number): GridConfig {
  if (minLength <= 0) return grid;
  const MAX_ITERS = 80;
  let current = grid;

  for (let i = 0; i < MAX_ITERS; i++) {
    const path = bfsPath(current);
    if (!path || path.length >= minLength) break;

    // Try to wall a random middle cell without disconnecting the maze
    const mid = shuffle(path.slice(1, -1));
    let placed = false;
    for (const [r, c] of mid) {
      const cells = current.cells.map((row) => [...row] as CellState[]);
      cells[r][c] = 'wall';
      const test = { ...current, cells };
      if (bfsPath(test) !== null) {
        current = test;
        placed = true;
        break;
      }
    }
    if (!placed) break; // every middle cell disconnects - give up
  }

  return current;
}

// Builds weighted terrain distribution from the enabled terrains in config.
// Uses 4 plain cells as a base, then 2 copies of each enabled terrain,
// so the proportion of plain stays roughly consistent regardless of how many
// terrains are enabled.
function buildDistribution(terrainConfig: Partial<Record<TerrainType, TerrainConfig>>): TerrainType[] {
  const enabled = NON_PLAIN_TERRAINS.filter((t) => terrainConfig[t]?.enabled !== false);
  if (enabled.length === 0) return ['plain'];
  return ['plain', 'plain', 'plain', 'plain', ...enabled, ...enabled];
}

function assignTerrain(
  cells: CellState[][],
  terrainConfig: Partial<Record<TerrainType, TerrainConfig>>,
): CellState[][] {
  const dist = buildDistribution(terrainConfig);
  return cells.map((row) =>
    row.map((cell) => {
      if (cell !== 'plain') return cell;
      return dist[Math.floor(Math.random() * dist.length)];
    })
  );
}

// Extract terrain weights from options for embedding in GridConfig
export function computeTerrainWeights(
  terrainConfig: Partial<Record<TerrainType, TerrainConfig>>,
): Partial<Record<TerrainType, number>> {
  const weights: Partial<Record<TerrainType, number>> = {};
  for (const t of NON_PLAIN_TERRAINS) {
    const cfg = terrainConfig[t];
    if (cfg) weights[t] = cfg.weight;
  }
  return weights;
}

export function makeDefaultGrid(rows: number, cols: number): GridConfig {
  const cells: CellState[][] = Array.from({ length: rows }, () =>
    Array<CellState>(cols).fill('plain')
  );
  cells[0][0] = 'start';
  cells[rows - 1][cols - 1] = 'end';
  return { rows, cols, cells, start: [0, 0], end: [rows - 1, cols - 1] };
}

// Recursive-backtracker maze generation (iterative).
// Rooms at even grid positions, passage walls at odd positions.
// After the spanning tree is carved, a fraction of loop-eligible walls
// are opened to create alternate routes (controlled by routeDensity).
export function generateMaze(rows: number, cols: number, options: MazeOptions): GridConfig {
  const cells: CellState[][] = Array.from({ length: rows }, () =>
    Array<CellState>(cols).fill('wall')
  );

  const roomRows = Math.ceil(rows / 2);
  const roomCols = Math.ceil(cols / 2);
  const visited: boolean[][] = Array.from({ length: roomRows }, () =>
    Array<boolean>(roomCols).fill(false)
  );

  const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  cells[0][0] = 'plain';

  while (stack.length > 0) {
    const [ri, ci] = stack[stack.length - 1];
    const neighbors = shuffle(DIRS).filter(([dri, dci]) => {
      const nri = ri + dri;
      const nci = ci + dci;
      return nri >= 0 && nri < roomRows && nci >= 0 && nci < roomCols && !visited[nri][nci];
    });

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const [dri, dci] = neighbors[0];
      const nri = ri + dri;
      const nci = ci + dci;
      cells[ri * 2 + dri][ci * 2 + dci] = 'plain'; // wall between rooms
      cells[nri * 2][nci * 2] = 'plain';
      visited[nri][nci] = true;
      stack.push([nri, nci]);
    }
  }

  // Collect walls that have ≥2 empty orthogonal neighbours - removing these creates loops
  const candidates: [number, number][] = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (cells[r][c] !== 'wall') continue;
      let openNeighbors = 0;
      if (cells[r - 1][c] !== 'wall') openNeighbors++;
      if (cells[r + 1][c] !== 'wall') openNeighbors++;
      if (cells[r][c - 1] !== 'wall') openNeighbors++;
      if (cells[r][c + 1] !== 'wall') openNeighbors++;
      if (openNeighbors >= 2) candidates.push([r, c]);
    }
  }

  const removalRate = DENSITY_REMOVAL[options.routeDensity];
  const toRemove = Math.max(2, Math.floor(candidates.length * removalRate));
  for (const [r, c] of shuffle(candidates).slice(0, toRemove)) {
    cells[r][c] = 'plain';
  }

  const startR = 0;
  const startC = 0;
  const endR = (roomRows - 1) * 2;
  const endC = (roomCols - 1) * 2;
  cells[startR][startC] = 'start';
  cells[endR][endC] = 'end';

  let grid: GridConfig = {
    rows, cols, cells,
    start: [startR, startC],
    end: [endR, endC],
  };

  // Enforce minimum path length before assigning terrain
  grid = enforceMinPath(grid, options.minPathLength);

  // Apply terrain weights to passage cells and embed weights in grid
  if (options.weighted) {
    grid = {
      ...grid,
      cells: assignTerrain(grid.cells, options.terrainConfig),
      terrainWeights: computeTerrainWeights(options.terrainConfig),
    };
  }

  return grid;
}
