import { useTranslation } from '@/hooks/useTranslation';
import ScrambleText from '@/components/ScrambleText';
import type { Color, PieceType } from '../types';
import { SYMBOLS } from '../constants';

interface Props {
  turn: Color;
  onPromote: (type: PieceType) => void;
}

export function PromotionDialog({ turn, onPromote }: Props) {
  const { t } = useTranslation();
  return (
    <div className="chess-promotion-overlay">
      <div className="chess-promotion-dialog">
        <p className="chess-promotion-label"><ScrambleText text={t('chess.promote_to')} duration={600} /></p>
        <div className="chess-promotion-options">
          {(['Q', 'R', 'B', 'N'] as PieceType[]).map(pt => (
            <button
              key={pt}
              className="chess-promotion-btn"
              onClick={() => onPromote(pt)}
              aria-label={pt}
            >
              {SYMBOLS[turn + pt]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
