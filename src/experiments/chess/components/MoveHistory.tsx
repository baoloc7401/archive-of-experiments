import { useTranslation } from 'react-i18next';
import type { Move } from '../types';
import { gradeInfo, moveLabel } from '../utils';

function MoveCell({ label, grade }: { label: string; grade?: number }) {
  const info = gradeInfo(grade);
  return (
    <span className="chess-move-cell">
      {label}
      {info && <span className={`chess-grade ${info.cls}`}>{info.sym}</span>}
    </span>
  );
}

interface Props {
  rounds: [Move, Move | null][];
  moveGrades: (number | undefined)[];
  copied: boolean;
  historyRef: React.RefObject<HTMLDivElement | null>;
  onCopy: () => void;
}

export function MoveHistory({ rounds, moveGrades, copied, historyRef, onCopy }: Props) {
  const { t } = useTranslation();
  return (
    <div className="chess-history">
      <div className="chess-history-header">
        {t('chess.history_title')}
        {rounds.length > 0 && (
          <button className="chess-copy-btn" onClick={onCopy}>
            {copied ? t('chess.copied') : t('chess.copy')}
          </button>
        )}
      </div>
      <div className="chess-history-list" ref={historyRef}>
        {rounds.length === 0
          ? <div className="chess-history-empty">{t('chess.no_moves')}</div>
          : rounds.map(([w, b], i) => (
              <div key={i} className={`chess-move-row${i === rounds.length - 1 ? ' chess-move-row--last' : ''}`}>
                <span className="chess-move-num">{i + 1}</span>
                <MoveCell label={moveLabel(w)} grade={moveGrades[i * 2]} />
                {b
                  ? <MoveCell label={moveLabel(b)} grade={moveGrades[i * 2 + 1]} />
                  : <span />
                }
              </div>
            ))
        }
      </div>
    </div>
  );
}
