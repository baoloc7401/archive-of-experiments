import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ScrambleText from '../../../components/ScrambleText';
import { Tooltip } from '../../../components/ui';
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
  const { t } = useTranslation();
  const rows = useMemo(
    () => state.elevators.map(el => metricsFor(el, state.tick)),
    [state.elevators, state.tick],
  );

  if (rows.length === 1) {
    const m = rows[0];
    const cards: [string, string][] = [
      [String(m.travel), t('experiments.elevator.floors_traveled')],
      [String(m.served), t('experiments.elevator.served')],
      [String(m.pending), t('experiments.elevator.pending')],
      [m.avgWait ? m.avgWait.toFixed(1) : '–', t('experiments.elevator.avg_wait')],
      [m.maxWait ? String(m.maxWait) : '–', t('experiments.elevator.max_wait')],
      [String(m.reversals), t('experiments.elevator.reversals')],
    ];
    return (
      <div className="elev-stats">
        {cards.map(([num, lbl]) => (
          <div className="elev-stat" key={lbl}>
            <span className="elev-stat-num">{num}</span>
            <span className="elev-stat-lbl"><ScrambleText text={lbl} duration={600} /></span>
          </div>
        ))}
      </div>
    );
  }

  // Comparison table - lower is better for travel / avg wait / max wait.
  const bestTravel = Math.min(...rows.map(r => r.travel));
  const bestAvg = Math.min(...rows.filter(r => r.served > 0).map(r => r.avgWait));
  const bestMax = Math.min(...rows.filter(r => r.served > 0).map(r => r.maxWait));

  return (
    <div className="elev-cmp">
      <div className="elev-cmp-head">
        <span><ScrambleText text={t('experiments.elevator.comparison')} duration={600} /></span>
        <span className="elev-cmp-hint">
          <ScrambleText text={t('experiments.elevator.lower_better')} duration={600} />
        </span>
      </div>
      <div className="elev-cmp-table" role="table">
        <div className="elev-cmp-row elev-cmp-row--head" role="row">
          <span role="columnheader">algo</span>
          <Tooltip label={t('experiments.elevator.cmp_hint.trav')}><span role="columnheader">trav</span></Tooltip>
          <Tooltip label={t('experiments.elevator.cmp_hint.srv')}><span role="columnheader">srv</span></Tooltip>
          <Tooltip label={t('experiments.elevator.cmp_hint.avg')}><span role="columnheader">avg</span></Tooltip>
          <Tooltip label={t('experiments.elevator.cmp_hint.max')}><span role="columnheader">max</span></Tooltip>
          <Tooltip label={t('experiments.elevator.cmp_hint.rev')}><span role="columnheader">rev</span></Tooltip>
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
              <ScrambleText text={ALGORITHM_BY_ID[r.algorithm].name} duration={600} />
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
