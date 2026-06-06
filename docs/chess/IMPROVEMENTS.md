# Chess AI Improvement Roadmap

Reference: [`src/experiments/chess/ai.ts`](../../src/experiments/chess/ai.ts),
[`src/experiments/chess/engine.ts`](../../src/experiments/chess/engine.ts)

Sources: [CPW Transposition Table](https://www.chessprogramming.org/Transposition_Table) ·
[CPW Move Ordering](https://www.chessprogramming.org/Move_Ordering) ·
[CPW Null Move Pruning](https://www.chessprogramming.org/Null_Move_Pruning) ·
[CPW LMR](https://www.chessprogramming.org/Late_Move_Reductions) ·
[CPW King Safety](https://www.chessprogramming.org/King_Safety) ·
[CPW Aspiration Windows](https://www.chessprogramming.org/Aspiration_Windows) ·
[CPW Futility Pruning](https://www.chessprogramming.org/Futility_Pruning) ·
[CPW Killer Heuristic](https://www.chessprogramming.org/Killer_Heuristic) ·
[CPW Zobrist Hashing](https://www.chessprogramming.org/Zobrist_Hashing)

Note: As we move down on the implementations, update the progress as TODO/Doing/Done.

---

## What the Engine Already Does

| Feature | Detail |
|---|---|
| Minimax + alpha-beta | Standard negamax in `alphaBeta()` |
| Quiescence search | Captures + en-passant only; `qdepth` hard cap = 4 |
| Move ordering | TT move > MVV-LVA captures > promotions > killer 1 > killer 2 > history quiet |
| Piece-square tables (PST) | All 6 piece types; separate `PST_KING_EG` for endgame |
| Endgame detection | Non-pawn/non-king material < 1500 → `isEndgame()` |
| Mop-up heuristic | Losing-king corner distance + winning-king proximity bonus |
| Adaptive depth | `pieceCount ≤ 6 → depth+2`; `isEndgame → depth+1` |
| Repetition detection (search) | `Map<string, number>` in `alphaBeta`; `count ≥ 2 → CONTEMPT` |
| Repetition detection (game) | `posHistoryRef` in `useChessGame`; `count ≥ 3 → draw` |
| 50-move rule | `halfmove ≥ 100` in `getGameStatus()` (engine.ts:285) |
| Contempt factor | `CONTEMPT = −50`; draw discouraged to avoid loops |
| Randomized tie-breaking | Equal-eval moves shuffled in `getBestMove()` |
| Move grading | `computeGrade()` calls `getBestMove(pos, 2)` for !! / ? / ?? annotation |
| Transposition table | `Map<string, TTEntry>`; depth-preferred replacement; feeds best move to ordering |
| Iterative deepening | Depths 1 → maxDepth; root re-sorted each iteration; killers/history shared |
| Killer moves | Two quiet cut-off moves per ply; updated on beta cut-off |
| History heuristic | `depth²` bonus per quiet cut-off; halved (right-shift) at search start |

**Actual search depths:** `hva` = 4, `ava` = 3 (from `AI_DEPTH` in constants.ts).

**Estimated Elo:** ~1800–2300 (blitz) after Tier 1 improvements.

---

## Key Performance Constraints in the Current Code

These affect the cost/benefit of every improvement below:

- **`positionKey` is a full string serialization** - iterates all 64 squares + turn + castling + ep → ~135-char string. O(64) per call, called at every node.
- **`applyMove` clones the full position** - `clonePosition` + `cloneBoard` allocates a new 8×8 array per node. No make/unmake. At depth 4 + qdepth 4 with branching factor ~30, this is hundreds of thousands of allocations per move.
- **`getLegalMoves` calls `applyMove` + `isInCheck` per candidate** - full clone + attack scan for every pseudo-legal move.
- **Search runs on the main thread** - `getBestMove` is called inside `setTimeout` in `useChessAI`; deep searches will still block the UI.

---

## Move Ordering Reference

Authoritative priority order from the Chess Programming Wiki (best first):

| Priority | Move type |
|---|---|
| 1 | PV-move from previous iteration (iterative deepening) |
| 2 | Hash move from transposition table |
| 3 | Winning captures and promotions (MVV-LVA) |
| 4 | Equal captures and promotions |
| 5 | Killer moves (mate killers first, then two killers per ply) |
| 6 | Quiet moves sorted by history heuristic score |
| 7 | Losing captures |

The current engine only implements priority 3 (MVV-LVA on captures). Priorities 2, 5, and 6 are the most impactful additions.

---

## Improvements

### Tier 1 - Highest Impact

---

#### 1. Transposition Table (TT)

PROGRESS: Done

**What:** Cache evaluated positions so the same node is never fully re-searched. Each entry stores:
- Zobrist hash (for collision verification)
- Search depth
- Score
- Bound flag: `exact` | `lower-bound` | `upper-bound`
- Best move (feeds directly into move ordering)
- Age (for replacement decisions)

**Why it matters:** Research shows the hash move alone causes 75% of beta cut-offs in positions where a TT hit exists. A transposition table typically gains **+130–150 Elo** in isolation.

**What's already in place:** `positionKey(pos)` in engine.ts is already used as a string key for repetition tracking. It can serve as the TT key to prototype without Zobrist first; add Zobrist (#7) for production performance.

**Replacement scheme:** Depth-preferred (keep the entry with higher search depth) is the standard starting point. A two-tier table (one depth-preferred + one always-replace) is more robust.

**Implementation sketch:**
```ts
type TTFlag = 'exact' | 'lower' | 'upper';
interface TTEntry { depth: number; flag: TTFlag; score: number; bestMove?: Move; age: number; }
const tt = new Map<string, TTEntry>(); // replace string with Zobrist bigint later

// In alphaBeta, before the move loop:
const key = positionKey(pos);
const cached = tt.get(key);
if (cached && cached.depth >= depth) {
  if (cached.flag === 'exact') return cached.score;
  if (cached.flag === 'lower') alpha = Math.max(alpha, cached.score);
  if (cached.flag === 'upper') beta  = Math.min(beta,  cached.score);
  if (alpha >= beta) return cached.score;
}

// After the move loop:
const flag = best <= origAlpha ? 'upper' : best >= beta ? 'lower' : 'exact';
tt.set(key, { depth, flag, score: best, bestMove, age: currentAge });
```

**Expected gain:** +200–400 Elo equivalent; dramatically speeds up effective depth.

---

#### 2. Iterative Deepening (ID)

PROGRESS: Done

**What:** Search depth 1, 2, 3 … N in sequence rather than jumping straight to depth N. Each shallow pass costs near-zero time relative to the deepest pass, and populates the TT for the next pass.

**Why it matters:**
- TT entries from depth N−1 provide the hash move that orders the depth N search optimally.
- Enables time-based search (stop between iterations, never mid-search).
- Required to make aspiration windows (#11) work.

**Current state:** `getBestMove` calls `alphaBeta` once at `actualDepth`. The `AI_DELAY` in `useChessAI` is a UI animation delay, not a search time budget.

**Implementation sketch:**
```ts
export function getBestMove(pos: Position, maxDepth = 4, timeBudgetMs = 2000): Move | null {
  let bestMove: Move | null = null;
  const deadline = Date.now() + timeBudgetMs;
  for (let d = 1; d <= maxDepth; d++) {
    if (Date.now() > deadline) break;
    const result = searchRoot(pos, d, history);
    bestMove = result.move; // always keep last completed iteration
  }
  return bestMove;
}
```

**Expected gain:** +100–200 Elo; unlocks TT synergy, aspiration windows, and clean time management.

---

#### 3. Better Move Ordering

PROGRESS: Done

**What:** Implement the full move ordering priority list (see reference above). Currently only MVV-LVA for captures is in place; quiet moves are completely unordered.

**Additions required (priority order):**

**TT move first:** In `alphaBeta`, probe the TT before generating moves. If a hit exists, try its `bestMove` first before the sorted list. Prerequisite: TT (#1).

**Killer moves:** Two quiet moves per depth that recently caused a beta cut-off in sibling nodes. Store as:
```ts
const killers: [Move | null, Move | null][] = Array(MAX_DEPTH).fill([null, null]);
// On beta cut-off by a quiet move at depth d:
killers[d] = [move, killers[d][0]]; // shift in, drop oldest
```
Note: The Killer heuristic was removed from Stockfish in mid-2024 once history heuristics and NNUE matured, but it remains highly effective in classical hand-crafted engines.

**History heuristic:** A `history[from][to]: number` table (or `Map<string, number>`) incremented when a quiet move causes a beta cut-off. Sort quiet moves by descending history score. Decay the table between searches (halve all values) to avoid stale bias.

**Expected gain:** Better ordering multiplies alpha-beta efficiency. Combined with TT, this is the largest single complexity change with the highest return.

---

### Tier 2 - Strong Gains

---

#### 4. Null-Move Pruning (NMP)

PROGRESS: Done

**What:** Give the opponent a free extra move (skip your turn). If a reduced-depth search of their response still beats beta, the position is so good that a real beta cut-off is near-certain - prune without full search.

**Why it matters:** One of the most impactful pruning techniques in classical engines. Particularly powerful in the middlegame where most positions are not zugzwang.

**Reduction depth R:** Standard starting point is R = 3. Modern engines use adaptive R: `R = 3 + depth / 3`.

**Must NOT apply when:**
- Currently in check (no passing allowed)
- Previous ply also used a null move (no consecutive null moves)
- Pawn-only endgame (high zugzwang risk)
- `isEndgame(pos)` is true (reduce usage)
- Static evaluation < beta (position isn't good enough to justify it)

**Implementation sketch:**
```ts
// In alphaBeta, before the move loop:
const inCheck = isInCheck(pos, pos.turn);
if (!inCheck && !nullMoveDone && !isEndgame(pos) && depth >= 3) {
  const R = 3 + Math.floor(depth / 3);
  const nullPos = { ...pos, turn: opponent(pos.turn), ep: null };
  const nullScore = -alphaBeta(nullPos, depth - R - 1, -beta, -beta + 1, !maximizing, history, /*nullMoveDone=*/true);
  if (nullScore >= beta) return beta;
}
```

**Expected gain:** +100–200 Elo.

---

#### 5. Futility Pruning

PROGRESS: Done

**What:** At shallow depths (1–2 plies from the horizon), if the static evaluation plus a material margin is still below alpha, the move has no realistic chance of improving alpha - skip it without searching.

**Why it matters:** Eliminates a large number of hopeless quiet moves near the search horizon, giving meaningful speed gains at low implementation cost.

**Margins (standard values):**
- Depth 1 (frontier): `eval + 300 ≤ alpha` → prune (minor piece value ≈ 300cp)
- Depth 2 (pre-frontier): `eval + 500 ≤ alpha` → prune (rook value ≈ 500cp)

**Must NOT apply when:**
- In check
- Alpha/beta near mate scores (within ~2000cp of ±99999)
- No legal moves verified yet (avoids false stalemate)

**Moves always searched even when pruning is active:**
- All captures
- Moves giving check

**Expected gain:** +30–80 Elo; cheap to implement, composes well with LMR.

---

#### 6. Check Extensions

PROGRESS: Done

**What:** When the side to move is in check, extend the search depth by 1 ply.

**Why it matters:** Check sequences are narrow (few legal replies), so the extra ply costs little. Without it, a check at the horizon that leads to a material swing on the next move is invisible to the engine.

**Current state:** `quiesce()` covers captures that follow a check, but a purely checking forcing line without immediate captures falls through to `standPat` too early.

**Implementation sketch:**
```ts
// In alphaBeta:
const inCheck = isInCheck(pos, pos.turn);
const extension = inCheck ? 1 : 0;
// search child at depth - 1 + extension
// Cap cumulative extensions (e.g. max 16 over the whole path) to avoid blowup.
```

**Expected gain:** +50–100 Elo; most visible in tactical positions.

---

#### 7. Mobility Evaluation

PROGRESS: Done

**What:** Add a score proportional to the number of available moves for each side: `mobility_weight × (white_moves − black_moves)`.

**Why it matters:** Activity and piece coordination are poorly captured by PST alone. Mobility correlates with initiative, piece harmony, and restricted-king danger without needing to hand-tune every sub-case.

**Current state:** `evaluate()` scores material + PST + mop-up only.

**Implementation:** Use pseudo-legal move counts (no legality filter) to keep it fast. Start with `mobility_weight ≈ 5–10` cp per move difference.

**Expected gain:** +50–100 Elo; noticeable in strategic middlegame positions.

---

### Tier 3 - Refinement

---

#### 8. Zobrist Hashing

PROGRESS: Done

**What:** Replace the current `positionKey` string-concat with an incrementally-updated 64-bit hash. Precompute random numbers for each (color, piece, square) triple plus side-to-move, castling rights, and en-passant file. In `applyMove`, XOR only the deltas.

**Why it matters:** `positionKey()` (engine.ts:269) iterates 64 squares to build a ~135-char string - O(64) per call. Zobrist hashing reduces this to O(1) incremental XOR. It is a prerequisite for a high-performance TT.

**JavaScript note:** True 64-bit integers don't exist in JS. Options:
- Use two 32-bit numbers (low/high) XORed separately - fast, no BigInt overhead.
- Use `BigInt` - correct 64-bit semantics, but slower; avoid in hot search paths.
- Use 52-bit floats (safe integer range) - fits in a `number`, loses some collision resistance.

**Collision handling:** Always store the full hash in each TT entry and verify on retrieval - do not use only the table index as the key.

**Note:** TT (#1) can be prototyped with string keys first; switch to Zobrist once the logic is validated.

---

#### 9. Make/Unmake Pattern

PROGRESS: Done

**What:** Modify the board in-place in `applyMove` and reverse the change in an `undoMove` after the recursive call, rather than cloning the full position.

**Why it matters:** `applyMove` currently calls `cloneBoard` (a full 64-element array copy) at every search node. At depth 4 + qdepth 4 with branching factor ~30, this is hundreds of thousands of allocations and a significant GC burden in a JS runtime. Make/unmake eliminates almost all of that allocation.

**What to save/restore per move:** moving piece, captured piece, castling rights (4 bits), ep square, halfmove counter, and - with Zobrist - the running hash.

**Caveats:** More complex to implement correctly than clone. A single missed undo corrupts all subsequent positions. Implement with thorough unit tests before using in production.

**Expected gain:** 2–5× faster search; translates directly to effective depth increase at the same time budget.

---

#### 10. Pawn Structure Evaluation

PROGRESS: Done

**What:** Score structural features of pawn formations. These are stable between moves, so they are naturally cached with a pawn hash table (see note below).

**Features to implement:**

| Term | Condition | Typical penalty/bonus |
|---|---|---|
| Doubled pawn | Two same-color pawns on the same file | −20 cp each |
| Isolated pawn | No friendly pawns on adjacent files | −30 cp |
| Passed pawn | No opposing pawn blocking or guarding on adjacent files | +20 to +100 cp by rank |
| Backward pawn | Can't be supported by a pawn, on half-open file | −15 cp |

**Pawn hash table:** Because the pawn structure rarely changes between moves, a dedicated pawn hash table (keyed on pawn positions only) achieves >95% hit rates and keeps the evaluation cost near zero.

**Current state:** Pawns scored only by material (100 cp) + PST. No file-structure awareness.

**Expected gain:** +50–150 Elo; most visible in endgames and strategic play.

---

#### 11. King Safety Evaluation

PROGRESS: Done

**What:** Score how exposed each king is to attack using an **attack unit / danger table** system:

| Attacker | Units |
|---|---|
| Minor piece (N or B) | 2 |
| Rook | 3 |
| Queen | 5 |

Accumulated attack units index into a non-linear danger table (S-curve: slow rise, fast middle, plateau). Additional factors add units: safe checks, open/semi-open files near the king, missing pawn shield squares.

**Why it matters:** The current PST-only king evaluation only encodes general king position. It misses the difference between a castled king behind pawns vs. one that has lost its shelter.

**Current state:** King scored by `PST['K']` (middlegame) or `PST_KING_EG` (endgame). No attack counting.

**Expected gain:** +50–100 Elo; most impactful in tactical middlegame positions.

---

#### 12. Late Move Reductions (LMR)

PROGRESS: Done

**What:** After the first few moves at a node are searched at full depth, search later (likely weaker) moves at a reduced depth. Re-search at full depth only if the result beats alpha.

**Reduction formula (modern logarithmic):**
```
R = 0.99 + ln(depth) × ln(moveIndex) / 3.14   (Obsidian engine)
```
or equivalently, `R` grows slowly with both depth and move number.

**Do NOT apply LMR to:**
- Depth < 3
- Captures and promotions
- Moves that give or escape check
- Killer moves
- Passed pawn advances
- Moves with high history heuristic scores

**Re-search rule:** If the reduced search returns a score > alpha, re-search at `depth − 1`. Modern engines (Stockfish) adjust the re-search depth based on the margin rather than always using full depth.

**Expected gain:** +100–200 Elo; essential for effective depth beyond 5.

---

#### 13. Principal Variation Search (PVS / Negascout)

PROGRESS: Done

**What:** Search the first (PV) move with the full `[alpha, beta]` window. Search subsequent moves with a null window `[alpha, alpha+1]`. Only re-search with the full window if a move fails high.

**Why it matters:** With good move ordering (TT + killers + history), subsequent moves fail low on the null window search almost always - the full re-search is rare. This eliminates most full-window searches for non-PV moves.

**Prerequisite:** Best combined with TT (#1) + ID (#2) + move ordering (#3) to ensure the first move actually is the PV move. Without good ordering, fail-high re-searches become too frequent and PVS loses its advantage.

**Expected gain:** +50–100 Elo equivalent speed improvement.

---

### Tier 4 - Advanced / Optional

---

#### 14. Aspiration Windows

PROGRESS: TODO (implemented then reverted - negligible benefit at our fixed
search depth, since aspiration windows pay off mainly in time-limited
iterative deepening, and a narrow root window risked blurring tie-breaking.)

**What:** In iterative deepening, use a narrow window `[prevScore − δ, prevScore + δ]` instead of `(−∞, +∞)` as the starting window for each new iteration.

**Initial window:** δ ≈ 25–50 cp (1/4 to 1/2 pawn). Modern engines start smaller and expand exponentially.

**Widening strategy (asymmetric):** On fail-low, only widen the lower bound; on fail-high, only widen the upper bound. Do not widen symmetrically - this causes instability. If the score escapes the expanded window, fall back to a full `(−∞, +∞)` re-search.

**Prerequisite:** Iterative deepening (#2).

**Expected gain:** 10–30% fewer nodes per iteration when the score is stable (the common case).

---

#### 15. Quiescence: Include Checks

PROGRESS: Done

**What:** Extend `quiesce()` to search moves that give check in addition to captures.

**Current state:** `quiesce()` (ai.ts:161) filters to `m.captured || m.flag === 'en-passant'`. A check-then-capture tactic where the check is at the search horizon is invisible.

**Caveats:** Must limit check extensions within quiescence (e.g. only the first 1–2 plies of checks) to avoid node explosion. Checks in quiescence only: do not recurse into another check extension from within quiescence.

---

#### 16. Web Worker for Search

PROGRESS: Done

**What:** Move `getBestMove` into a Web Worker so the search runs off the main thread.

**Why it matters:** Currently `getBestMove` is wrapped in `setTimeout` in `useChessAI` to allow a render before thinking, but the search itself still blocks the main thread. At depth 4 on a slow device this is noticeable. A Worker allows the UI to remain interactive during deep searches and enables real-time cancellation.

**Implementation sketch:** Post a message with the serialized position to the Worker; receive the best move back via `postMessage`. Use `terminate()` to cancel a search in progress when the game state changes.

---

#### 17. Opening Book

PROGRESS: Done

**What:** A lookup table of well-known opening lines. Return a book move instantly when the current position matches a known entry, skipping the search entirely.

**Implementation:** Encode 10–15 moves of common lines (1.e4, 1.d4, Sicilian, French, etc.) as `Map<positionKey, Move[]>`. Probe in `getBestMove` before any search; fall through on a miss. Randomize among multiple book moves to avoid predictable play.

---

#### 18. Endgame Tablebases

PROGRESS: TODO

**What:** Pre-computed perfect-play tables for positions with ≤ N pieces (Syzygy format).

**Caveats:** Full 6-piece Syzygy tables are ~150 GB. Practical options for a browser engine: bundle 3–4 piece tables (a few MB), or query a remote tablebase API. Replaces mop-up heuristic and endgame PST tuning with perfect play in covered positions.

---

## Estimated Elo by Stage

| Stage | What changes | Estimated Elo |
|---|---|---|
| Current | Minimax + AB + QS + PST + contempt | 1400–1900 |
| + Tier 1 | TT + ID + full move ordering | 1800–2300 |
| + Tier 2 | NMP + futility + extensions + mobility | 2100–2500 |
| + Tier 3 | Pawn structure + king safety + LMR + PVS + Zobrist + make/unmake | 2300–2700 |
| Reference | Stockfish | 3600+ |
