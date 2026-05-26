import type { Position } from '../types';
import { findKing } from '../engine';
import { ENDGAME_MATERIAL, MOBILITY_WEIGHT, PIECE_VALUE, PST, PST_KING_EG } from './constants';
import { countMobility } from './mobility';

export function isEndgame(pos: Position): boolean {
  let mat = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = pos.board[r][c];
      if (p && p.type !== 'K' && p.type !== 'P') mat += PIECE_VALUE[p.type];
    }
  return mat < ENDGAME_MATERIAL;
}

export function evaluate(pos: Position): number {
  let score = 0;
  const eg = isEndgame(pos);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = pos.board[r][c];
      if (!piece) continue;
      const pstRow = piece.color === 'w' ? r : 7 - r;
      const table = piece.type === 'K' && eg ? PST_KING_EG : PST[piece.type];
      const bonus = table?.[pstRow]?.[c] ?? 0;
      const val = PIECE_VALUE[piece.type] + bonus;
      score += piece.color === 'w' ? val : -val;
    }
  }

  // Mobility: difference in pseudo-legal target squares. Captures piece
  // activity and coordination that PST alone misses.
  score += MOBILITY_WEIGHT * (countMobility(pos.board, 'w') - countMobility(pos.board, 'b'));

  // Mop-up: in clearly won endgames, push the losing king to a corner
  // and advance the winning king toward it.
  if (eg && Math.abs(score) > 100) {
    const wk = findKing(pos.board, 'w');
    const bk = findKing(pos.board, 'b');
    if (wk && bk) {
      const lk = score > 0 ? bk : wk;
      const cornerDist = Math.max(3 - lk[0], lk[0] - 4, 0) + Math.max(3 - lk[1], lk[1] - 4, 0);
      const kingDist = Math.abs(wk[0] - bk[0]) + Math.abs(wk[1] - bk[1]);
      const bonus = cornerDist * 25 + (14 - kingDist) * 10;
      score += score > 0 ? bonus : -bonus;
    }
  }

  return score;
}
