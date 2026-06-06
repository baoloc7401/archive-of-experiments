import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ScrambleText from '../../../components/ScrambleText';
import { Tooltip } from '../../../components/ui';
import type { ElevatorRequest, ElevatorState, RequestOrigin, SimState } from '../types';
import { ALGORITHM_BY_ID, SHAFT_COLORS } from '../constants';

interface FloorCalls {
  up: boolean;
  down: boolean;
  car: boolean;
}

interface Props {
  state: SimState;
  activeCalls: ElevatorRequest[];
  tickMs: number;
  onHallCall: (floor: number, origin: RequestOrigin) => void;
}

export default function Building({ state, activeCalls, tickMs, onHallCall }: Props) {
  const { t } = useTranslation();
  // Shared hall-call panel reflects the master workload (union across cars).
  const callsByFloor = useMemo(() => {
    const map = new Map<number, FloorCalls>();
    for (const r of activeCalls) {
      const c = map.get(r.floor) ?? { up: false, down: false, car: false };
      if (r.origin === 'hall-up') c.up = true;
      else if (r.origin === 'hall-down') c.down = true;
      else c.car = true;
      map.set(r.floor, c);
    }
    return map;
  }, [activeCalls]);

  const floors = Array.from({ length: state.totalFloors }, (_, i) => state.totalFloors - 1 - i);
  const top = state.totalFloors - 1;

  const buildingStyle = {
    '--elev-rows': state.totalFloors,
    '--elev-move-ms': `${Math.max(60, Math.round(tickMs * 0.92))}ms`,
  } as React.CSSProperties;

  return (
    <div className="elev-building" style={buildingStyle} aria-label={t('experiments.elevator.building_label')}>
      <div className="elev-axis">
        <div className="elev-axis-head" aria-hidden="true">
          <ScrambleText text={t('experiments.elevator.floor')} duration={600} />
        </div>
        <div className="elev-floors">
          {floors.map(f => {
            const calls = callsByFloor.get(f);
            const pending = !!calls;
            return (
              <div key={f} className={`elev-floor${pending ? ' elev-floor--pending' : ''}`}>
                <span className="elev-floor-num">{String(f).padStart(2, '0')}</span>
                <Tooltip label={t('experiments.elevator.car_dest_tag')}>
                  <span className={`elev-floor-car-tag${calls?.car ? ' elev-floor-car-tag--on' : ''}`}>
                    <ScrambleText text={t('experiments.elevator.car')} duration={600} />
                  </span>
                </Tooltip>
                <div className="elev-hall" aria-label={t('experiments.elevator.hall_panel_label', { n: f })}>
                  {f < top && (
                    <button
                      type="button"
                      className={`elev-hall-btn elev-hall-btn--up${calls?.up ? ' elev-hall-btn--on' : ''}`}
                      onClick={() => onHallCall(f, 'hall-up')}
                      aria-label={t('experiments.elevator.call_up', { n: f })}
                      aria-pressed={!!calls?.up}
                    >
                      ▲
                    </button>
                  )}
                  {f > 0 && (
                    <button
                      type="button"
                      className={`elev-hall-btn elev-hall-btn--down${calls?.down ? ' elev-hall-btn--on' : ''}`}
                      onClick={() => onHallCall(f, 'hall-down')}
                      aria-label={t('experiments.elevator.call_down', { n: f })}
                      aria-pressed={!!calls?.down}
                    >
                      ▼
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`elev-shafts${state.elevators.length > 1 ? ' elev-shafts--multi' : ''}`}>
        {state.elevators.map((el, idx) => (
          <Shaft key={el.algorithm} elevator={el} totalFloors={state.totalFloors} index={idx} />
        ))}
      </div>
    </div>
  );
}

interface ShaftProps {
  elevator: ElevatorState;
  totalFloors: number;
  index: number;
}

function Shaft({ elevator, totalFloors, index }: ShaftProps) {
  const floors = Array.from({ length: totalFloors }, (_, i) => totalFloors - 1 - i);
  const rowFromTop = totalFloors - 1 - elevator.position;
  // During a C-SCAN / C-LOOK non-stop express return the car physically
  // descends floor-by-floor (no teleport) - just flagged for styling.
  const expressing = elevator.express !== null;

  const pendingFloors = useMemo(() => {
    const set = new Set<number>();
    for (const r of elevator.pending) set.add(r.floor);
    return set;
  }, [elevator.pending]);

  const info = ALGORITHM_BY_ID[elevator.algorithm];

  return (
    <div
      className="elev-shaft-col"
      style={{ '--elev-shaft-i': index, '--shaft-color': SHAFT_COLORS[index % SHAFT_COLORS.length] } as React.CSSProperties}
    >
      <div className="elev-shaft-header">
        <span className="elev-shaft-name"><ScrambleText text={info.name} duration={600} /></span>
        <span className="elev-shaft-metric">{elevator.totalTravel}f</span>
      </div>
      <div className="elev-shaft-frame">
        <div className="elev-shaft">
          {floors.map((f, i) => (
            <div
              className={`elev-shaft-cell${i === 0 ? ' elev-shaft-cell--top' : ''}${pendingFloors.has(f) ? ' elev-shaft-cell--target' : ''}${elevator.flashFloor === f ? ' elev-shaft-cell--flash' : ''}`}
              key={`cell-${f}`}
              aria-hidden="true"
            />
          ))}
          <div
            className={`elev-car elev-car--${elevator.direction}${expressing ? ' elev-car--express' : ''}${elevator.idle ? ' elev-car--idle' : ''}`}
            /* Concrete transform value (not via a CSS var) so the transition
               actually fires - unregistered custom properties are substituted
               at used-value time, so a var-driven transform never animates. */
            style={{ transform: `translate(-50%, ${rowFromTop * 100}%)` }}
          >
            <div className="elev-car-body">
              <div className="elev-car-door elev-car-door--l" />
              <div className="elev-car-door elev-car-door--r" />
              <div className="elev-car-display">
                <span className="elev-car-floor-num">{elevator.position}</span>
                <span className="elev-car-arrow">
                  {elevator.idle ? '·' : elevator.direction === 'up' ? '▲' : '▼'}
                </span>
              </div>
            </div>
            <div className="elev-car-glow" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
