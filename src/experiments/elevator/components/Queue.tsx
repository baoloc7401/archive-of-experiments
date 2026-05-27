import type { SimState } from '../types';

interface Props {
  state: SimState;
}

export default function Queue({ state }: Props) {
  const upcoming = state.pending;
  return (
    <div className="elev-queue">
      <div className="elev-queue-head">
        <span>queue</span>
        <span className="elev-queue-count">{upcoming.length}</span>
      </div>
      {upcoming.length === 0 ? (
        <div className="elev-queue-empty">no pending calls</div>
      ) : (
        <ul className="elev-queue-list">
          {upcoming.map(r => {
            const wait = state.tick - r.bornTick;
            return (
              <li key={r.id} className="elev-queue-item">
                <span className="elev-queue-floor">F{String(r.floor).padStart(2, '0')}</span>
                <span className="elev-queue-wait" title="ticks waiting">
                  {wait}t
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
