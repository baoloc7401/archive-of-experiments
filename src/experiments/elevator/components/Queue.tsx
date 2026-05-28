import type { ElevatorRequest, RequestOrigin } from '../types';

interface Props {
  activeCalls: ElevatorRequest[];
  tick: number;
}

const ORIGIN_GLYPH: Record<RequestOrigin, string> = {
  'hall-up': '▲',
  'hall-down': '▼',
  car: '●',
};

const ORIGIN_LABEL: Record<RequestOrigin, string> = {
  'hall-up': 'hall call, going up',
  'hall-down': 'hall call, going down',
  car: 'in-car destination',
};

export default function Queue({ activeCalls, tick }: Props) {
  return (
    <div className="elev-queue">
      <div className="elev-queue-head">
        <span>outstanding calls</span>
        <span className="elev-queue-count">{activeCalls.length}</span>
      </div>
      {activeCalls.length === 0 ? (
        <div className="elev-queue-empty">no pending calls</div>
      ) : (
        <ul className="elev-queue-list">
          {activeCalls.map(r => {
            const wait = tick - r.bornTick;
            return (
              <li
                key={`${r.floor}:${r.origin}`}
                className={`elev-queue-item elev-queue-item--${r.origin}`}
                title={ORIGIN_LABEL[r.origin]}
              >
                <span className="elev-queue-origin">{ORIGIN_GLYPH[r.origin]}</span>
                <span className="elev-queue-floor">F{String(r.floor).padStart(2, '0')}</span>
                <span className="elev-queue-wait" title="ticks waiting">{wait}t</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
