import { useMemo } from 'react';
import type { SimState } from '../types';

interface Props {
  state: SimState;
  onCall: (floor: number) => void;
}

export default function Building({ state, onCall }: Props) {
  const pendingFloors = useMemo(() => {
    const set = new Set<number>();
    for (const r of state.pending) set.add(r.floor);
    return set;
  }, [state.pending]);

  const floors = Array.from({ length: state.totalFloors }, (_, i) => state.totalFloors - 1 - i);

  // Row index from the top (0 = top floor). Used to translate the car
  // by exactly N * row-height inside the shaft, so it lands centered in
  // the same row the corresponding floor label occupies.
  const rowFromTop = state.totalFloors - 1 - state.position;
  const isJumping = state.jumpFrom !== null;

  const buildingStyle = { '--elev-rows': state.totalFloors } as React.CSSProperties;

  return (
    <div
      className="elev-building"
      style={buildingStyle}
      aria-label="elevator building"
    >
      <div className="elev-shaft-frame">
        <div className="elev-shaft">
          {floors.map((f, idx) => (
            <div
              className={`elev-shaft-cell${idx === 0 ? ' elev-shaft-cell--top' : ''}`}
              key={`cell-${f}`}
              aria-hidden="true"
            />
          ))}
          <div
            className={`elev-car elev-car--${state.direction}${isJumping ? ' elev-car--jumping' : ''}${state.status === 'idle' ? ' elev-car--idle' : ''}`}
            style={{ '--elev-row': rowFromTop } as React.CSSProperties}
          >
            <div className="elev-car-body">
              <div className="elev-car-door elev-car-door--l" />
              <div className="elev-car-door elev-car-door--r" />
              <div className="elev-car-display">
                <span className="elev-car-floor-num">{state.position}</span>
                <span className="elev-car-arrow">
                  {state.status === 'idle' ? '·' : state.direction === 'up' ? '▲' : '▼'}
                </span>
              </div>
            </div>
            <div className="elev-car-glow" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="elev-floors">
        {floors.map(f => {
          const pending = pendingFloors.has(f);
          const flash = state.flashFloor === f;
          const here = state.position === f;
          return (
            <div
              key={f}
              className={`elev-floor${pending ? ' elev-floor--pending' : ''}${flash ? ' elev-floor--flash' : ''}${here ? ' elev-floor--here' : ''}`}
            >
              <span className="elev-floor-num">{String(f).padStart(2, '0')}</span>
              <button
                type="button"
                className="elev-call-btn"
                onClick={() => onCall(f)}
                aria-label={`call elevator to floor ${f}`}
                aria-pressed={pending}
              >
                <span className="elev-call-dot" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
