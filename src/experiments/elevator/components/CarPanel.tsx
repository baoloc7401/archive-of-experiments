import { useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import ScrambleText from '@/components/ScrambleText';
import type { ElevatorRequest, SimState } from '../types';

interface Props {
  state: SimState;
  activeCalls: ElevatorRequest[];
  onCarCall: (floor: number) => void;
}

export default function CarPanel({ state, activeCalls, onCarCall }: Props) {
  const { t } = useTranslation();
  const carFloors = useMemo(() => {
    const set = new Set<number>();
    for (const r of activeCalls) if (r.origin === 'car') set.add(r.floor);
    return set;
  }, [activeCalls]);

  const floors = Array.from({ length: state.totalFloors }, (_, i) => state.totalFloors - 1 - i);
  const single = state.elevators.length === 1 ? state.elevators[0] : null;

  const readout = single
    ? `${String(single.position).padStart(2, '0')}`
    : `×${state.elevators.length}`;
  const dirGlyph = single ? (single.idle ? '·' : single.direction === 'up' ? '▲' : '▼') : '⇅';

  return (
    <div className="elev-cop">
      <div className="elev-cop-head">
        <span className="elev-cop-title">
          <ScrambleText text={t('experiments.elevator.cop_label')} duration={600} />
        </span>
        <span className="elev-cop-readout">
          <span className="elev-cop-readout-num">{readout}</span>
          <span className="elev-cop-readout-dir">{dirGlyph}</span>
        </span>
      </div>
      <div className="elev-cop-grid">
        {floors.map(f => {
          const lit = carFloors.has(f);
          const here = single ? single.position === f : false;
          return (
            <button
              key={f}
              type="button"
              className={`elev-cop-btn${lit ? ' elev-cop-btn--lit' : ''}${here ? ' elev-cop-btn--here' : ''}`}
              onClick={() => onCarCall(f)}
              aria-label={t('experiments.elevator.go_to_floor', { n: f })}
              aria-pressed={lit}
            >
              {f}
            </button>
          );
        })}
      </div>
      <div className="elev-cop-hint">
        <ScrambleText
          text={single ? t('experiments.elevator.cop_hint_single') : t('experiments.elevator.cop_hint_multi')}
          duration={600}
        />
      </div>
    </div>
  );
}
