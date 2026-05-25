import { useEffect, useRef, useState, useCallback } from 'react';
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

export default function Run({ grid, selected, onBack }: Props) {
  const ids = [...selected];

  // Generator refs — reset on mount
  const gens = useRef<Partial<Record<AlgorithmId, AlgoGen>>>({});
  const doneFlags = useRef<Partial<Record<AlgorithmId, boolean>>>({});

  const [states, setStates] = useState<Partial<Record<AlgorithmId, AlgoState>>>(() =>
    Object.fromEntries(ids.map((id) => [id, makeInitialState(grid)])),
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(40); // 1–100

  const resetAll = useCallback(() => {
    gens.current = {};
    doneFlags.current = {};
    for (const id of ids) {
      gens.current[id] = ALGO_FACTORIES[id](grid);
      doneFlags.current[id] = false;
    }
    setStates(Object.fromEntries(ids.map((id) => [id, makeInitialState(grid)])));
    setPlaying(false);
  }, [grid, ids.join(',')]);

  // Initialise on mount
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
  }, [ids]);

  // Auto-play interval
  useEffect(() => {
    if (!playing) return;
    // stepsPerTick: 1 at speed=1, up to 20 at speed=100
    const stepsPerTick = Math.max(1, Math.floor(speed / 5));
    const tickMs = Math.max(16, 220 - speed * 2);
    const id = setInterval(() => {
      if (allDone()) { setPlaying(false); return; }
      stepAll(stepsPerTick);
    }, tickMs);
    return () => clearInterval(id);
  }, [playing, speed, stepAll, allDone]);

  // Cell px: scale down when many panels
  const n = ids.length;
  const cellPx = n >= 5 ? 8 : n >= 3 ? 10 : n === 2 ? 12 : Math.min(CELL_PX, 14);

  const finished = ids.every((id) => states[id]?.status !== 'running');

  return (
    <div className="pf-run">
      {/* Controls */}
      <div className="pf-run-controls">
        <button className="pf-btn pf-btn-ghost" onClick={onBack}>← back</button>

        <div className="pf-run-btns">
          <button
            className="pf-btn pf-btn-ghost"
            onClick={resetAll}
            title="Reset"
          >⏮ reset</button>
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

        {/* Summary when all done */}
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
    </div>
  );
}
