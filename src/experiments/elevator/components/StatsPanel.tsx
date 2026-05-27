import type { SimState } from '../types';

interface Props {
  state: SimState;
}

export default function StatsPanel({ state }: Props) {
  const servedCount = state.served.length;
  const avgWait = servedCount
    ? state.served.reduce(
        (sum, r) => sum + ((r.servedTick ?? state.tick) - r.bornTick),
        0,
      ) / servedCount
    : 0;
  const longestWait = state.served.reduce(
    (m, r) => Math.max(m, (r.servedTick ?? state.tick) - r.bornTick),
    0,
  );

  return (
    <div className="elev-stats">
      <div className="elev-stat">
        <span className="elev-stat-num">{state.totalTravel}</span>
        <span className="elev-stat-lbl">floors traveled</span>
      </div>
      <div className="elev-stat">
        <span className="elev-stat-num">{servedCount}</span>
        <span className="elev-stat-lbl">served</span>
      </div>
      <div className="elev-stat">
        <span className="elev-stat-num">{state.pending.length}</span>
        <span className="elev-stat-lbl">pending</span>
      </div>
      <div className="elev-stat">
        <span className="elev-stat-num">{avgWait ? avgWait.toFixed(1) : '–'}</span>
        <span className="elev-stat-lbl">avg wait</span>
      </div>
      <div className="elev-stat">
        <span className="elev-stat-num">{longestWait || '–'}</span>
        <span className="elev-stat-lbl">max wait</span>
      </div>
      <div className="elev-stat">
        <span className="elev-stat-num">{state.reversals}</span>
        <span className="elev-stat-lbl">reversals</span>
      </div>
    </div>
  );
}
