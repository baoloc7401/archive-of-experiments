import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ScrambleText from '../../../components/ScrambleText';
import { Tooltip } from '../../../components/ui';
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

const RANK_ASPECTS: RankAspect[] = ['visited', 'path-length', 'cost', 'steps'];

// i18n key (under experiments.pathfinding.run) for each aspect's label and unit.
const ASPECT_LABEL_KEY: Record<RankAspect, string> = {
  visited: 'explored',
  'path-length': 'path_length',
  cost: 'path_cost',
  steps: 'steps',
};
const ASPECT_UNIT_KEY: Partial<Record<RankAspect, string>> = {
  visited: 'nodes',
  'path-length': 'hops',
};

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

// Stable English ordinal used only as a CSS modifier (.pf-rank-pos--1st …).
function ordinalClass(rank: number) {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Run({ grid, selected, onBack }: Props) {
  const { t } = useTranslation();
  const ids = useMemo(() => [...selected], [selected]);

  const aspectLabel = (a: RankAspect) =>
    t(`experiments.pathfinding.run.${ASPECT_LABEL_KEY[a]}`);
  const ordinalText = (rank: number) =>
    rank <= 3
      ? t(`experiments.pathfinding.run.rank_${rank}`)
      : t('experiments.pathfinding.run.rank_n', { n: rank });

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

  // Build a fresh generator + done-flag for every selected algorithm. Ref-only,
  // so it's safe to call from an effect without triggering a render.
  const buildGenerators = useCallback(() => {
    gens.current = {};
    doneFlags.current = {};
    for (const id of ids) {
      gens.current[id] = ALGO_FACTORIES[id](grid);
      doneFlags.current[id] = false;
    }
  }, [ids, grid]);

  const resetAll = useCallback(() => {
    buildGenerators();
    setStates(Object.fromEntries(ids.map((id) => [id, makeInitialState(grid)])));
    setPlaying(false);
  }, [buildGenerators, ids, grid]);

  // Prime the generators on mount; `states` is already lazy-initialized to the
  // matching initial snapshots, so no setState is needed here.
  useEffect(() => {
    buildGenerators();
  }, [buildGenerators]);

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

  const visibleAspects = RANK_ASPECTS.filter(
    (a) => activeAspects.has(a) && (a !== 'cost' || isWeighted),
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
        <button className="pf-btn pf-btn-ghost" onClick={onBack}><ScrambleText text={t('experiments.pathfinding.run.back')} duration={600} /></button>

        <div className="pf-run-btns">
          <Tooltip label={t('experiments.pathfinding.run.reset_hint')}>
            <button className="pf-btn pf-btn-ghost" onClick={resetAll}><ScrambleText text={t('experiments.pathfinding.run.reset')} duration={600} /></button>
          </Tooltip>
          <button
            className="pf-btn pf-btn-accent"
            onClick={() => {
              if (finished) resetAll();
              else setPlaying((p) => !p);
            }}
          >
            <ScrambleText
              text={t(
                finished
                  ? 'experiments.pathfinding.run.replay'
                  : playing
                    ? 'experiments.pathfinding.run.pause'
                    : 'experiments.pathfinding.run.play',
              )}
              duration={600}
            />
          </button>
          <Tooltip label={t('experiments.pathfinding.run.step_hint')}>
            <button
              className="pf-btn pf-btn-ghost"
              disabled={playing || finished}
              onClick={() => stepAll(1)}
            ><ScrambleText text={t('experiments.pathfinding.run.step')} duration={600} /></button>
          </Tooltip>
        </div>

        <div className="pf-run-speed">
          <span className="pf-speed-label"><ScrambleText text={t('experiments.pathfinding.run.speed')} duration={600} /></span>
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
              const name = def.name.split(' ')[0];
              const summaryText =
                s.status === 'found'
                  ? t('experiments.pathfinding.run.summary_found', {
                      name,
                      hops: s.path!.length - 1,
                      steps: s.steps,
                    })
                  : `${name}: ${t('experiments.pathfinding.run.no_path')}`;
              return (
                <span key={id} className={`pf-summary-chip pf-summary-chip--${s.status}`}>
                  <ScrambleText text={summaryText} duration={600} />
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
            <span className="pf-rank-title"><ScrambleText text={t('experiments.pathfinding.run.rankings')} duration={600} /></span>
            <div className="pf-rank-aspects">
              {RANK_ASPECTS.filter((a) => a !== 'cost' || isWeighted).map((a) => (
                <button
                  key={a}
                  className={`pf-rank-aspect-btn${activeAspects.has(a) ? ' pf-rank-aspect-btn--on' : ''}`}
                  onClick={() => toggleAspect(a)}
                >
                  <ScrambleText text={aspectLabel(a)} duration={600} />
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

            const unitKey = ASPECT_UNIT_KEY[meta];
            return (
              <div key={meta} className="pf-rank-metric">
                <div className="pf-rank-metric-label">
                  <ScrambleText text={aspectLabel(meta)} duration={600} />
                  <span className="pf-rank-metric-hint"><ScrambleText text={t('experiments.pathfinding.run.fewer_better')} duration={600} /></span>
                </div>
                <div className="pf-rank-rows">
                  {ranked.map((entry) => {
                    const def = ALGORITHMS.find((a) => a.id === entry.id)!;
                    const noVal = entry.value === Infinity;
                    // Bar width proportional to value (longest bar = worst); best gets the visual accent
                    const barPct = noVal ? 0 : ((entry.value - minVal) / span) * 80 + 10;
                    return (
                      <div
                        key={entry.id}
                        className={`pf-rank-row${noVal ? ' pf-rank-row--nopath' : ''}${entry.rank === 1 && !noVal ? ' pf-rank-row--best' : ''}`}
                      >
                        <span className={`pf-rank-pos pf-rank-pos--${ordinalClass(entry.rank)}`}><ScrambleText text={ordinalText(entry.rank)} duration={600} /></span>
                        <span className="pf-rank-name"><ScrambleText text={def.name} duration={600} /></span>
                        <div className="pf-rank-bar-wrap">
                          <div
                            className="pf-rank-bar"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="pf-rank-val">
                          <ScrambleText
                            text={noVal
                              ? t('experiments.pathfinding.run.no_path')
                              : unitKey
                                ? `${entry.value.toLocaleString()} ${t(`experiments.pathfinding.run.${unitKey}`)}`
                                : entry.value.toLocaleString()}
                            duration={600}
                          />
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
