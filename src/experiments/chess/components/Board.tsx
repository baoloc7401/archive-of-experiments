import type { Move, Position } from '../types';
import type { SlideInfo } from '../hooks/useChessGame';
import { FILES, RANKS, SYMBOLS } from '../constants';
import { sqName } from '../utils';

interface Props {
  pos: Position;
  selected: [number, number] | null;
  lastMove: Move | null;
  moveTos: Set<string>;
  checkKingSq: [number, number] | null;
  slideInfo: SlideInfo | null;
  castleRookSlide: SlideInfo | null;
  historyLength: number;
  boardGridRef: React.RefObject<HTMLDivElement | null>;
  onSquareClick: (r: number, c: number) => void;
}

export function Board({
  pos, selected, lastMove, moveTos, checkKingSq,
  slideInfo, castleRookSlide, historyLength, boardGridRef, onSquareClick,
}: Props) {
  return (
    <div className="chess-board-wrap">
      <div className="chess-ranks">
        {RANKS.map(r => <div key={r} className="chess-label">{r}</div>)}
      </div>

      <div className="chess-board-inner">
        <div className="chess-board" ref={boardGridRef}>
          {Array.from({ length: 64 }, (_, i) => {
            const r = Math.floor(i / 8);
            const c = i % 8;
            const key = `${r},${c}`;
            const piece = pos.board[r][c];
            const isLight = (r + c) % 2 === 0;
            const isSelected = selected?.[0] === r && selected?.[1] === c;
            const isMoveTo = moveTos.has(key);
            const isCheck = checkKingSq?.[0] === r && checkKingSq?.[1] === c;
            const isLastFrom = lastMove?.from[0] === r && lastMove?.from[1] === c;
            const isLastTo   = lastMove?.to[0] === r   && lastMove?.to[1] === c;
            const isCapture = isMoveTo && !!piece;

            const isSliding = slideInfo?.toRow === r && slideInfo?.toCol === c;
            const isRookSliding = castleRookSlide?.toRow === r && castleRookSlide?.toCol === c;
            const slide = isSliding ? slideInfo : isRookSliding ? castleRookSlide : null;

            let cls = `chess-square ${isLight ? 'sq-light' : 'sq-dark'}`;
            if (isSelected)      cls += ' sq-selected';
            else if (isLastFrom) cls += ' sq-last-from';
            else if (isLastTo)   cls += ' sq-last-to';
            if (isCheck)         cls += ' sq-check';

            const pieceKey = isLastTo      ? `pl${historyLength}`
                           : isRookSliding ? `pr${historyLength}`
                           : `p${r}${c}`;

            return (
              <div
                key={key}
                className={cls}
                onClick={() => onSquareClick(r, c)}
                role="button"
                tabIndex={0}
                aria-label={sqName(r, c)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSquareClick(r, c)}
              >
                {isMoveTo && <div className={isCapture ? 'move-ring' : 'move-dot'} />}
                {piece && (
                  <div
                    key={pieceKey}
                    className={`chess-piece chess-piece--${piece.color}${slide ? ' piece-sliding' : ''}`}
                    style={slide ? { '--slide-dx': `${slide.dx}px`, '--slide-dy': `${slide.dy}px` } as React.CSSProperties : undefined}
                  >
                    {SYMBOLS[piece.color + piece.type]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div />
      <div className="chess-files">
        {FILES.map(f => <div key={f} className="chess-label">{f}</div>)}
      </div>
    </div>
  );
}
