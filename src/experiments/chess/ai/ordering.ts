import type { Move, Position } from '../types';
import { PIECE_VALUE } from './constants';
import { histTable } from './tables';

// Sort-key magnitudes for move ordering. Higher = tried first.
// Quiet moves below killers fall back to the history-heuristic score (0+).
const SCORE_TT_MOVE        = 2_000_000;
const SCORE_CAPTURE_BASE   = 1_000_000; // + MVV-LVA
const SCORE_PROMOTION_BASE =   900_000; // + promoted piece value
const SCORE_KILLER_1       =   800_000;
const SCORE_KILLER_2       =   700_000;

export function isSameMove(a: Move, b: Move): boolean {
  return a.from[0] === b.from[0] && a.from[1] === b.from[1]
      && a.to[0]   === b.to[0]   && a.to[1]   === b.to[1];
}

// 4-char move key - board indices are 0-7 so single chars are unambiguous.
export function histKey(move: Move): string {
  return `${move.from[0]}${move.from[1]}${move.to[0]}${move.to[1]}`;
}

function moveScore(
  move: Move,
  pos: Position,
  ttMove: Move | undefined,
  killers: [Move | null, Move | null],
): number {
  if (ttMove && isSameMove(move, ttMove)) return SCORE_TT_MOVE;
  if (move.captured) {
    const atk = pos.board[move.from[0]][move.from[1]];
    return SCORE_CAPTURE_BASE
         + PIECE_VALUE[move.captured.type] * 10
         - (atk ? PIECE_VALUE[atk.type] : 100);
  }
  if (move.flag === 'en-passant') return SCORE_CAPTURE_BASE;
  if (move.flag === 'promotion')  return SCORE_PROMOTION_BASE + PIECE_VALUE[move.promotion!];
  if (killers[0] && isSameMove(move, killers[0])) return SCORE_KILLER_1;
  if (killers[1] && isSameMove(move, killers[1])) return SCORE_KILLER_2;
  return histTable.get(histKey(move)) ?? 0;
}

export function orderMoves(
  pos: Position,
  moves: Move[],
  ttMove?: Move,
  killers: [Move | null, Move | null] = [null, null],
): void {
  moves.sort((a, b) => moveScore(b, pos, ttMove, killers) - moveScore(a, pos, ttMove, killers));
}
