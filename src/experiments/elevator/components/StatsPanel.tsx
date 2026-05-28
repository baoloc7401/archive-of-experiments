import { useMemo } from 'react';
import type { ElevatorState, SimState } from '../types';
import { ALGORITHM_BY_ID, SHAFT_COLORS } from '../constants';

interface Props {
  state: SimState;
}

interface Metrics {
  algorithm: ElevatorState['algorithm'];
  served: number;
  pending: number;
  travel: number;
  avgWait: number;
  maxWait: number;
  reversals: number;
}

function metricsFor(el: ElevatorState, tick: number): Metrics {
  const served = el.served.length;
  const avgWait = served
    ? el.served.reduce((s, r) => s + ((r.servedTick ?? tick) - r.bornTick), 0) / served
    : 0;
  const maxWait = el.served.reduce((m, r) => Math.max(m, (r.servedTick ?? tick) - r.bornTick), 0);
  return {
    algorithm: el.algorithm,
    served,
    pending: el.pending.length,
    travel: el.totalTravel,
    avgWait,
    maxWait,
    reversals: el.reversals,
  };
}

export default function StatsPanel({ state }: Props) {
  const rows = useMemo(
    () => state.elevators.map(el => metricsFor(el, state.tick)),
    [state.elevators, state.tick],
  );

  if (rows.length === 1) {
    const m = rows[0];
    const cards: [string, string][] = [
      [String(m.travel), 'floors traveled'],
      [String(m.served), 'served'],
      [String(m.pending), 'pending'],
      [m.avgWait ? m.avgWait.toFixed(1) : '–', 'avg wait'],
      [m.maxWait ? String(m.maxWait) : '–', 'max wait'],
      [String(m.reversals), 'reversals'],
    ];
    return (
      <div className="elev-stats">
        {cards.map(([num, lbl]) => (
          <div className="elev-stat" key={lbl}>
            <span className="elev-stat-num">{num}</span>
            <span className="elev-stat-lbl">{lbl}</span>
          </div>
        ))}
      </div>
    );
  }

  // Comparison table — lower is better for travel / avg wait / max wait.
  const bestTravel = Math.min(...rows.map(r => r.travel));
  const bestAvg = Math.min(...rows.filter(r => r.served > 0).map(r => r.avgWait));
  const bestMax = Math.min(...rows.filter(r => r.served > 0).map(r => r.maxWait));

  return (
    <div className="elev-cmp">
      <div className="elev-cmp-head">
        <span>comparison</span>
        <span className="elev-cmp-hint">lower = better</span>
      </div>
      <div className="elev-cmp-table" role="table">
        <div className="elev-cmp-row elev-cmp-row--head" role="row">
          <span role="columnheader">algo</span>
          <span role="columnheader" title="floors traveled">trav</span>
          <span role="columnheader" title="requests served">srv</span>
          <span role="columnheader" title="average wait (ticks)">avg</span>
          <span role="columnheader" title="max wait (ticks)">max</span>
          <span role="columnheader" title="direction reversals">rev</span>
        </div>
        {rows.map((r, i) => (
          <div
            className="elev-cmp-row"
            role="row"
            key={r.algorithm}
            style={{ '--shaft-color': SHAFT_COLORS[i % SHAFT_COLORS.length] } as React.CSSProperties}
          >
            <span className="elev-cmp-algo" role="cell">
              <span className="elev-cmp-swatch" aria-hidden="true" />
              {ALGORITHM_BY_ID[r.algorithm].name}
            </span>
            <span className={`elev-cmp-cell${r.travel === bestTravel ? ' elev-cmp-cell--best' : ''}`} role="cell">{r.travel}</span>
            <span className="elev-cmp-cell" role="cell">{r.served}</span>
            <span className={`elev-cmp-cell${r.served > 0 && r.avgWait === bestAvg ? ' elev-cmp-cell--best' : ''}`} role="cell">
              {r.served ? r.avgWait.toFixed(1) : '–'}
            </span>
            <span className={`elev-cmp-cell${r.served > 0 && r.maxWait === bestMax ? ' elev-cmp-cell--best' : ''}`} role="cell">
              {r.served ? r.maxWait : '–'}
            </span>
            <span className="elev-cmp-cell" role="cell">{r.reversals}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
