import { useTranslation } from 'react-i18next';
import ScrambleText from '../../../components/ScrambleText';
import { trackTip } from '../../../components/ui/trackTip';
import '../../../components/ui/Tooltip.css';
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

const ORIGIN_LABEL_KEY: Record<RequestOrigin, string> = {
  'hall-up': 'experiments.elevator.hall_up_label',
  'hall-down': 'experiments.elevator.hall_down_label',
  car: 'experiments.elevator.car_dest_label',
};

export default function Queue({ activeCalls, tick }: Props) {
  const { t } = useTranslation();
  return (
    <div className="elev-queue">
      <div className="elev-queue-head">
        <span><ScrambleText text={t('experiments.elevator.outstanding_calls')} duration={600} /></span>
        <span className="elev-queue-count">{activeCalls.length}</span>
      </div>
      {activeCalls.length === 0 ? (
        <div className="elev-queue-empty">
          <ScrambleText text={t('experiments.elevator.no_pending')} duration={600} />
        </div>
      ) : (
        <ul className="elev-queue-list">
          {activeCalls.map(r => {
            const wait = tick - r.bornTick;
            return (
              <li
                key={`${r.floor}:${r.origin}`}
                className={`elev-queue-item elev-queue-item--${r.origin} ui-tip-host`}
                onMouseMove={(e) => trackTip(e.currentTarget, e)}
              >
                <span className="elev-queue-origin">{ORIGIN_GLYPH[r.origin]}</span>
                <span className="elev-queue-floor">F{String(r.floor).padStart(2, '0')}</span>
                <span className="elev-queue-wait">{wait}t</span>
                <span className="ui-tip" role="tooltip">{t(ORIGIN_LABEL_KEY[r.origin])}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
