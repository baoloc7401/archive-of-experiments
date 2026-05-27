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
  copyGrades: boolean;
  onToggleCopyGrades: (v: boolean) => void;
  historyRef: React.RefObject<HTMLDivElement | null>;
  onCopy: () => void;
}

export function MoveHistory({ rounds, moveGrades, copied, copyGrades, onToggleCopyGrades, historyRef, onCopy }: Props) {
  const { t } = useTranslation();
  return (
    <div className="chess-history">
      <div className="chess-history-header">
        <span>{t('chess.history_title')}</span>
        {rounds.length > 0 && (
          <div className="chess-history-actions">
            <label className="chess-copy-toggle" title={t('chess.copy_grades_hint')}>
              <input
                type="checkbox"
                checked={copyGrades}
                onChange={e => onToggleCopyGrades(e.target.checked)}
              />
              <span>{t('chess.copy_grades')}</span>
            </label>
            <button className="chess-copy-btn" onClick={onCopy}>
              {copied ? t('chess.copied') : t('chess.copy')}
            </button>
          </div>
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
