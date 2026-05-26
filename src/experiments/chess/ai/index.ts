import type { Move, Position } from '../types';
import { applyMove, getLegalMoves, positionKey } from '../engine';
import { CONTEMPT, MAX_EXTENSIONS } from './constants';
import { isEndgame } from './evaluate';
import { histKey } from './ordering';
import { alphaBeta } from './search';
import { histTable } from './tables';

export { evaluate } from './evaluate';
export { clearTT } from './tables';

// Extra killer slots beyond maxDepth — must cover the deepest ply reachable
// via check extensions plus a small safety margin.
const KILLER_BUFFER = MAX_EXTENSIONS + 8;

export function getBestMove(pos: Position, depth = 4, gameHistory?: Map<string, number>): Move | null {
  const moves = getLegalMoves(pos);
  if (moves.length === 0) return null;

  const maximizing = pos.turn === 'w';

  // Search deeper in simplified endgames: fewer pieces → fewer nodes, cost is minimal.
  const pieceCount = pos.board.flat().filter(Boolean).length;
  const maxDepth = pieceCount <= 6 ? depth + 2
                 : isEndgame(pos)  ? depth + 1
                 : depth;

  // Halve history scores so stale patterns from earlier in the game don't dominate.
  histTable.forEach((v, k) => {
    const next = v >> 1;
    if (next === 0) histTable.delete(k);
    else histTable.set(k, next);
  });

  // Working copy of game repetition history — never mutate the caller's map.
  const repMap = new Map(gameHistory ?? []);

  // Killer slots: fresh per search call, shared across all plies and iterations.
  const killers: Array<[Move | null, Move | null]> =
    Array.from({ length: maxDepth + KILLER_BUFFER }, () => [null, null] as [Move | null, Move | null]);

  let bestMove: Move = moves[0]; // always have a legal fallback

  // Iterative deepening: each completed iteration feeds TT + ordering for the next.
  for (let d = 1; d <= maxDepth; d++) {
    const scored = moves.map(move => {
      const newPos = applyMove(pos, move);
      const key = positionKey(newPos);
      const prev = repMap.get(key) ?? 0;

      let eval_: number;
      if (prev >= 2) {
        eval_ = CONTEMPT;
      } else {
        repMap.set(key, prev + 1);
        eval_ = alphaBeta(newPos, d - 1, -Infinity, Infinity, !maximizing, repMap, 1, killers);
        if (prev === 0) repMap.delete(key);
        else repMap.set(key, prev);
        if (prev === 1) eval_ += maximizing ? CONTEMPT : -CONTEMPT;
      }
      return { move, eval: eval_ };
    });

    const bestEval = maximizing
      ? Math.max(...scored.map(s => s.eval))
      : Math.min(...scored.map(s => s.eval));

    // Randomly pick among truly tied moves — breaks deterministic same-game loops.
    const tied = scored.filter(s => s.eval === bestEval);
    bestMove = tied[Math.floor(Math.random() * tied.length)].move;

    // Re-order root moves by this iteration's scores so the next iteration
    // tries the strongest move first (improves TT hit rate at depth d+1).
    const evalMap = new Map(scored.map(s => [histKey(s.move), s.eval]));
    moves.sort((a, b) => {
      const ae = evalMap.get(histKey(a)) ?? 0;
      const be = evalMap.get(histKey(b)) ?? 0;
      return maximizing ? be - ae : ae - be;
    });
  }

  return bestMove;
}
