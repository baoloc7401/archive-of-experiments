import type { Move, Position } from '../types';
import {
  getLegalMoves,
  isInCheck,
  makeMove,
  makeNullMove,
  positionKey,
  unmakeMove,
  unmakeNullMove,
} from '../engine';
import {
  CONTEMPT,
  FUTILITY_MARGINS,
  LMR_MIN_DEPTH,
  LMR_MIN_MOVE_INDEX,
  MATE_SCORE,
  MAX_EXTENSIONS,
  NMP_BASE_R,
  NMP_MIN_DEPTH,
  QS_CHECK_PLIES,
} from './constants';
import { evaluate, isEndgame } from './evaluate';
import { histKey, isSameMove, orderMoves } from './ordering';
import { getSearchOptions } from './searchOptions';
import { histTable, tt, type TTFlag } from './tables';

// Any |score| at or above this is a mate score (MATE_SCORE − ply for some
// ply ≤ MATE_BOUND_BUFFER). Used to detect mate scores in TT adjustment.
// 1000 is far above any practical search ply, so regular evals never collide.
const MATE_BOUND = MATE_SCORE - 1000;

// Mate scores are stored in the TT as distance-from-this-node, but produced
// by the search as distance-from-root. Translate on store/probe by adding /
// subtracting the current node's ply so a cached "mate in N from here" gives
// the right root-relative score when the same position is reached at a
// different depth in a later search.
function scoreToTT(score: number, ply: number): number {
  if (score >=  MATE_BOUND) return score + ply;
  if (score <= -MATE_BOUND) return score - ply;
  return score;
}
function scoreFromTT(score: number, ply: number): number {
  if (score >=  MATE_BOUND) return score - ply;
  if (score <= -MATE_BOUND) return score + ply;
  return score;
}

// Quiescence search: extend past the horizon on captures (always) and
// check-giving moves (first QS_CHECK_PLIES levels only) to avoid the
// horizon effect on forcing lines. Mutates pos in place via make/unmake;
// restores it before returning. If pos is itself in check, all legal
// evasions are searched and stand-pat is suppressed - otherwise an
// in-check position would be evaluated as if quiet.
export function quiesce(
  pos: Position,
  alpha: number,
  beta: number,
  maximizing: boolean,
  ply: number,
  qdepth = 0,
): number {
  const inCheck = isInCheck(pos, pos.turn);
  const allMoves = getLegalMoves(pos);

  const maxQDepth = getSearchOptions().qdepth;

  // Check evasion: no stand-pat (would mis-score mate as quiet), search all replies.
  if (inCheck) {
    if (allMoves.length === 0) {
      // Ply-adjusted mate: shorter mates score higher in magnitude so the
      // engine prefers the fastest finish.
      const m = MATE_SCORE - (ply + qdepth);
      return maximizing ? -m : m;
    }
    if (qdepth >= maxQDepth) return evaluate(pos);

    orderMoves(pos, allMoves);
    let best = maximizing ? -Infinity : Infinity;
    for (const move of allMoves) {
      const undo = makeMove(pos, move);
      const val = quiesce(pos, alpha, beta, !maximizing, ply, qdepth + 1);
      unmakeMove(pos, move, undo);

      if (maximizing) {
        best = Math.max(best, val);
        if (val >= beta) return best;
        alpha = Math.max(alpha, val);
      } else {
        best = Math.min(best, val);
        if (val <= alpha) return best;
        beta = Math.min(beta, val);
      }
    }
    return best;
  }

  const standPat = evaluate(pos);
  if (qdepth >= maxQDepth) return standPat;

  if (maximizing) {
    if (standPat >= beta) return standPat;
    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) return standPat;
    beta = Math.min(beta, standPat);
  }

  // Captures always; check-giving moves only for the first QS_CHECK_PLIES
  // levels (a check generates few legal replies but unbounded checking
  // sequences blow up the node count).
  const considerChecks = qdepth < QS_CHECK_PLIES;
  const candidates: Move[] = [];
  for (const move of allMoves) {
    if (move.captured || move.flag === 'en-passant') {
      candidates.push(move);
      continue;
    }
    if (!considerChecks) continue;
    // Cheap check detection: make/unmake and test the opponent's king.
    const u = makeMove(pos, move);
    const givesCheck = isInCheck(pos, pos.turn);
    unmakeMove(pos, move, u);
    if (givesCheck) candidates.push(move);
  }

  if (candidates.length === 0) return standPat;
  orderMoves(pos, candidates);

  let best = standPat;
  for (const move of candidates) {
    const undo = makeMove(pos, move);
    const val = quiesce(pos, alpha, beta, !maximizing, ply, qdepth + 1);
    unmakeMove(pos, move, undo);

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

// Alpha-beta with TT, killer moves, history heuristic, repetition contempt,
// null-move pruning, futility pruning, check extensions, LMR, and PVS.
// Operates on a single mutating pos via make/unmake; the invariant is
// that pos returns to its input state by the time the function returns.
export function alphaBeta(
  pos: Position,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  repMap: Map<string, number>,
  ply: number,
  killers: Array<[Move | null, Move | null]>,
  extensions = 0,
  nullMoveDone = false,
): number {
  // Check extension - applied before the leaf test so an in-check leaf
  // gets a real search instead of falling into capture-only quiescence.
  const inCheck = isInCheck(pos, pos.turn);
  if (inCheck && extensions < MAX_EXTENSIONS) {
    depth++;
    extensions++;
  }

  if (depth <= 0) return quiesce(pos, alpha, beta, maximizing, ply);

  const key = positionKey(pos);
  const cached = tt.get(key);
  const ttMove = cached?.bestMove;
  const origAlpha = alpha;
  const origBeta = beta;

  if (cached && cached.depth >= depth) {
    // Reconstruct the root-relative score from the absolute mate distance
    // stored in the TT (no-op for non-mate scores).
    const cachedScore = scoreFromTT(cached.score, ply);
    if (cached.flag === 'exact') return cachedScore;
    if (cached.flag === 'lower') alpha = Math.max(alpha, cachedScore);
    if (cached.flag === 'upper') beta  = Math.min(beta,  cachedScore);
    if (alpha >= beta) return cachedScore;
  }

  // Static eval is consulted by both NMP and futility - compute lazily and
  // share so a node firing both heuristics only pays for evaluate once.
  let cachedEval: number | null = null;
  const staticEval = (): number => cachedEval ?? (cachedEval = evaluate(pos));

  // Null-move pruning - pass the move and search shallow; if the opponent
  // still can't push us under beta, our real move would surely cut off.
  // Skipped in check (illegal), endgames (zugzwang risk), and when already
  // null-moved (no consecutive nulls).
  if (depth >= NMP_MIN_DEPTH && !inCheck && !nullMoveDone && !isEndgame(pos)) {
    const justify = maximizing ? staticEval() >= beta : staticEval() <= alpha;
    if (justify) {
      const R = NMP_BASE_R + Math.floor(depth / 3);
      const nullDepth = Math.max(0, depth - R - 1);
      const nullUndo = makeNullMove(pos);
      let ns: number;
      if (maximizing) {
        ns = alphaBeta(pos, nullDepth, beta - 1, beta, false, repMap, ply + 1, killers, extensions, true);
      } else {
        ns = alphaBeta(pos, nullDepth, alpha, alpha + 1, true, repMap, ply + 1, killers, extensions, true);
      }
      unmakeNullMove(pos, nullUndo);
      if (maximizing && ns >= beta) return beta;
      if (!maximizing && ns <= alpha) return alpha;
    }
  }

  const moves = getLegalMoves(pos);
  if (moves.length === 0) {
    if (!inCheck) return 0;
    // Ply-adjusted mate so the engine prefers the fastest mate (or, when
    // losing, the slowest) instead of wandering inside the "mate is forced"
    // region.
    const m = MATE_SCORE - ply;
    return maximizing ? -m : m;
  }

  const plyKillers = killers[ply] ?? [null, null];
  orderMoves(pos, moves, ttMove, plyKillers);

  // Futility pruning - at depth 1–2, if static eval + margin can't bridge
  // to alpha, quiet moves are unlikely to either. Disabled near mate scores
  // and in check (tactical positions don't follow the assumption).
  let futilityActive = false;
  if (depth >= 1 && depth <= 2 && !inCheck
      && Math.abs(alpha) < MATE_SCORE - 2000
      && Math.abs(beta)  < MATE_SCORE - 2000) {
    const margin = FUTILITY_MARGINS[depth];
    futilityActive = maximizing
      ? staticEval() + margin <= alpha
      : staticEval() - margin >= beta;
  }

  let best = maximizing ? -Infinity : Infinity;
  let bestMove: Move | undefined;
  let movesSearched = 0;

  for (const move of moves) {
    const isQuiet = !move.captured && move.flag !== 'en-passant' && move.flag !== 'promotion';

    // Always search at least one move so we have a real score (avoids
    // returning ±Infinity for a position that actually has legal replies).
    if (futilityActive && movesSearched > 0 && isQuiet) continue;

    const undo = makeMove(pos, move);
    const posKey = positionKey(pos);
    const prev = repMap.get(posKey) ?? 0;

    let val: number;
    if (prev >= 2) {
      val = CONTEMPT;
    } else {
      repMap.set(posKey, prev + 1);

      const childDepth = depth - 1;
      const search = (d: number, a: number, b: number): number =>
        alphaBeta(pos, d, a, b, !maximizing, repMap, ply + 1, killers, extensions, false);

      if (movesSearched === 0) {
        // PV move: full window, full depth. With good ordering the first
        // move is the principal variation; the rest are verified via null window.
        val = search(childDepth, alpha, beta);
      } else {
        // LMR: late, quiet, non-tactical moves get a depth reduction first.
        // Captures, promotions, in-check positions, and early moves search fully.
        let reduction = 0;
        if (depth >= LMR_MIN_DEPTH
            && movesSearched >= LMR_MIN_MOVE_INDEX
            && isQuiet
            && !inCheck) {
          reduction = Math.floor(0.99 + Math.log(depth) * Math.log(movesSearched + 1) / 3.14);
          // Keep reduced depth at least 1 (anything less just hits quiescence).
          reduction = Math.min(Math.max(0, reduction), Math.max(0, childDepth - 1));
        }

        // PVS null-window probe at (possibly reduced) depth.
        if (maximizing) {
          val = search(childDepth - reduction, alpha, alpha + 1);
          // Reduced search beat alpha - confirm at full depth before
          // committing to a full-window re-search.
          if (val > alpha && reduction > 0) {
            val = search(childDepth, alpha, alpha + 1);
          }
          // Move sits inside the open window - need exact value.
          if (val > alpha && val < beta) {
            val = search(childDepth, alpha, beta);
          }
        } else {
          val = search(childDepth - reduction, beta - 1, beta);
          if (val < beta && reduction > 0) {
            val = search(childDepth, beta - 1, beta);
          }
          if (val < beta && val > alpha) {
            val = search(childDepth, alpha, beta);
          }
        }
      }

      if (prev === 0) repMap.delete(posKey);
      else repMap.set(posKey, prev);
      if (prev === 1) val += maximizing ? CONTEMPT : -CONTEMPT;
    }

    // CRITICAL: unmake before any break / continue so pos stays in sync.
    unmakeMove(pos, move, undo);
    movesSearched++;

    if (maximizing) {
      if (val > best) { best = val; bestMove = move; }
      alpha = Math.max(alpha, best);
    } else {
      if (val < best) { best = val; bestMove = move; }
      beta = Math.min(beta, best);
    }

    if (beta <= alpha) {
      if (isQuiet) {
        const k = killers[ply] ?? [null, null];
        if (!k[0] || !isSameMove(move, k[0])) killers[ply] = [move, k[0]];
        const hk = histKey(move);
        histTable.set(hk, (histTable.get(hk) ?? 0) + depth * depth);
      }
      break;
    }
  }

  // TT store - prefer deeper entries; exact entries always overwrite.
  // Mate scores are converted to absolute distance-from-this-node before
  // storing so retrievals at other plies decode correctly via scoreFromTT.
  const existing = tt.get(key);
  const flag: TTFlag = best <= origAlpha ? 'upper' : best >= origBeta ? 'lower' : 'exact';
  if (!existing || depth >= existing.depth || flag === 'exact') {
    tt.set(key, { depth, flag, score: scoreToTT(best, ply), bestMove });
  }

  return best;
}
