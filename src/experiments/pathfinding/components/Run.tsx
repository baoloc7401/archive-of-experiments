import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { AlgorithmId, GridConfig } from '../types';
import type { AlgoGen, AlgoState } from '../algorithms';
import { ALGO_FACTORIES } from '../algorithms';
import { ALGORITHMS, CELL_PX } from '../constants';
import AlgoPanel from './AlgoPanel';

interface Props {
  grid: GridConfig;
  selected: Set<AlgorithmId>;
  onBack: () => void;
}

function makeInitialState(grid: GridConfig): AlgoState {
  return {
    visited: new Set(),
    frontier: new Set([`${grid.start[0]},${grid.start[1]}`]),
    current: null,
    path: null,
    status: 'running',
    steps: 0,
    pathCost: 0,
  };
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

type RankAspect = 'visited' | 'path-length' | 'cost' | 'steps';

const RANK_META: { id: RankAspect; label: string; unit: string; pathOnly: boolean }[] = [
  { id: 'visited',     label: 'explored',    unit: 'nodes',  pathOnly: false },
  { id: 'path-length', label: 'path length', unit: 'hops',   pathOnly: true  },
  { id: 'cost',        label: 'path cost',   unit: '',       pathOnly: true  },
  { id: 'steps',       label: 'steps',       unit: '',       pathOnly: false },
];

interface RankEntry {
  id: AlgorithmId;
  value: number; // Infinity = no-path / N/A
}

function computeRanking(
  aspect: RankAspect,
  ids: AlgorithmId[],
  states: Partial<Record<AlgorithmId, AlgoState>>,
): RankEntry[] {
  return ids
    .map((id): RankEntry => {
      const s = states[id];
      if (!s) return { id, value: Infinity };
      const found = s.status === 'found';
      switch (aspect) {
        case 'visited':     return { id, value: s.visited.size };
        case 'steps':       return { id, value: s.steps };
        case 'path-length': return { id, value: found && s.path ? s.path.length - 1 : Infinity };
        case 'cost':        return { id, value: found ? s.pathCost : Infinity };
      }
    })
    .sort((a, b) => a.value - b.value);
}

// Assign ordinal rank (ties share the same rank)
function withRank(entries: RankEntry[]): (RankEntry & { rank: number })[] {
  let rank = 1;
  return entries.map((e, i, arr) => {
    if (i > 0 && arr[i - 1].value !== e.value) rank = i + 1;
    return { ...e, rank };
  });
}

function rankLabel(rank: number) {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Run({ grid, selected, onBack }: Props) {
  const ids = [...selected];

  const gens = useRef<Partial<Record<AlgorithmId, AlgoGen>>>({});
  const doneFlags = useRef<Partial<Record<AlgorithmId, boolean>>>({});

  const [states, setStates] = useState<Partial<Record<AlgorithmId, AlgoState>>>(() =>
    Object.fromEntries(ids.map((id) => [id, makeInitialState(grid)])),
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(40);
  const [activeAspects, setActiveAspects] = useState<Set<RankAspect>>(
    () => new Set<RankAspect>(['visited', 'path-length', 'steps']),
  );

  const resetAll = useCallback(() => {
    gens.current = {};
    doneFlags.current = {};
    for (const id of ids) {
      gens.current[id] = ALGO_FACTORIES[id](grid);
      doneFlags.current[id] = false;
    }
    setStates(Object.fromEntries(ids.map((id) => [id, makeInitialState(grid)])));
    setPlaying(false);
  }, [grid, ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    resetAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allDone = useCallback(() =>
    ids.every((id) => doneFlags.current[id] === true),
  [ids]);

  const stepAll = useCallback((count: number) => {
    const updates: Partial<Record<AlgorithmId, AlgoState>> = {};
    for (const id of ids) {
      if (doneFlags.current[id]) continue;
      const gen = gens.current[id];
      if (!gen) continue;
      let last: AlgoState | undefined;
      for (let i = 0; i < count; i++) {
        const res = gen.next();
        if (res.done || res.value === undefined) {
          doneFlags.current[id] = true;
          break;
        }
        last = res.value;
        if (last.status !== 'running') {
          doneFlags.current[id] = true;
          break;
        }
      }
      if (last) updates[id] = last;
    }
    if (Object.keys(updates).length > 0) {
      setStates((prev) => ({ ...prev, ...updates }));
    }
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return;
    const stepsPerTick = Math.max(1, Math.floor(speed / 5));
    const tickMs = Math.max(16, 220 - speed * 2);
    const id = setInterval(() => {
      if (allDone()) { setPlaying(false); return; }
      stepAll(stepsPerTick);
    }, tickMs);
    return () => clearInterval(id);
  }, [playing, speed, stepAll, allDone]);

  const n = ids.length;
  const cellPx = n >= 5 ? 8 : n >= 3 ? 10 : n === 2 ? 12 : Math.min(CELL_PX, 14);

  const finished = ids.every((id) => states[id]?.status !== 'running');

  // Show cost metric only when the grid has weighted terrain
  const isWeighted = useMemo(
    () => grid.cells.some((row) =>
      row.some((c) => c !== 'plain' && c !== 'wall' && c !== 'start' && c !== 'end')
    ),
    [grid],
  );

  const visibleAspects = RANK_META.filter(
    (m) => activeAspects.has(m.id) && (m.id !== 'cost' || isWeighted),
  );

  function toggleAspect(a: RankAspect) {
    setActiveAspects((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  return (
    <div className="pf-run">
      {/* Controls */}
      <div className="pf-run-controls">
        <button className="pf-btn pf-btn-ghost" onClick={onBack}>← back</button>

        <div className="pf-run-btns">
          <button className="pf-btn pf-btn-ghost" onClick={resetAll} title="Reset">⏮ reset</button>
          <button
            className="pf-btn pf-btn-accent"
            onClick={() => {
              if (finished) resetAll();
              else setPlaying((p) => !p);
            }}
          >
            {finished ? '⏮ replay' : playing ? '⏸ pause' : '▶ play'}
          </button>
          <button
            className="pf-btn pf-btn-ghost"
            disabled={playing || finished}
            onClick={() => stepAll(1)}
            title="Step once"
          >step</button>
        </div>

        <div className="pf-run-speed">
          <span className="pf-speed-label">speed</span>
          <input
            type="range"
            min={1} max={100}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="pf-speed-slider"
          />
          <span className="pf-speed-val">{speed}</span>
        </div>

        {/* Summary chips when all done */}
        {finished && (
          <div className="pf-run-summary">
            {ids.map((id) => {
              const s = states[id];
              if (!s) return null;
              const def = ALGORITHMS.find((a) => a.id === id)!;
              return (
                <span key={id} className={`pf-summary-chip pf-summary-chip--${s.status}`}>
                  {def.name.split(' ')[0]}:{' '}
                  {s.status === 'found'
                    ? `${s.path!.length - 1} hops · ${s.steps} steps`
                    : s.status}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Panels */}
      <div className="pf-panels" data-count={n}>
        {ids.map((id) => (
          <AlgoPanel
            key={id}
            algoId={id}
            grid={grid}
            state={states[id] ?? makeInitialState(grid)}
            cellPx={cellPx}
          />
        ))}
      </div>

      {/* Rankings — shown when all algorithms are done */}
      {finished && (
        <div className="pf-rankings">
          <div className="pf-rank-header">
            <span className="pf-rank-title">rankings</span>
            <div className="pf-rank-aspects">
              {RANK_META.filter((m) => m.id !== 'cost' || isWeighted).map((m) => (
                <button
                  key={m.id}
                  className={`pf-rank-aspect-btn${activeAspects.has(m.id) ? ' pf-rank-aspect-btn--on' : ''}`}
                  onClick={() => toggleAspect(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {visibleAspects.map((meta) => {
            const ranked = withRank(computeRanking(meta.id, ids, states));
            const finiteVals = ranked.filter((e) => e.value !== Infinity).map((e) => e.value);
            const maxVal = finiteVals.length > 0 ? Math.max(...finiteVals) : 1;
            const minVal = finiteVals.length > 0 ? Math.min(...finiteVals) : 0;
            const span = maxVal - minVal || 1;

            return (
              <div key={meta.id} className="pf-rank-metric">
                <div className="pf-rank-metric-label">
                  {meta.label}
                  <span className="pf-rank-metric-hint">fewer = better</span>
                </div>
                <div className="pf-rank-rows">
                  {ranked.map((entry) => {
                    const def = ALGORITHMS.find((a) => a.id === entry.id)!;
                    const noVal = entry.value === Infinity;
                    // Bar width proportional to value (longest bar = worst); best gets the visual accent
                    const barPct = noVal ? 0 : ((entry.value - minVal) / span) * 80 + 10;
                    const label = rankLabel(entry.rank);
                    return (
                      <div
                        key={entry.id}
                        className={`pf-rank-row${noVal ? ' pf-rank-row--nopath' : ''}${entry.rank === 1 && !noVal ? ' pf-rank-row--best' : ''}`}
                      >
                        <span className={`pf-rank-pos pf-rank-pos--${label}`}>{label}</span>
                        <span className="pf-rank-name">{def.name}</span>
                        <div className="pf-rank-bar-wrap">
                          <div
                            className="pf-rank-bar"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="pf-rank-val">
                          {noVal
                            ? 'no path'
                            : meta.unit
                              ? `${entry.value.toLocaleString()} ${meta.unit}`
                              : entry.value.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
