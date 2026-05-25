import { memo, useRef, useState, useEffect } from 'react';
import type { CellState, DrawMode, GridConfig, MazeOptions, RouteDensity, TerrainConfig, TerrainType } from '../types';
import type { AlgorithmId } from '../types';
import {
  ALGORITHMS, CELL_PX, MIN_ROWS, MAX_ROWS, MIN_COLS, MAX_COLS,
  TERRAIN_DEFS,
} from '../constants';
import { makeDefaultGrid, generateMaze, computeTerrainWeights } from '../maze';

const NON_PLAIN_TERRAINS: TerrainType[] = ['grass', 'sand', 'water', 'mountain'];

interface Props {
  grid: GridConfig;
  selected: Set<AlgorithmId>;
  options: MazeOptions;
  onGridChange: (grid: GridConfig) => void;
  onOptionsChange: (options: MazeOptions) => void;
  onBack: () => void;
  onRun: () => void;
}

// Maps each cell state to its CSS custom-property background (for animation)
const CELL_BG_VAR: Record<CellState, string> = {
  plain:    'var(--pf-plain)',
  grass:    'var(--pf-grass)',
  sand:     'var(--pf-sand)',
  water:    'var(--pf-water)',
  mountain: 'var(--pf-mountain)',
  wall:     'var(--pf-wall)',
  start:    'var(--accent)',
  end:      'var(--accent2)',
};

interface CellProps {
  state: CellState;
  animKey: number;
  row: number;
  col: number;
  delayMult: number;
}

const Cell = memo(function Cell({ state, animKey, row, col, delayMult }: CellProps) {
  const isAnimating = animKey > 0;
  const delay = isAnimating ? Math.round((row + col) * delayMult) : 0;
  return (
    <div
      className={`pf-cell pf-cell-${state}${isAnimating ? ' pf-cell--scanning' : ''}`}
      style={
        isAnimating
          ? ({
              '--pf-final-bg': CELL_BG_VAR[state],
              '--pf-anim-delay': `${delay}ms`,
            } as React.CSSProperties)
          : undefined
      }
    />
  );
});

export default function MazeBuilder({ grid, selected, options, onGridChange, onOptionsChange, onBack, onRun }: Props) {
  const [mode, setMode] = useState<DrawMode>('wall');
  const [rows, setRows] = useState(grid.rows);
  const [cols, setCols] = useState(grid.cols);
  const [showOptions, setShowOptions] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const gridRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const dragAction = useRef<CellState>('wall');
  const lastKey = useRef<string | null>(null);

  // Clamp minPathLength when dimensions change
  useEffect(() => {
    const max = getMaxPath(rows, cols);
    if (options.minPathLength > max) {
      onOptionsChange({ ...options, minPathLength: max });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols]);

  // When weighted is toggled off, reset terrain draw modes to 'plain'
  useEffect(() => {
    if (!options.weighted && NON_PLAIN_TERRAINS.includes(mode as TerrainType)) {
      setMode('plain');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.weighted]);

  function getMaxPath(r: number, c: number) {
    return Math.min(100, Math.floor((r + c) * 1.8));
  }

  // Build grid with current terrain weights embedded
  function withWeights(g: GridConfig): GridConfig {
    if (!options.weighted) return { ...g, terrainWeights: undefined };
    return { ...g, terrainWeights: computeTerrainWeights(options.terrainConfig) };
  }

  function resizeTo(r: number, c: number) {
    onGridChange(withWeights(makeDefaultGrid(r, c)));
  }

  function handleRowsChange(val: number) {
    setRows(val);
    resizeTo(val, cols);
  }

  function handleColsChange(val: number) {
    setCols(val);
    resizeTo(rows, val);
  }

  function handleRandomize() {
    const next = generateMaze(rows, cols, options);
    onGridChange(next);
    setAnimKey((k) => k + 1);
  }

  function applyAt(r: number, c: number, action: CellState) {
    const key = `${r},${c},${action}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    const cells = grid.cells.map((row) => [...row] as CellState[]);
    let { start, end } = grid;

    if (action === 'start') {
      if (cells[r][c] === 'end') return;
      cells[start[0]][start[1]] = 'plain';
      cells[r][c] = 'start';
      start = [r, c];
    } else if (action === 'end') {
      if (cells[r][c] === 'start') return;
      cells[end[0]][end[1]] = 'plain';
      cells[r][c] = 'end';
      end = [r, c];
    } else {
      if (cells[r][c] === 'start' || cells[r][c] === 'end') return;
      cells[r][c] = action;
    }

    onGridChange(withWeights({ ...grid, cells, start, end }));
  }

  function getCellAt(e: React.MouseEvent | MouseEvent): [number, number] | null {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const step = CELL_PX + 1;
    const col = Math.floor((e.clientX - rect.left) / step);
    const row = Math.floor((e.clientY - rect.top) / step);
    if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return null;
    return [row, col];
  }

  function handleGridMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const pos = getCellAt(e);
    if (!pos) return;
    const [r, c] = pos;
    isDrawing.current = true;
    lastKey.current = null;

    if (mode === 'start' || mode === 'end') {
      applyAt(r, c, mode);
      isDrawing.current = false;
      return;
    }

    // For wall/terrain/plain: toggle if clicking the same state, else apply
    const current = grid.cells[r][c];
    const action: CellState =
      mode === 'wall' && current === 'wall' ? 'plain'
      : mode === 'plain' && current === 'plain' ? 'wall'
      : mode;
    dragAction.current = action;
    applyAt(r, c, action);
  }

  function handleGridMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDrawing.current) return;
    const pos = getCellAt(e);
    if (!pos) return;
    applyAt(pos[0], pos[1], dragAction.current);
  }

  useEffect(() => {
    const stop = () => {
      isDrawing.current = false;
      lastKey.current = null;
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  function setTerrainConfig(t: TerrainType, patch: Partial<TerrainConfig>) {
    const existing = options.terrainConfig[t] ?? { enabled: true, weight: TERRAIN_DEFS.find((d) => d.id === t)!.weight };
    onOptionsChange({
      ...options,
      terrainConfig: {
        ...options.terrainConfig,
        [t]: { ...existing, ...patch },
      },
    });
  }

  const isDrawable = mode !== 'start' && mode !== 'end';
  const delayMult = Math.min(15, 800 / (grid.rows + grid.cols));
  const selectedNames = ALGORITHMS.filter((a) => selected.has(a.id)).map((a) => a.name);
  const maxPath = getMaxPath(rows, cols);

  const DENSITY_OPTIONS: RouteDensity[] = ['sparse', 'moderate', 'dense'];
  const DENSITY_DESC: Record<RouteDensity, string> = {
    sparse:   'tight corridors, few loops',
    moderate: 'some alternate routes',
    dense:    'many crossroads',
  };

  return (
    <div className="pf-maze-builder">
      {/* Selected algorithms strip */}
      {selectedNames.length > 0 && (
        <div className="pf-algo-summary">
          <span className="pf-algo-summary-label">algorithms:</span>
          {selectedNames.map((n) => (
            <span key={n} className="pf-algo-chip">{n}</span>
          ))}
        </div>
      )}

      {/* Controls bar */}
      <div className="pf-controls">
        {/* Dimensions */}
        <div className="pf-dim-group">
          <label className="pf-dim-label">
            <span className="pf-dim-name">rows</span>
            <span className="pf-dim-val">{rows}</span>
            <input
              type="range" min={MIN_ROWS} max={MAX_ROWS} value={rows}
              onChange={(e) => handleRowsChange(Number(e.target.value))}
            />
          </label>
          <label className="pf-dim-label">
            <span className="pf-dim-name">cols</span>
            <span className="pf-dim-val">{cols}</span>
            <input
              type="range" min={MIN_COLS} max={MAX_COLS} value={cols}
              onChange={(e) => handleColsChange(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="pf-divider" />

        {/* Draw mode */}
        <div className="pf-mode-group">
          <span className="pf-group-label">draw</span>
          <button
            className={`pf-mode-btn${mode === 'wall' ? ' pf-mode-btn--active' : ''}`}
            onClick={() => setMode('wall')}
          >▪ wall</button>
          <button
            className={`pf-mode-btn${mode === 'plain' ? ' pf-mode-btn--active' : ''}`}
            onClick={() => setMode('plain')}
          >✕ erase</button>

          {/* Terrain buttons — only enabled terrains when weighted */}
          {options.weighted && (
            <>
              <div className="pf-mode-divider" />
              {TERRAIN_DEFS.filter((t) => t.id !== 'plain' && options.terrainConfig[t.id]?.enabled !== false).map((t) => (
                <button
                  key={t.id}
                  className={`pf-mode-btn pf-terrain-btn pf-terrain-btn-${t.id}${mode === t.id ? ' pf-mode-btn--active' : ''}`}
                  title={t.desc}
                  onClick={() => setMode(t.id)}
                >
                  {t.symbol} {t.label}
                </button>
              ))}
            </>
          )}

          <div className="pf-mode-divider" />
          <button
            className={`pf-mode-btn${mode === 'start' ? ' pf-mode-btn--active' : ''}`}
            onClick={() => setMode('start')}
          >◉ start</button>
          <button
            className={`pf-mode-btn${mode === 'end' ? ' pf-mode-btn--active' : ''}`}
            onClick={() => setMode('end')}
          >⬡ end</button>
        </div>

        <div className="pf-divider" />

        {/* Actions */}
        <div className="pf-action-group">
          <button
            className="pf-btn pf-btn-ghost"
            onClick={() => onGridChange(withWeights(makeDefaultGrid(rows, cols)))}
          >
            clear
          </button>
          <button
            className={`pf-btn pf-btn-ghost pf-btn-options${showOptions ? ' pf-btn-options--active' : ''}`}
            onClick={() => setShowOptions((s) => !s)}
            title="Randomize options"
          >
            ⚙ options
          </button>
          <button className="pf-btn pf-btn-accent" onClick={handleRandomize}>
            randomize
          </button>
        </div>
      </div>

      {/* Options panel */}
      <div className={`pf-options-panel${showOptions ? ' pf-options-panel--open' : ''}`}>
        <div className="pf-options-inner">
          {/* Weighted toggle */}
          <div className="pf-opt-row">
            <div className="pf-opt-info">
              <span className="pf-opt-label">weighted terrain</span>
              <span className="pf-opt-desc">assign traversal costs to terrain types</span>
            </div>
            <button
              className={`pf-toggle${options.weighted ? ' pf-toggle--on' : ''}`}
              onClick={() => onOptionsChange({ ...options, weighted: !options.weighted })}
              aria-pressed={options.weighted}
            >
              <span className="pf-toggle-knob" />
            </button>
          </div>

          {/* Terrain editor — only when weighted */}
          {options.weighted && (
            <div className="pf-opt-row pf-opt-row--col pf-terrain-editor-wrap">
              <span className="pf-opt-label">terrain types &amp; weights</span>
              <div className="pf-terrain-editor">
                {TERRAIN_DEFS.filter((t) => t.id !== 'plain').map((def) => {
                  const cfg = options.terrainConfig[def.id] ?? { enabled: true, weight: def.weight };
                  return (
                    <div
                      key={def.id}
                      className={`pf-terrain-row pf-terrain-row-${def.id}${!cfg.enabled ? ' pf-terrain-row--off' : ''}`}
                    >
                      {/* Enable toggle chip */}
                      <button
                        className={`pf-terrain-chip${cfg.enabled ? ' pf-terrain-chip--on' : ''}`}
                        onClick={() => setTerrainConfig(def.id, { enabled: !cfg.enabled })}
                        title={cfg.enabled ? 'Disable this terrain' : 'Enable this terrain'}
                      >
                        {def.symbol} {def.label}
                      </button>
                      {/* Weight control */}
                      <div className={`pf-terrain-weight-wrap${!cfg.enabled ? ' pf-terrain-weight-wrap--disabled' : ''}`}>
                        <input
                          type="range"
                          className="pf-terrain-slider"
                          min={1}
                          max={20}
                          value={cfg.weight}
                          disabled={!cfg.enabled}
                          onChange={(e) => setTerrainConfig(def.id, { weight: Number(e.target.value) })}
                        />
                        <span className="pf-terrain-weight-val">×{cfg.weight}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Route density */}
          <div className="pf-opt-row pf-opt-row--col">
            <span className="pf-opt-label">route density</span>
            <div className="pf-density-group">
              {DENSITY_OPTIONS.map((d) => (
                <button
                  key={d}
                  className={`pf-density-btn${options.routeDensity === d ? ' pf-density-btn--active' : ''}`}
                  onClick={() => onOptionsChange({ ...options, routeDensity: d })}
                >
                  <span className="pf-density-name">{d}</span>
                  <span className="pf-density-desc">{DENSITY_DESC[d]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Min path length */}
          <div className="pf-opt-row pf-opt-row--col">
            <div className="pf-opt-header">
              <span className="pf-opt-label">min path length</span>
              <span className="pf-opt-value">
                {options.minPathLength === 0 ? 'unconstrained' : `≥ ${options.minPathLength} cells`}
              </span>
            </div>
            <input
              type="range"
              className="pf-path-slider"
              min={0}
              max={maxPath}
              value={options.minPathLength}
              onChange={(e) => onOptionsChange({ ...options, minPathLength: Number(e.target.value) })}
            />
            <span className="pf-opt-desc">
              forces the shortest solution to traverse at least this many cells
              {options.minPathLength > Math.floor(maxPath * 0.7)
                ? ' — high values may slow generation'
                : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="pf-grid-scroll">
        <div
          ref={gridRef}
          className={`pf-grid${isDrawable ? ' pf-grid--drawable' : ' pf-grid--placeable'}`}
          style={{
            gridTemplateColumns: `repeat(${grid.cols}, ${CELL_PX}px)`,
            gridTemplateRows: `repeat(${grid.rows}, ${CELL_PX}px)`,
          }}
          onMouseDown={handleGridMouseDown}
          onMouseMove={handleGridMouseMove}
          onContextMenu={(e) => e.preventDefault()}
        >
          {grid.cells.map((row, r) =>
            row.map((cell, c) => (
              <Cell
                key={`${r}-${c}-${animKey}`}
                state={cell}
                animKey={animKey}
                row={r}
                col={c}
                delayMult={delayMult}
              />
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pf-builder-footer">
        <button className="pf-btn pf-btn-ghost" onClick={onBack}>← back</button>

        <div className="pf-legend">
          <span className="pf-legend-item">
            <span className="pf-legend-dot pf-cell-start" />start
          </span>
          <span className="pf-legend-item">
            <span className="pf-legend-dot pf-cell-end" />end
          </span>
          <span className="pf-legend-item">
            <span className="pf-legend-dot pf-cell-wall" />wall
          </span>
          {options.weighted && TERRAIN_DEFS.filter((t) => t.id !== 'plain').map((t) => {
            const cfg = options.terrainConfig[t.id];
            if (cfg?.enabled === false) return null;
            const weight = cfg?.weight ?? t.weight;
            return (
              <span key={t.id} className="pf-legend-item">
                <span className={`pf-legend-dot pf-cell-${t.id}`} />
                {t.label} <span className="pf-legend-weight">×{weight}</span>
              </span>
            );
          })}
        </div>

        <button className="pf-btn pf-btn-primary" onClick={onRun}>
          run algorithms →
        </button>
      </div>
    </div>
  );
}
