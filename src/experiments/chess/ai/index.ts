import type { AIConfig, Move, Position } from '../types';
import { applyMove, getLegalMoves, positionKey } from '../engine';
import { lookupBookMove } from './book';
import { CONTEMPT, MAX_EXTENSIONS } from './constants';
import { evaluate, isEndgame } from './evaluate';
import { histKey } from './ordering';
import { alphaBeta } from './search';
import { setSearchOptions } from './searchOptions';
import { histTable } from './tables';

export { evaluate } from './evaluate';
export { clearTT } from './tables';

// Extra killer slots beyond maxDepth - must cover the deepest ply reachable
// via check extensions plus a small safety margin.
const KILLER_BUFFER = MAX_EXTENSIONS + 8;

// Weighted random pick: roll a single uniform in [0, sum(weights)) and walk
// the cumulative distribution. Clamped to the supplied list length so a
// shortened candidate slice still resolves correctly.
function weightedPickIndex(weights: readonly number[], len: number): number {
  const n = Math.min(weights.length, len);
  let total = 0;
  for (let i = 0; i < n; i++) total += weights[i];
  if (total <= 0) return 0;
  let roll = Math.random() * total;
  for (let i = 0; i < n; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return n - 1;
}

export function getBestMove(
  pos: Position,
  config: AIConfig,
  gameHistory?: Map<string, number>,
): Move | null {
  setSearchOptions(config);

  const moves = getLegalMoves(pos);
  if (moves.length === 0) return null;

  // Opening book takes precedence over search - instant move, varied openings.
  // Disabled for move grading and lower-skill levels (config.useBook = false).
  if (config.useBook) {
    const bookMove = lookupBookMove(pos, moves);
    if (bookMove) return bookMove;
  }

  const maximizing = pos.turn === 'w';

  // Search deeper in simplified endgames: fewer pieces → fewer nodes, cost is minimal.
  const pieceCount = pos.board.flat().filter(Boolean).length;
  const maxDepth = pieceCount <= 6 ? config.depth + 2
                 : isEndgame(pos)  ? config.depth + 1
                 : config.depth;

  // Halve history scores so stale patterns from earlier in the game don't dominate.
  histTable.forEach((v, k) => {
    const next = v >> 1;
    if (next === 0) histTable.delete(k);
    else histTable.set(k, next);
  });

  // Working copy of game repetition history - never mutate the caller's map.
  const repMap = new Map(gameHistory ?? []);

  // Killer slots: fresh per search call, shared across all plies and iterations.
  const killers: Array<[Move | null, Move | null]> =
    Array.from({ length: maxDepth + KILLER_BUFFER }, () => [null, null] as [Move | null, Move | null]);

  let bestMove: Move = moves[0]; // always have a legal fallback
  let lastScored: Array<{ move: Move; eval: number }> = [];

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

    lastScored = scored;

    const bestEval = maximizing
      ? Math.max(...scored.map(s => s.eval))
      : Math.min(...scored.map(s => s.eval));

    // Among moves with identical deep-search scores, prefer the one whose
    // resulting position has the best static eval (queens closer to enemy king,
    // king more restricted, etc.). On eval plateaus - common in won endgames
    // where many quiet moves search to the same score - this stops the random
    // tiebreak from picking moves that undo mop-up progress (queen out then
    // back). Falls through to random pick when statics tie too, so loop-breaking
    // is preserved.
    const tied = scored.filter(s => s.eval === bestEval);
    let pool: { move: Move }[] = tied;
    if (tied.length > 1) {
      const staticScored = tied.map(s => ({
        move: s.move,
        sEval: evaluate(applyMove(pos, s.move)),
      }));
      const bestStatic = maximizing
        ? Math.max(...staticScored.map(s => s.sEval))
        : Math.min(...staticScored.map(s => s.sEval));
      pool = staticScored.filter(s => s.sEval === bestStatic);
    }
    bestMove = pool[Math.floor(Math.random() * pool.length)].move;

    // Re-order root moves by this iteration's scores so the next iteration
    // tries the strongest move first (improves TT hit rate at depth d+1).
    const evalMap = new Map(scored.map(s => [histKey(s.move), s.eval]));
    moves.sort((a, b) => {
      const ae = evalMap.get(histKey(a)) ?? 0;
      const be = evalMap.get(histKey(b)) ?? 0;
      return maximizing ? be - ae : ae - be;
    });
  }

  // Skill-based move selection (applied only at the root so interior
  // alpha-beta + TT + ordering stay deterministic across iterations).
  // 1) Eval noise: perturb each score by a uniform random offset.
  // 2) Top-N weighted pick: sort by perturbed eval, slice to topN, pick
  //    one with the tier's weight distribution. Skipped entirely when
  //    topN === 1 so Master plays identically to the deterministic engine.
  if (config.topN > 1 && lastScored.length > 0) {
    const noisy = lastScored.map(s => ({
      move: s.move,
      eval: config.evalNoiseCp > 0
        ? s.eval + (Math.random() * 2 - 1) * config.evalNoiseCp
        : s.eval,
    }));
    noisy.sort((a, b) => maximizing ? b.eval - a.eval : a.eval - b.eval);
    const slice = noisy.slice(0, Math.min(config.topN, noisy.length));
    const idx = weightedPickIndex(config.topNWeights, slice.length);
    bestMove = slice[idx].move;
  } else if (config.evalNoiseCp > 0 && lastScored.length > 0) {
    // Master-style single-pick path with non-zero noise (unused in current
    // presets but kept correct so the noise knob is independent of topN).
    const noisy = lastScored.map(s => ({
      move: s.move,
      eval: s.eval + (Math.random() * 2 - 1) * config.evalNoiseCp,
    }));
    noisy.sort((a, b) => maximizing ? b.eval - a.eval : a.eval - b.eval);
    bestMove = noisy[0].move;
  }

  return bestMove;
}
