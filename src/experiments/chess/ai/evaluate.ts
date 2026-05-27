import type { Position } from '../types';
import { findKing, isSquareAttacked } from '../engine';
import { ENDGAME_MATERIAL, MOBILITY_WEIGHT, PIECE_VALUE, PST, PST_KING_EG } from './constants';
import { kingSafetyScore } from './kingSafety';
import { countMobility } from './mobility';
import { pawnStructureScore } from './pawnStructure';
import { getSearchOptions } from './searchOptions';

export function isEndgame(pos: Position): boolean {
  let mat = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = pos.board[r][c];
      if (p && p.type !== 'K' && p.type !== 'P') mat += PIECE_VALUE[p.type];
    }
  return mat < ENDGAME_MATERIAL;
}

// The given side is "matable" — a lone king, or king plus at most a single
// minor with no pawns — so the opponent should drive it to the edge for mate.
// This is independent of the WINNER's material: K+Q+R+B vs K must still mop up,
// even though that much material keeps isEndgame() false.
function isMatable(board: Position['board'], color: 'w' | 'b'): boolean {
  let pawns = 0;
  let majorMinor = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color || p.type === 'K') continue;
      if (p.type === 'P') pawns++;
      else majorMinor += PIECE_VALUE[p.type];
    }
  return pawns === 0 && majorMinor <= PIECE_VALUE.B;
}

const KING_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
];

// Count on-board squares around the losing king that the king cannot escape
// to — either occupied by its own piece, or attacked by the winning side.
// Higher = tighter net. Off-board squares are ignored because cornerDist
// already rewards being on the edge; this term adds the gradient that's
// missing once the king is cornered (mop-up plateau → no progress).
function kingRestriction(board: Position['board'], lk: [number, number], winning: 'w' | 'b'): number {
  const losing: 'w' | 'b' = winning === 'w' ? 'b' : 'w';
  let restricted = 0;
  for (const [dr, dc] of KING_OFFSETS) {
    const r = lk[0] + dr;
    const c = lk[1] + dc;
    if (r < 0 || r > 7 || c < 0 || c > 7) continue;
    const sq = board[r][c];
    if (sq && sq.color === losing) { restricted++; continue; }
    if (isSquareAttacked(board, r, c, winning)) restricted++;
  }
  return restricted;
}

export function evaluate(pos: Position): number {
  const opts = getSearchOptions().eval;
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
  if (opts.mobility) {
    score += MOBILITY_WEIGHT * (countMobility(pos.board, 'w') - countMobility(pos.board, 'b'));
  }

  // Pawn structure (doubled, isolated, passed) and king safety
  // (pawn shield, open files near king). King safety self-disables in endgames.
  if (opts.pawnStructure) score += pawnStructureScore(pos.board);
  if (opts.kingSafety)    score += kingSafetyScore(pos.board, eg);

  // Mop-up: drive the losing king toward a corner and march the winning king
  // up to it. Fires in simplified endgames (eg) OR whenever the losing side is
  // down to a near-bare king — the latter covers heavy-material wins like
  // K+Q+R+B vs K, where the winner has too much material for isEndgame().
  // Without this the engine has no mate gradient and shuffles to a draw.
  if (opts.mopUp && Math.abs(score) > 100) {
    const losing = score > 0 ? 'b' : 'w';
    if (eg || isMatable(pos.board, losing)) {
      const wk = findKing(pos.board, 'w');
      const bk = findKing(pos.board, 'b');
      if (wk && bk) {
        const lk = losing === 'b' ? bk : wk;
        const winning: 'w' | 'b' = losing === 'b' ? 'w' : 'b';
        const cornerDist = Math.max(3 - lk[0], lk[0] - 4, 0) + Math.max(3 - lk[1], lk[1] - 4, 0);
        const kingDist = Math.abs(wk[0] - bk[0]) + Math.abs(wk[1] - bk[1]);
        // Restriction adds the gradient that's missing on the cornered plateau:
        // once the king is in the corner with the friendly king close, the
        // mop-up bonus is maxed and only the attackers' coordination changes,
        // so reward squares the losing king cannot escape to.
        const restriction = kingRestriction(pos.board, lk, winning);
        const bonus = cornerDist * 25 + (14 - kingDist) * 10 + restriction * 15;
        score += score > 0 ? bonus : -bonus;
      }
    }
  }

  return score;
}
