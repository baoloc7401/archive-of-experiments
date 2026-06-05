import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ScrambleText from '../../../components/ScrambleText';
import type { AlgoState } from '../algorithms';
import type { AlgorithmId, CellState, GridConfig } from '../types';
import { ALGORITHMS } from '../constants';

interface Props {
  algoId: AlgorithmId;
  grid: GridConfig;
  state: AlgoState;
  cellPx: number;
}

type Overlay = 'none' | 'visited' | 'frontier' | 'frontierB' | 'current' | 'path';

const OVERLAY_CLS: Record<Overlay, string> = {
  none:      '',
  visited:   'pf-vc-visited',
  frontier:  'pf-vc-frontier',
  frontierB: 'pf-vc-frontierb',
  current:   'pf-vc-current',
  path:      'pf-vc-path',
};

// Memoised individual cell — only re-renders when overlay or terrain changes
const VCell = memo(function VCell({
  terrain,
  overlay,
  px,
}: {
  terrain: CellState;
  overlay: Overlay;
  px: number;
}) {
  return (
    <div
      className={`pf-vcell pf-cell-${terrain} ${OVERLAY_CLS[overlay]}`}
      style={{ width: px, height: px }}
    />
  );
});

export default function AlgoPanel({ algoId, grid, state, cellPx }: Props) {
  const { t } = useTranslation();
  const def = ALGORITHMS.find((a) => a.id === algoId)!;

  const pathSet = useMemo(
    () => (state.path ? new Set(state.path) : new Set<string>()),
    [state.path],
  );

  function overlay(r: number, c: number): Overlay {
    const k = `${r},${c}`;
    const cell = grid.cells[r][c];
    if (cell === 'start' || cell === 'end') return 'none';
    if (state.current === k) return 'current';
    if (pathSet.has(k)) return 'path';
    if (state.frontierB?.has(k)) return 'frontierB';
    if (state.frontier.has(k)) return 'frontier';
    if (state.visited.has(k)) return 'visited';
    return 'none';
  }

  const statusLabel = {
    running:   t('experiments.pathfinding.run.searching'),
    found:     t('experiments.pathfinding.run.path_found'),
    'no-path': t('experiments.pathfinding.run.no_path'),
  }[state.status];

  const isWeighted = grid.cells.some((row) =>
    row.some((c) => c !== 'plain' && c !== 'wall' && c !== 'start' && c !== 'end'),
  );
  const showWeightWarning = algoId === 'jps' && isWeighted;

  return (
    <div className={`pf-panel pf-panel--${state.status}`}>
      {/* Header */}
      <div className="pf-panel-head">
        <div className="pf-panel-name"><ScrambleText text={def.name} duration={600} /></div>
        {showWeightWarning && (
          <span
            className="pf-panel-warn-icon"
            data-tip={t('experiments.pathfinding.run.jps_warn')}
          >⚠</span>
        )}
        <span className={`pf-panel-status pf-panel-status--${state.status}`}>
          <ScrambleText text={statusLabel} duration={600} />
        </span>
      </div>

      {/* Grid */}
      <div className="pf-panel-grid-wrap">
        <div
          className="pf-panel-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${grid.cols}, ${cellPx}px)`,
            gridTemplateRows: `repeat(${grid.rows}, ${cellPx}px)`,
            gap: '1px',
            background: 'var(--border)',
            border: '1px solid var(--border)',
          }}
        >
          {grid.cells.map((row, r) =>
            row.map((cell, c) => (
              <VCell
                key={`${r}-${c}`}
                terrain={cell}
                overlay={overlay(r, c)}
                px={cellPx}
              />
            )),
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="pf-panel-stats">
        <span className="pf-stat">
          <span className="pf-stat-label"><ScrambleText text={t('experiments.pathfinding.run.steps')} duration={600} /></span>
          <span className="pf-stat-val">{state.steps.toLocaleString()}</span>
        </span>
        {state.status === 'found' && state.path && (
          <>
            <span className="pf-stat">
              <span className="pf-stat-label"><ScrambleText text={t('experiments.pathfinding.run.path_len')} duration={600} /></span>
              <span className="pf-stat-val">{state.path.length - 1}</span>
            </span>
            {isWeighted && algoId !== 'jps' && (
              <span className="pf-stat">
                <span className="pf-stat-label"><ScrambleText text={t('experiments.pathfinding.run.cost')} duration={600} /></span>
                <span className="pf-stat-val">{state.pathCost.toFixed(0)}</span>
              </span>
            )}
          </>
        )}
        <span className="pf-stat">
          <span className="pf-stat-label"><ScrambleText text={t('experiments.pathfinding.run.visited')} duration={600} /></span>
          <span className="pf-stat-val">{state.visited.size.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}
