import type { Board, Color } from '../types';
import { findKing } from '../engine';

const SHIELD_MISSING_PENALTY = 15;
const OPEN_FILE_NEAR_KING_PENALTY = 20;
const SEMI_OPEN_FILE_NEAR_KING_PENALTY = 10;

// Counts pawns on a file for both colors.
function filePawns(board: Board, file: number): { w: number; b: number } {
  let w = 0, b = 0;
  for (let r = 0; r < 8; r++) {
    const p = board[r][file];
    if (p?.type !== 'P') continue;
    if (p.color === 'w') w++; else b++;
  }
  return { w, b };
}

function kingDanger(board: Board, color: Color): number {
  const kp = findKing(board, color);
  if (!kp) return 0;
  const [kr, kc] = kp;
  let penalty = 0;

  // Pawn shield: the three squares directly in front of the king.
  // Each missing shield pawn weakens the position.
  const shieldRank = color === 'w' ? kr - 1 : kr + 1;
  if (shieldRank >= 0 && shieldRank < 8) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = kc + dc;
      if (c < 0 || c > 7) continue;
      const p = board[shieldRank][c];
      if (!p || p.type !== 'P' || p.color !== color) {
        penalty += SHIELD_MISSING_PENALTY;
      }
    }
  }

  // Open and semi-open files adjacent to the king are highways for
  // opposing rooks and queens.
  for (let dc = -1; dc <= 1; dc++) {
    const file = kc + dc;
    if (file < 0 || file > 7) continue;
    const { w, b } = filePawns(board, file);
    const ownCount = color === 'w' ? w : b;
    const oppCount = color === 'w' ? b : w;
    if (ownCount === 0 && oppCount === 0) penalty += OPEN_FILE_NEAR_KING_PENALTY;
    else if (ownCount === 0) penalty += SEMI_OPEN_FILE_NEAR_KING_PENALTY;
  }

  return penalty;
}

// Score from white's perspective; positive favors white. Disabled in
// endgames where the king is an active piece and safety is irrelevant.
export function kingSafetyScore(board: Board, isEndgame: boolean): number {
  if (isEndgame) return 0;
  return kingDanger(board, 'b') - kingDanger(board, 'w');
}
