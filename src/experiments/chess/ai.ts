import type { Move, Position } from './types';
import { applyMove, findKing, getLegalMoves, isInCheck, positionKey } from './engine';

const PIECE_VALUE: Record<string, number> = {
  P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000,
};

// A draw is slightly bad for both sides — the winning side should try to win,
// the losing side still prefers a draw over a bigger loss (contempt < any real loss).
const CONTEMPT = -50;

// Piece-square tables from white's perspective.
// Row 0 = rank 8 (top, black's back / white's advanced rank).
// For white: use board row directly. For black: use (7 - row).
const PST: Record<string, readonly (readonly number[])[]> = {
  P: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0],
  ],
  N: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  B: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  R: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0],
  ],
  Q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  K: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
};

// In the endgame the king becomes an active piece and should centralize.
const PST_KING_EG: readonly (readonly number[])[] = [
  [-50,-40,-30,-20,-20,-30,-40,-50],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-50,-40,-30,-20,-20,-30,-40,-50],
];

function isEndgame(pos: Position): boolean {
  let mat = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = pos.board[r][c];
      if (p && p.type !== 'K' && p.type !== 'P') mat += PIECE_VALUE[p.type];
    }
  return mat < 1500;
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

// MVV-LVA: try capturing high-value pieces with low-value attackers first.
function orderMoves(pos: Position, moves: Move[]): void {
  moves.sort((a, b) => {
    const av = a.captured ? PIECE_VALUE[a.captured.type] * 10 - (PIECE_VALUE[pos.board[a.from[0]][a.from[1]]?.type ?? 'P'] ?? 0) : 0;
    const bv = b.captured ? PIECE_VALUE[b.captured.type] * 10 - (PIECE_VALUE[pos.board[b.from[0]][b.from[1]]?.type ?? 'P'] ?? 0) : 0;
    return bv - av;
  });
}

// Quiescence search: continue on captures past the horizon to avoid the
// horizon effect (missing recaptures at depth boundary).
function quiesce(
  pos: Position,
  alpha: number,
  beta: number,
  maximizing: boolean,
  qdepth = 0,
): number {
  const standPat = evaluate(pos);
  if (qdepth >= 4) return standPat;

  if (maximizing) {
    if (standPat >= beta) return standPat;
    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) return standPat;
    beta = Math.min(beta, standPat);
  }

  const captures = getLegalMoves(pos).filter(m => m.captured || m.flag === 'en-passant');
  if (captures.length === 0) return standPat;
  orderMoves(pos, captures);

  let best = standPat;
  for (const move of captures) {
    const val = quiesce(applyMove(pos, move), alpha, beta, !maximizing, qdepth + 1);
    if (maximizing) {
      best = Math.max(best, val);
      if (val >= beta) break;
      alpha = Math.max(alpha, val);
    } else {
      best = Math.min(best, val);
      if (val <= alpha) break;
      beta = Math.min(beta, val);
    }
  }
  return best;
}

// history is mutated in-place and undone after each recursive call (make/unmake pattern).
function alphaBeta(
  pos: Position,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  history: Map<string, number>,
): number {
  if (depth === 0) return quiesce(pos, alpha, beta, maximizing);

  const moves = getLegalMoves(pos);
  if (moves.length === 0) {
    return isInCheck(pos, pos.turn) ? (maximizing ? -99999 : 99999) : 0;
  }

  orderMoves(pos, moves);

  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const newPos = applyMove(pos, move);
    const key = positionKey(newPos);
    const prev = history.get(key) ?? 0;

    let val: number;
    if (prev >= 2) {
      val = CONTEMPT; // draw by repetition; losing side still prefers this over a bigger loss
    } else {
      history.set(key, prev + 1);
      val = alphaBeta(newPos, depth - 1, alpha, beta, !maximizing, history);
      // undo
      if (prev === 0) history.delete(key);
      else history.set(key, prev);
      // Penalise the second occurrence to discourage oscillation before the draw triggers.
      if (prev === 1) val += maximizing ? CONTEMPT : -CONTEMPT;
    }

    if (maximizing) {
      best = Math.max(best, val);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, val);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function getBestMove(pos: Position, depth = 3, gameHistory?: Map<string, number>): Move | null {
  const moves = getLegalMoves(pos);
  if (moves.length === 0) return null;

  const maximizing = pos.turn === 'w';
  orderMoves(pos, moves);

  // Search deeper in simplified endgames: fewer pieces → fewer nodes, cost is minimal.
  const pieceCount = pos.board.flat().filter(Boolean).length;
  const actualDepth = pieceCount <= 6 ? depth + 2
                    : isEndgame(pos)  ? depth + 1
                    : depth;

  // Working copy so we never mutate the caller's map.
  const history = new Map(gameHistory ?? []);

  const scored = moves.map(move => {
    const newPos = applyMove(pos, move);
    const key = positionKey(newPos);
    const prev = history.get(key) ?? 0;

    let eval_: number;
    if (prev >= 2) {
      eval_ = CONTEMPT;
    } else {
      history.set(key, prev + 1);
      eval_ = alphaBeta(newPos, actualDepth - 1, -Infinity, Infinity, !maximizing, history);
      if (prev === 0) history.delete(key);
      else history.set(key, prev);
    }
    return { move, eval: eval_ };
  });

  const bestEval = maximizing
    ? Math.max(...scored.map(s => s.eval))
    : Math.min(...scored.map(s => s.eval));

  // Randomly pick among truly tied moves — breaks deterministic same-game loops.
  const tied = scored.filter(s => s.eval === bestEval);
  return tied[Math.floor(Math.random() * tied.length)].move;
}
