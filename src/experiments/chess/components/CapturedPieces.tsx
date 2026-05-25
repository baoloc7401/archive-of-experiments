import type { Piece } from '../types';
import { SYMBOLS } from '../constants';

interface Props {
  whiteCaptured: Piece[];
  blackCaptured: Piece[];
  materialAdv: number;
}

export function CapturedPieces({ whiteCaptured, blackCaptured, materialAdv }: Props) {
  if (whiteCaptured.length === 0 && blackCaptured.length === 0) return null;
  return (
    <div className="chess-captures">
      <div className="chess-capture-row">
        <div className="chess-turn-pip chess-turn-pip--w" />
        <span className="chess-capture-pieces">
          {whiteCaptured.map((p, i) => <span key={i}>{SYMBOLS['b' + p.type]}</span>)}
        </span>
        {materialAdv > 0 && <span className="chess-capture-adv">+{materialAdv}</span>}
      </div>
      <div className="chess-capture-row">
        <div className="chess-turn-pip chess-turn-pip--b" />
        <span className="chess-capture-pieces">
          {blackCaptured.map((p, i) => <span key={i}>{SYMBOLS['w' + p.type]}</span>)}
        </span>
        {materialAdv < 0 && <span className="chess-capture-adv">+{-materialAdv}</span>}
      </div>
    </div>
  );
}
