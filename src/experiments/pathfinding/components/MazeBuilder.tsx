import { memo, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ScrambleText from '../../../components/ScrambleText';
import { Tooltip } from '../../../components/ui';
import type { CellState, DrawMode, GridConfig, MazeOptions, RouteDensity, TerrainConfig, TerrainType } from '../types';
import type { AlgorithmId } from '../types';
import {
  ALGORITHMS, CELL_PX, MIN_ROWS, MAX_ROWS, MIN_COLS, MAX_COLS,
  TERRAIN_DEFS,
} from '../constants';
import { makeDefaultGrid, generateMaze, computeTerrainWeights } from '../maze';

const NON_PLAIN_TERRAINS: TerrainType[] = ['grass', 'sand', 'water', 'mountain'];

// Longest path length the dimension sliders permit for an r×c board.
function getMaxPath(r: number, c: number) {
  return Math.min(100, Math.floor((r + c) * 1.8));
}

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
  const { t } = useTranslation();
  const [mode, setMode] = useState<DrawMode>('wall');
  const [rows, setRows] = useState(grid.rows);
  const [cols, setCols] = useState(grid.cols);
  const [showOptions, setShowOptions] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const gridRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const dragAction = useRef<CellState>('wall');
  const lastKey = useRef<string | null>(null);

  // Clamp minPathLength so it never exceeds what the new dimensions allow.
  function clampMinPath(r: number, c: number) {
    const max = getMaxPath(r, c);
    if (options.minPathLength > max) {
      onOptionsChange({ ...options, minPathLength: max });
    }
  }

  // Toggle terrain weighting; turning it off drops any active terrain draw mode
  // back to 'plain' so the user can't paint terrain that no longer applies.
  function handleWeightedToggle() {
    const weighted = !options.weighted;
    onOptionsChange({ ...options, weighted });
    if (!weighted && NON_PLAIN_TERRAINS.includes(mode as TerrainType)) {
      setMode('plain');
    }
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
    clampMinPath(val, cols);
  }

  function handleColsChange(val: number) {
    setCols(val);
    resizeTo(rows, val);
    clampMinPath(rows, val);
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

  return (
    <div className="pf-maze-builder">
      {/* Selected algorithms strip */}
      {selectedNames.length > 0 && (
        <div className="pf-algo-summary">
          <span className="pf-algo-summary-label"><ScrambleText text={t('experiments.pathfinding.build.algorithms')} duration={600} /></span>
          {selectedNames.map((n) => (
            <span key={n} className="pf-algo-chip"><ScrambleText text={n} duration={600} /></span>
          ))}
        </div>
      )}

      {/* Controls bar */}
      <div className="pf-controls">
        {/* Dimensions */}
        <div className="pf-dim-group">
          <label className="pf-dim-label">
            <span className="pf-dim-name"><ScrambleText text={t('experiments.pathfinding.build.rows')} duration={600} /></span>
            <span className="pf-dim-val">{rows}</span>
            <input
              type="range" min={MIN_ROWS} max={MAX_ROWS} value={rows}
              onChange={(e) => handleRowsChange(Number(e.target.value))}
            />
          </label>
          <label className="pf-dim-label">
            <span className="pf-dim-name"><ScrambleText text={t('experiments.pathfinding.build.cols')} duration={600} /></span>
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
          <span className="pf-group-label"><ScrambleText text={t('experiments.pathfinding.build.draw')} duration={600} /></span>
          <button
            className={`pf-mode-btn${mode === 'wall' ? ' pf-mode-btn--active' : ''}`}
            onClick={() => setMode('wall')}
          ><ScrambleText text={t('experiments.pathfinding.build.wall')} duration={600} /></button>
          <button
            className={`pf-mode-btn${mode === 'plain' ? ' pf-mode-btn--active' : ''}`}
            onClick={() => setMode('plain')}
          ><ScrambleText text={t('experiments.pathfinding.build.erase')} duration={600} /></button>

          {/* Terrain buttons — only enabled terrains when weighted */}
          {options.weighted && (
            <>
              <div className="pf-mode-divider" />
              {TERRAIN_DEFS.filter((td) => td.id !== 'plain' && options.terrainConfig[td.id]?.enabled !== false).map((td) => (
                <Tooltip key={td.id} label={t(`experiments.pathfinding.terrain.${td.id}_desc`)}>
                  <button
                    className={`pf-mode-btn pf-terrain-btn pf-terrain-btn-${td.id}${mode === td.id ? ' pf-mode-btn--active' : ''}`}
                    onClick={() => setMode(td.id)}
                  >
                    <ScrambleText text={`${td.symbol} ${t(`experiments.pathfinding.terrain.${td.id}_label`)}`} duration={600} />
                  </button>
                </Tooltip>
              ))}
            </>
          )}

          <div className="pf-mode-divider" />
          <button
            className={`pf-mode-btn${mode === 'start' ? ' pf-mode-btn--active' : ''}`}
            onClick={() => setMode('start')}
          ><ScrambleText text={t('experiments.pathfinding.build.start')} duration={600} /></button>
          <button
            className={`pf-mode-btn${mode === 'end' ? ' pf-mode-btn--active' : ''}`}
            onClick={() => setMode('end')}
          ><ScrambleText text={t('experiments.pathfinding.build.end')} duration={600} /></button>
        </div>

        <div className="pf-divider" />

        {/* Actions */}
        <div className="pf-action-group">
          <button
            className="pf-btn pf-btn-ghost"
            onClick={() => onGridChange(withWeights(makeDefaultGrid(rows, cols)))}
          >
            <ScrambleText text={t('experiments.pathfinding.build.clear')} duration={600} />
          </button>
          <Tooltip label={t('experiments.pathfinding.build.options_hint')}>
            <button
              className={`pf-btn pf-btn-ghost pf-btn-options${showOptions ? ' pf-btn-options--active' : ''}`}
              onClick={() => setShowOptions((s) => !s)}
            >
              <ScrambleText text={t('experiments.pathfinding.build.options')} duration={600} />
            </button>
          </Tooltip>
          <button className="pf-btn pf-btn-accent" onClick={handleRandomize}>
            <ScrambleText text={t('experiments.pathfinding.build.randomize')} duration={600} />
          </button>
        </div>
      </div>

      {/* Options panel */}
      <div className={`pf-options-panel${showOptions ? ' pf-options-panel--open' : ''}`}>
        <div className="pf-options-inner">
          {/* Weighted toggle */}
          <div className="pf-opt-row">
            <div className="pf-opt-info">
              <span className="pf-opt-label"><ScrambleText text={t('experiments.pathfinding.build.weighted_terrain')} duration={600} /></span>
              <span className="pf-opt-desc"><ScrambleText text={t('experiments.pathfinding.build.weighted_desc')} duration={600} /></span>
            </div>
            <button
              className={`pf-toggle${options.weighted ? ' pf-toggle--on' : ''}`}
              onClick={handleWeightedToggle}
              aria-pressed={options.weighted}
            >
              <span className="pf-toggle-knob" />
            </button>
          </div>

          {/* Terrain editor — only when weighted */}
          {options.weighted && (
            <div className="pf-opt-row pf-opt-row--col pf-terrain-editor-wrap">
              <span className="pf-opt-label"><ScrambleText text={t('experiments.pathfinding.build.terrain_weights')} duration={600} /></span>
              <div className="pf-terrain-editor">
                {TERRAIN_DEFS.filter((def) => def.id !== 'plain').map((def) => {
                  const cfg = options.terrainConfig[def.id] ?? { enabled: true, weight: def.weight };
                  return (
                    <div
                      key={def.id}
                      className={`pf-terrain-row pf-terrain-row-${def.id}${!cfg.enabled ? ' pf-terrain-row--off' : ''}`}
                    >
                      {/* Enable toggle chip */}
                      <Tooltip label={t(cfg.enabled ? 'experiments.pathfinding.build.disable_terrain' : 'experiments.pathfinding.build.enable_terrain')}>
                        <button
                          className={`pf-terrain-chip${cfg.enabled ? ' pf-terrain-chip--on' : ''}`}
                          onClick={() => setTerrainConfig(def.id, { enabled: !cfg.enabled })}
                        >
                          <ScrambleText text={`${def.symbol} ${t(`experiments.pathfinding.terrain.${def.id}_label`)}`} duration={600} />
                        </button>
                      </Tooltip>
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
            <span className="pf-opt-label"><ScrambleText text={t('experiments.pathfinding.build.route_density')} duration={600} /></span>
            <div className="pf-density-group">
              {DENSITY_OPTIONS.map((d) => (
                <button
                  key={d}
                  className={`pf-density-btn${options.routeDensity === d ? ' pf-density-btn--active' : ''}`}
                  onClick={() => onOptionsChange({ ...options, routeDensity: d })}
                >
                  <span className="pf-density-name"><ScrambleText text={t(`experiments.pathfinding.density.${d}_label`)} duration={600} /></span>
                  <span className="pf-density-desc"><ScrambleText text={t(`experiments.pathfinding.density.${d}_desc`)} duration={600} /></span>
                </button>
              ))}
            </div>
          </div>

          {/* Min path length */}
          <div className="pf-opt-row pf-opt-row--col">
            <div className="pf-opt-header">
              <span className="pf-opt-label"><ScrambleText text={t('experiments.pathfinding.build.min_path')} duration={600} /></span>
              <span className="pf-opt-value">
                <ScrambleText
                  text={options.minPathLength === 0
                    ? t('experiments.pathfinding.build.unconstrained')
                    : t('experiments.pathfinding.build.min_path_val', { n: options.minPathLength })}
                  duration={600}
                />
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
              <ScrambleText
                text={t(
                  options.minPathLength > Math.floor(maxPath * 0.7)
                    ? 'experiments.pathfinding.build.min_path_desc_slow'
                    : 'experiments.pathfinding.build.min_path_desc',
                )}
                duration={600}
              />
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
        <button className="pf-btn pf-btn-ghost" onClick={onBack}><ScrambleText text={t('experiments.pathfinding.build.back')} duration={600} /></button>

        <div className="pf-legend">
          <span className="pf-legend-item">
            <span className="pf-legend-dot pf-cell-start" /><ScrambleText text={t('experiments.pathfinding.build.legend_start')} duration={600} />
          </span>
          <span className="pf-legend-item">
            <span className="pf-legend-dot pf-cell-end" /><ScrambleText text={t('experiments.pathfinding.build.legend_end')} duration={600} />
          </span>
          <span className="pf-legend-item">
            <span className="pf-legend-dot pf-cell-wall" /><ScrambleText text={t('experiments.pathfinding.build.legend_wall')} duration={600} />
          </span>
          {options.weighted && TERRAIN_DEFS.filter((td) => td.id !== 'plain').map((td) => {
            const cfg = options.terrainConfig[td.id];
            if (cfg?.enabled === false) return null;
            const weight = cfg?.weight ?? td.weight;
            return (
              <span key={td.id} className="pf-legend-item">
                <span className={`pf-legend-dot pf-cell-${td.id}`} />
                <ScrambleText text={t(`experiments.pathfinding.terrain.${td.id}_label`)} duration={600} /> <span className="pf-legend-weight">×{weight}</span>
              </span>
            );
          })}
        </div>

        <button className="pf-btn pf-btn-primary" onClick={onRun}>
          <ScrambleText text={t('experiments.pathfinding.build.run_algorithms')} duration={600} />
        </button>
      </div>
    </div>
  );
}
