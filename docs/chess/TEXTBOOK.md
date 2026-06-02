# Chess AI — Textbook & Real-World Research

Reference code:
[`engine.ts`](../../src/experiments/chess/engine.ts) (rules, make/unmake, legality),
[`zobrist.ts`](../../src/experiments/chess/zobrist.ts) (deterministic position hash),
[`ai/search.ts`](../../src/experiments/chess/ai/search.ts) (alpha-beta + quiescence + TT),
[`ai/evaluate.ts`](../../src/experiments/chess/ai/evaluate.ts) (static evaluation),
[`ai/index.ts`](../../src/experiments/chess/ai/index.ts) (root, iterative deepening, skill knobs),
[`ai/skill.ts`](../../src/experiments/chess/ai/skill.ts) (difficulty presets),
[`ai/worker.ts`](../../src/experiments/chess/ai/worker.ts) (off-thread search),
[`ai/book.ts`](../../src/experiments/chess/ai/book.ts) (opening book),
[`ai/constants.ts`](../../src/experiments/chess/ai/constants.ts).
Roadmap: [`IMPROVEMENT.md`](./IMPROVEMENT.md). Bug/craft log: [`ISSUES.md`](./ISSUES.md).

This is the research record for the chess engine: the canonical search and
evaluation machinery, how faithfully we implement it, and — importantly —
**what went wrong in non-obvious ways while building it.** Most of the genuine
learning came from won endgames that the engine refused to finish, and from a
Web Worker move that turned a single innocent `Math.random()` into a
silent cross-thread hash bug. Findings accumulated while building and
debugging the engine.

---

## 0. The single most important finding

> **Every bug that turned won endgames into draws was the same bug at heart:
> the evaluation was flat where it needed a gradient, and a perfectly correct
> alpha-beta search on a gradient-less eval shuffles among "equally good" moves
> until the 50-move rule or threefold repetition draws the game.** The engine
> looked broken; the search was fine. The eval was the bug.

This pattern showed up at three different scales in the same project:

- **Mop-up gated on `isEndgame()`** — the heuristic that drives a lone king to
  the corner only fired when *total* non-pawn/non-king material was `< 1500`. So
  K+Q+R+B vs K (winner's material 1730) **disabled mate-driving precisely when
  the winner had the most material**. The eval was flat across all winning-side
  moves, and the engine corner-driven the opposing king *nowhere*. (§5.1)
- **Mop-up plateaus once the king is cornered.** With the bare king on a1 and
  the winning king close, `cornerDist` is maxed and `kingDist` is small.
  Every queen shuffle scores the same. The engine has no signal to coordinate
  its pieces into a mating net. (§5.2)
- **Flat mate scores (the worst).** A `±MATE_SCORE` constant returned from a
  mate leaf, *with no ply adjustment*, means mate-in-1 and mate-in-7 score
  identically. The root sees several moves all rated 99999 ("mate is forced
  *somewhere*") and picks one **at random**. The chosen move can leave the mate
  at the same distance — wandering inside the forced-mate region forever. Even a
  mate fully within the search horizon is never actually played out. (§4)

The lesson generalises beyond chess: **a correct optimiser on a flat objective
makes random choices.** If your solver "can't finish," the first thing to check
is whether the objective is actually distinguishing the moves you expect it to
distinguish.

---

## 1. The model & terminology

Standard chess, served by a hand-written engine — no NNUE, no UCI server. The
board is an 8×8 array (row 0 = rank 8 = Black's back rank), pieces are
`{type, color}`, the [`Position`](../../src/experiments/chess/types.ts) carries
turn, castling rights, en-passant target, halfmove/fullmove clocks, and a
**Zobrist hash** kept in sync incrementally.

| Term | Standard meaning | Here |
|---|---|---|
| Ply | a single half-move | the `ply` parameter threaded through `alphaBeta` / `quiesce` |
| Depth | remaining plies to search | the `depth` parameter; decremented on each child call |
| Horizon | the leaf of a fixed-depth search | where `quiesce()` takes over |
| Static eval | a numeric "who's winning" from one position | [`evaluate(pos)`](../../src/experiments/chess/ai/evaluate.ts), in centipawns, white-positive |
| Mate score | a return value meaning "forced mate" | `±(MATE_SCORE − ply)`; see §4 |
| TT | transposition table | a `Map<positionKey, TTEntry>` keyed on the base-36 Zobrist hash |
| Pseudo-legal | satisfies movement rules; ignores own-king check | what `pseudoLegalMoves` returns |
| Legal | pseudo-legal + does not leave own king in check | `getLegalMoves` filters via make/unmake |

The engine runs at **fixed depth** — `config.depth` per skill level, +1 if
`isEndgame` and +2 if `pieceCount ≤ 6`. There is no time budget; aspiration
windows are **not** in use (§10). All scores are in **centipawns**, from
White's perspective: positive = good for White.

---

## 2. The search stack

[`alphaBeta`](../../src/experiments/chess/ai/search.ts) is an explicit
minimax-style search (separate `maximizing` branches, not negamax) with the
following layers stacked on top of plain alpha-beta:

| Layer | What it does |
|---|---|
| **Transposition table** | depth-preferred replacement; exact entries always overwrite; ply-adjusted mate scores (§4) |
| **Iterative deepening** | root searches depths 1..N in sequence; each iteration feeds the next via TT and re-sorted root moves |
| **Move ordering** | TT move > MVV-LVA captures > promotions > killer₁ > killer₂ > history quiet |
| **Killer moves** | two per ply, updated on quiet beta cut-off |
| **History heuristic** | `depth²` bonus per quiet cut-off; halved at start of each `getBestMove` |
| **Null-move pruning (NMP)** | adaptive `R = 3 + depth/3`; off in check, in endgame, and when prior ply already null-moved |
| **Futility pruning** | depth 1: `eval + 300 ≤ alpha`; depth 2: `eval + 500 ≤ alpha`; off in check and near mate |
| **Check extensions** | `depth++` if the side to move is in check; cumulative cap `MAX_EXTENSIONS = 16` |
| **Late move reductions (LMR)** | `R = ⌊0.99 + ln(depth)·ln(moveIdx+1) / 3.14⌋`, only on late quiet non-tactical moves |
| **PVS (principal variation search)** | first move full window; rest probed null-window, re-searched only on fail-high |
| **Quiescence** | extends past the horizon on captures, on check-giving moves (§3), and on evasions when in check |

### 2.1 Make/unmake, not clone-per-move

Every `makeMove` mutates `pos` in place and returns an
[`UndoInfo`](../../src/experiments/chess/engine.ts) snapshot
(`castlingBefore` (a fresh spread copy), `epBefore`, `halfmoveBefore`,
`fullmoveBefore`, `zobristBefore`). Piece restoration is re-derived from the
`Move`'s `captured` field. A null move has its own `NullUndoInfo`.

The invariant every function in this codebase has to preserve: **`pos` returns
to its input state by the time the function returns.** The biggest landmine
during the make/unmake refactor was a single line — `const cb = pos.castling`
— that aliased the live castling object instead of snapshotting it (§4 of
ISSUES.md predecessor). The fix is the `{...pos.castling}` spread captured into
`undo.castlingBefore` and using `undo.castlingBefore.wk !== pos.castling.wk` to
detect rights changes for the Zobrist XOR.

### 2.2 PVS + LMR re-search ladder

For each non-PV root move the search runs the three-step re-search:

```
1.  val = search(childDepth − reduction, alpha, alpha + 1)  // reduced null-window probe
2.  if (val > alpha && reduction > 0):
      val = search(childDepth, alpha, alpha + 1)            // unreduced null-window probe
3.  if (val > alpha && val < beta):
      val = search(childDepth, alpha, beta)                 // full-window confirmation
```

The mirror branch exists for the minimizing side. This composes LMR's depth
reduction with PVS's null-window cheaply: a move that fails its reduced
null-window probe gets re-examined at full depth before paying for the full
window.

---

## 3. Quiescence — captures + checks + evasions

A naïve fixed-depth search has the **horizon effect**: a leaf where the side to
move is about to lose a queen scores as if material were stable. Quiescence
extends past the leaf along *forcing* moves only.

[`quiesce()`](../../src/experiments/chess/ai/search.ts) handles three regimes:

1. **In check.** Stand-pat is suppressed (an in-check static eval would
   misreport mate as quiet). All legal evasions are searched; with no legal
   moves the side is mated and we return a **ply-adjusted** mate score (§4).
2. **First `QS_CHECK_PLIES = 2` plies of quiescence.** Captures *and*
   check-giving moves are searched. Check detection is a cheap make/`isInCheck`/
   unmake on each candidate.
3. **Deeper qdepth.** Captures only — checking-move expansion is bounded so
   forcing sequences cannot blow up the node count.

The `qdepth` ceiling is configurable per skill level (`config.qdepth`), 0..4
across the presets in §7. Mate inside quiescence uses `ply + qdepth` for its
ply argument — the distance encoding is consistent regardless of which function
detected the mate.

### 3.1 Why "checks in quiescence" matters

Before the check-extension here, a forcing line like *Qxh7+ Kxh7 (next ply
captures the rook)* would be invisible: at the search horizon the engine sees
"give up the queen for a rook" and rejects the line. Extending checks one more
ply lets it see the recapture. We deliberately *don't* recurse further into
check extensions inside quiescence — that would re-introduce unbounded
forcing-line expansion.

---

## 4. Mate-distance encoding (the central finding)

This is the single most consequential change in the project, and the bug that
made it necessary is more interesting than any individual algorithm.

### 4.1 The bug

Both mate leaves used to return a flat `±MATE_SCORE` (`99999`) regardless of
the ply at which the mate occurred. The TT stored and returned that constant
unchanged. **Mate-in-1 and mate-in-7 scored identically.**

In a won endgame the engine would find a forced mate (a tree branch reaching a
`±99999` leaf), and several different root moves would each lead to a
`±99999`-scoring subtree because the same mate is reachable via many paths.
The root's tie-break — uniform random among all top-scoring moves — picked any
of them, and the chosen one was often **a sideways move that left the mate
exactly as far away**. Next move, same thing. The engine wandered inside the
"mate is forced" region without ever closing the distance, ran out the
50-move counter, and drew a position with K+Q+Q vs K.

The search was strictly correct. The eval was *unable to express the question
the search needed to ask*.

### 4.2 The fix

Two mechanical changes:

```ts
// Leaf, both in alphaBeta and quiesce:
const m = MATE_SCORE - ply;                                  // alphaBeta
const m = MATE_SCORE - (ply + qdepth);                       // quiesce
return maximizing ? -m : m;                                  // sign by who's mated
```

Now `MATE_SCORE − 1 > MATE_SCORE − 5`: the engine strictly prefers the shortest
mate, the random tie-break only fires among genuinely equidistant mating moves,
and the forced mate actually converges.

### 4.3 The TT correction

Mate scores in the TT need an extra fix that is easy to miss. A score
*returned* from a leaf is relative to the **current search root** (`MATE_SCORE − ply`
where ply is measured from root). But the TT is keyed on positions, not search
trees — the same position can be reached at a different ply on a later search,
and the cached mate distance needs to come out right anyway.

We store as **distance-from-this-node** (an absolute property of the position)
and decode on probe:

```ts
const MATE_BOUND = MATE_SCORE - 1000;        // any |score| ≥ MATE_BOUND is a mate

function scoreToTT(score, ply):              // adds ply to mate scores on store
function scoreFromTT(score, ply):            // subtracts on probe
```

Non-mate scores pass through unchanged. The 1000 buffer is comfortably larger
than any practical search ply, so a normal evaluation (max ~5000–60000 cp under
extreme material) never collides with the mate region.

### 4.4 Why this matters beyond chess

The pattern is general: **a tree search returns a leaf score; that score is in
some coordinate system; transposition tables sit *outside* any one tree.** If
the coordinate system depends on something the TT does not store (here, the
search-relative ply), the TT silently corrupts data on later probes from
different paths. The fix is to convert every cross-tree quantity to an
absolute frame on the way in and back to the local frame on the way out — the
same pattern as time zones, or relative file paths, or local vs world space in
graphics.

---

## 5. Won-endgame conversion — the other two layers

Even with mate distances encoded, the engine still needs a *reason* to drive a
won position toward a mate that is currently *beyond* the search horizon.
That reason is the **mop-up term** in
[`evaluate.ts`](../../src/experiments/chess/ai/evaluate.ts), and it had two
problems.

### 5.1 The "too much material disables the mate driver" bug

The original mop-up was gated:

```ts
if (eg && Math.abs(score) > 100) { /* corner-drive + king proximity */ }
```

with `eg = isEndgame(pos)` defined as **total non-king/non-pawn material < 1500**.

Material totals at game end (PIECE_VALUE: P=100, N=320, B=330, R=500, Q=900):

| Material configuration | Total | `isEndgame`? | Mop-up active? |
|---|---|---|---|
| K+Q vs K | 900 | ✅ | ✅ |
| K+R vs K | 500 | ✅ | ✅ |
| K+Q+R+B vs K | 1730 | ❌ | ❌ |
| K+Q+Q vs K | 1800 | ❌ | ❌ |

The trap: the more material the winner has, the *less* the engine knows how to
mate. We fixed this with `isMatable(losing)` — the losing side has no pawns and
at most a single minor (≤ `PIECE_VALUE.B` = 330). Now mop-up fires on either
`eg` OR `isMatable(losingSide)`, so K+anything vs K corner-drives correctly,
and normal middlegames are untouched (both sides have pawns → `isMatable` is
false for both).

### 5.2 The cornered-king plateau

With the bare king on a1 (`cornerDist = 6`) and the winning king at b2
(`kingDist = 2`), the original bonus

```
cornerDist * 25 + (14 − kingDist) * 10  =  6*25 + 12*10  =  270 cp
```

is **maxed out**. Every queen-and-king shuffle from there scores the same.
The engine has no eval gradient to coordinate its pieces into a mating
position, so it shuffles until either the search horizon happens to land on a
mate (lucky) or the 50-move counter runs out (the unlucky default).

The fix is a third term that *isn't* about the kings — it's about the net
tightening around the bare king:

```ts
// kingRestriction(): count on-board squares around the losing king that the
// king cannot escape to (own piece on it, or attacked by the winner).
bonus = cornerDist * 25 + (14 − kingDist) * 10 + restriction * 15
```

Each square an attacker covers nudges the eval by 15 cp, so the queens have a
concrete incentive to close in. The plateau collapses into a slow but
monotonic descent toward the mating net, which is then within the search
horizon for the actual mate-in-N to fire.

### 5.3 The static-eval tiebreak at the root

The third layer, in [`index.ts`](../../src/experiments/chess/ai/index.ts):
among root moves whose **deep-search** scores tie, prefer the one whose
**static eval of the resulting position** is best, then fall back to random
among any still-tied moves. With #5.2 in place, "queens closer to the king"
now has a measurable static-eval advantage, so the tiebreak picks the move
that visibly continues to tighten the net instead of one that randomly undoes
last move's progress. Random tie-break is preserved as a final fallback so
true symmetry-breaking (e.g. unrelated middlegame ties) still happens.

Full debugging narrative: [`ISSUES.md`](./ISSUES.md).

---

## 6. The opening book

A position-keyed map built at module load by replaying a handful of mainline
openings (Ruy Lopez, Italian, Scotch, Sicilian variants, French, Caro-Kann,
QGD, Slav, King's Indian, Nimzo, Dutch, English, Réti…). At probe time it
matches the current `positionKey(pos)` and picks a candidate move at random
among those stored. Misses fall through to search.

Two quiet correctness considerations:

1. **The stored `Move` objects carry stale `captured` references** from the
   build-time replay. The lookup resolves through the caller's live legal-move
   list so the returned `Move` matches the current position's piece pointers.
2. **The book is disabled** for move grading (§8) and for the lower skill
   tiers (`config.useBook` false on Beginner/Casual) — both want pure search
   behaviour, not a random book pick.

The Zobrist keys the book stores are only consistent across module instances
because of the seeded PRNG (§9.2). Without that, the worker-side book would
be useless: the main thread's keys would never match the worker's table.

---

## 7. Difficulty scaling — strength as a dial, not a slider

The skill system in [`ai/skill.ts`](../../src/experiments/chess/ai/skill.ts)
exposes five tiers (Beginner, Casual, Intermediate, Advanced, Master) and
each is an [`AIConfig`](../../src/experiments/chess/types.ts) — **a vector of
independent knobs**, not a single depth number.

| Tier | depth | qdepth | noise (cp) | topN | weights | book | mobility | kingSafety | pawnStructure | mopUp |
|---|---|---|---|---|---|---|---|---|---|---|
| **Beginner** | 1 | 0 | 250 | 5 | 35/25/20/10/10 | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Casual** | 2 | 1 | 80 | 3 | 60/25/15 | ✗ | ✗ | ✅ | ✗ | ✗ |
| **Intermediate** | 3 | 2 | 25 | 2 | 80/20 | ✅ | ✅ | ✅ | ✅ | ✗ |
| **Advanced** | 5 | 4 | 5 | 2 | 97/3 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Master** | 7 | 4 | 0 | 1 | 100 | ✅ | ✅ | ✅ | ✅ | ✅ |

### 7.1 What each knob does (and why depth alone isn't enough)

- **`depth`** — alpha-beta depth. The obvious dial. *Insufficient on its
  own:* a depth-2 search still plays a recognisably strong tactical game on
  pieces it sees, because alpha-beta is exact at its horizon and the move
  ordering surfaces tactics. A shallow Stockfish still beats most humans.
- **`qdepth`** — quiescence ceiling. **The hidden depth knob.** A small `qdepth`
  on a shallow search produces the *intuitive* "weaker because it walks into
  tactical shots" feeling: it can see one or two captures but misses the
  three-deep recapture trade.
- **`evalNoiseCp`** — uniform random offset added to each root move's score at
  selection time only. Makes the player misjudge by a few hundred cp at
  Beginner (small piece value) down to imperceptible at Advanced. **Crucial:
  noise is applied only at the root**, never inside alpha-beta — internal
  bounds need to stay correct or pruning corrupts.
- **`topN` + `topNWeights`** — instead of always picking the top-scored move,
  sample from the top N with a fixed weight distribution. Beginner picks the
  best move only 35% of the time. This is what makes weaker tiers feel *human*
  rather than just bad — they often choose a reasonable-but-not-best move.
- **`useBook`** — toggles the opening book.
- **`eval.{mobility, kingSafety, pawnStructure, mopUp}`** — turn off
  evaluation *terms*. A Beginner that doesn't know about pawn shields or
  passed pawns plays positionally weak chess even when its tactics are sharp.
  This is the most "personality-shaping" knob; it's also the trickiest,
  because turning off a term *narrows* the eval distribution and can
  inadvertently increase ties (a place the §5.3 tiebreak matters).

### 7.2 The wiring trick: a module-level options holder

The eval and quiescence need to read these knobs at every node without
threading a config parameter through hundreds of recursive call sites. The
solution is a tiny holder in
[`ai/searchOptions.ts`](../../src/experiments/chess/ai/searchOptions.ts):

```ts
let current: AIConfig = SKILL_PRESETS[DEFAULT_SKILL];
export function setSearchOptions(c): void { current = c; }
export function getSearchOptions(): AIConfig { return current; }
```

`getBestMove` calls `setSearchOptions(config)` at the start of every search.
This is safe *only because the worker serialises requests* — one
`getBestMove` runs at a time on each thread, so the holder cannot be observed
mid-mutation. In a multi-threaded search this would be a data race; here it
is just a clean dependency-injection shortcut.

### 7.3 What we observed dialling the knobs

- **Depth alone produces a faster strong engine, not a weaker one.** Going
  from depth 5 to depth 3 noticeably reduces tactical horizon but the chosen
  moves are still recognisably "engine-like." The Casual and Beginner tiers
  needed the noise + top-N weights *as well* to feel human-fallible.
- **Turning off mop-up at Casual and below was deliberate.** Without it, a
  Beginner that happens to grind into a winning endgame may shuffle and draw
  — but that is *also* how a beginner-level human plays, and it keeps the
  lower tiers genuinely beatable. Advanced/Master both keep mop-up on so the
  §4–§5 mate-conversion fixes actually take effect for them.
- **Noise + top-N composes oddly at extreme settings.** Beginner has both
  `noise=250cp` and `topN=5` with a flat-ish weight distribution; the
  effective player has a "wide cone of competence" rather than a fixed style.
  Casual at `noise=80, topN=3` is more recognisable.
- **Move grading must not consult any of this.** [`GRADER_CONFIG`](../../src/experiments/chess/ai/skill.ts)
  pins depth 2, qdepth 4, zero noise, topN=1, no book, all eval terms on —
  the grader needs a single, deterministic "what is the best move here?"
  reference *regardless* of how the playing AI is configured.

---

## 8. Move grading

Each completed move is graded by comparing **the player's chosen move** to
**the engine's preferred move at the grader settings**:

```
cpLoss = isWhite ? (evalBest − evalChosen) : (evalChosen − evalBest)
```

with `eval*` being a static `evaluate()` on the resulting position. Buckets
in [`utils.ts`](../../src/experiments/chess/utils.ts) map cpLoss to symbols:

| cpLoss | Grade |
|---|---|
| ≤ 0 | `!!` brilliant |
| ≤ 25 | `!` good |
| ≤ 75 | (silent — best/expected move) |
| ≤ 150 | `!?` interesting |
| ≤ 300 | `?!` inaccuracy |
| ≤ 500 | `?` mistake |
| > 500 | `??` blunder |

Calling the grader synchronously on the main thread is fine because it runs at
fixed shallow depth (2), and only once per move played. It uses
`getBestMove(posBefore, GRADER_CONFIG)` — *not* the worker — so it doesn't
contend with the playing AI's TT and produces results independent of the
selected skill tier.

---

## 9. Engineering — making the search responsive

### 9.1 The Web Worker

[`ai/worker.ts`](../../src/experiments/chess/ai/worker.ts) runs `getBestMove`
off the main thread. The hook
[`useChessAI`](../../src/experiments/chess/hooks/useChessAI.ts) owns one
persistent worker per game session and posts message-typed search requests
with the current position, the selected `AIConfig`, and a snapshot of the
repetition map. The worker replies with the chosen move; the UI thread stays
responsive even at Master settings.

A few small but important details:

- **Stale-result filtering by request id.** Each search is posted with an
  auto-incrementing `id`. If a new search is posted before the previous one
  returns, the worker still completes the old search (we don't bother with
  mid-search cancellation), but the main thread *ignores* any result whose id
  isn't the latest. Cleaner and simpler than terminate-and-recreate.
- **Persistent worker means persistent TT.** The transposition table is
  module-scoped in the worker. Across consecutive searches in the same game,
  the TT is hot — exactly what we want. On `Reset`,
  [`index.tsx`](../../src/experiments/chess/index.tsx) sends a `clear` message
  that calls `clearTT()` on the worker side; the main thread separately
  resets its own TT used by the grader.

### 9.2 Deterministic Zobrist — the silent cross-thread bug

[`zobrist.ts`](../../src/experiments/chess/zobrist.ts) precomputes 12·64
piece-square keys plus turn, castling, and ep-file keys at module load. The
original `rand64()` used `Math.random()`. **In a single-thread engine this is
fine.** In a worker world it is a silent disaster:

> The main thread and the worker are independent module instances. Each runs
> `rand64()` independently at load time. Their key tables **disagree**. So:
>
> - The main thread builds `posHistoryRef` with its own keys and passes the
>   map to the worker.
> - The worker computes `positionKey(pos)` with its own keys and looks up
>   the map.
> - **Lookups always miss.** Repetition detection is silently broken across
>   the boundary, and so is the opening book (it was built in whichever
>   module loaded it first).

The fix is a seeded splitmix64 PRNG:

```ts
const MASK64 = (1n << 64n) - 1n;
function makeRand64(seed: bigint): () => bigint {
  let state = seed & MASK64;
  return () => {
    state = (state + 0x9E3779B97F4A7C15n) & MASK64;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK64;
    z = (z ^ (z >> 31n)) & MASK64;
    return z;
  };
}
const rand64 = makeRand64(0x9E3779B97F4A7C15n);
```

A fixed seed and a deterministic sequence guarantee the worker and the main
thread produce **identical** key tables, byte for byte. The book lookups land,
the repetition map matches, the TT (if ever shared across threads) would too.

Generalised lesson: **`Math.random()` at module load is a thread-local
artifact.** Anything that crosses a worker boundary and depends on module-load
state needs to be deterministic or explicitly synchronised.

---

## 10. What we tried and reverted — Aspiration Windows

Aspiration windows narrow the alpha-beta window at the root of each iterative
deepening iteration to `[prevScore − δ, prevScore + δ]` and widen on
fail-high/fail-low. They are standard in time-limited engines because they
cut nodes per iteration.

We implemented them, tested, and **reverted** for two reasons:

1. **No time budget here.** The engine runs at fixed depth; "fewer nodes per
   iteration" just means slightly less CPU, not deeper search. Most of the
   benefit aspiration buys evaporates when depth is fixed.
2. **Narrow root window blurs tie-breaking.** With a window of ±25 cp many
   root moves that would normally have distinct fail-soft scores can land at
   the window bound, manufacturing artificial ties that then pass through
   the root tiebreak. In a project where §5.3 *adds* a tiebreak specifically
   to discriminate equal-looking moves, this was the wrong direction.

The roadmap entry in [`IMPROVEMENT.md`](./IMPROVEMENT.md#14-aspiration-windows)
records this as "implemented then reverted" so a future revisit knows the
context.

---

## 11. Fidelity scorecard

What we implement, faithfully or with documented deviation:

| Aspect | Status |
|---|---|
| Alpha-beta with PVS, LMR, NMP, futility, check extensions | ✅ canonical CPW recipe |
| Make/unmake mutation pattern | ✅ |
| Incremental Zobrist hash (XOR deltas in `makeMove`) | ✅ — with deterministic seeded PRNG (§9.2) |
| Transposition table, depth-preferred replacement | ✅ |
| Iterative deepening + root re-ordering | ✅ |
| Move ordering: TT > MVV-LVA > promo > killers > history | ✅ |
| Killer moves (two per ply) | ✅ |
| History heuristic with periodic decay | ✅ — halved at the start of each search |
| Null-move pruning, adaptive R | ✅ — `R = 3 + ⌊depth/3⌋` |
| Futility pruning (depths 1–2) | ✅ |
| Check extensions, capped | ✅ — `MAX_EXTENSIONS = 16` |
| LMR with logarithmic reduction | ✅ — `⌊0.99 + ln(d)·ln(i+1)/3.14⌋` |
| Quiescence: captures + checks (bounded) + evasions | ✅* — `QS_CHECK_PLIES = 2`; mate inside qs is ply-adjusted |
| Mate-distance encoding (leaf + TT round-trip) | ✅ |
| Mop-up: corner drive + king proximity + restriction | ✅* — broader trigger via `isMatable` (§5.1) |
| Opening book | ✅* — small set, replayed at module load |
| Web Worker search | ✅ |
| Difficulty scaling (depth, qdepth, noise, top-N, eval toggles, book) | ✅ |
| Contempt (`CONTEMPT = −50`) on near-repetition | ✅ |
| Aspiration windows | ✗ — implemented and reverted (§10) |

---

## 12. Where this is *not* a real chess engine

Out of scope, by choice:

- **No UCI protocol.** The engine is a TypeScript module, not a UCI process.
  No `go infinite`, no pondering, no time controls.
- **No bitboards.** Boards are `(Piece | null)[][]`. Move generation walks the
  8×8 array, which is fine for depth ≤ 7 in a browser and miles slower than
  bitboard generation. A real engine generates moves with magic bitboards.
- **No NNUE / no learned evaluation.** The eval is hand-crafted material +
  PSTs + mobility + pawn structure + king safety + mop-up. Modern engines
  (Stockfish, Berserk, …) use small neural nets for static eval and play
  ~700 Elo stronger as a result.
- **No syzygy / endgame tablebases.** A 6-piece tablebase is ~150 GB; even
  3–4 piece tables (a few MB) we deliberately skipped — see roadmap item
  #18. Our endgame play is heuristic.
- **No multi-thread search.** One worker, one game. No Lazy SMP.
- **Fixed depth, no time management.** Iterative deepening runs to a fixed
  `maxDepth`, never to a deadline.
- **Small opening book.** ~20 mainlines vs the millions-of-positions books a
  real engine consults.
- **No 50-move-rule contempt model**, no fortress detection, no Berserk-style
  multipv analysis.

The engine is small and self-contained on purpose. Estimated strength after
all the fixes here: ~2300–2700 against humans (rough range). Far below the
3600+ of state-of-the-art engines, but recognisably strong over the board.

---

## 13. Further real-world context

- **Move ordering is most of alpha-beta's strength.** Bondarenko's classic
  result: in well-ordered positions about 75% of beta cut-offs come from the
  TT move alone. Spending complexity on ordering pays for itself many times
  over in pruning.
- **Mate distance encoding is universal.** Stockfish, Crafty, Berserk, every
  serious engine encodes mate scores as `MATE − ply` (or `MATE − dist`) and
  every TT does the same store/probe correction we describe in §4.3. The
  fact that we had to *discover* this from a "shamefully can't finish K+Q+Q
  vs K" symptom is itself a testament to how easy it is to miss when reading
  textbook alpha-beta pseudocode.
- **Mop-up is a stand-in for tablebases.** Real engines just probe a
  6-piece tablebase; ours uses cornerDist + kingDist + restriction because we
  can't ship 150 GB. The §5 patches are essentially an attempt to
  hand-craft the gradient a tablebase would provide implicitly.
- **The difficulty scaling design** (noise + top-N + eval-term toggles)
  matches how Stockfish's "Skill Level" UCI option works internally: lower
  skill levels add randomness to move *selection* (after the search returns
  the move list), not to the search itself. This keeps the engine internally
  correct — only the choice among root candidates is dialled down.
- **Web Worker + deterministic Zobrist** is the kind of bug that doesn't
  appear in textbooks because textbook engines run in a single OS process.
  The cross-thread module-state hazard generalises far beyond chess: anything
  that derives identifiers from `Math.random()` at module load and then ships
  them across an isolation boundary (worker, frame, process) has this bug
  latent.

---

*Maintained alongside the code. If the search stack, evaluation terms, mate
encoding, or the skill presets change, update §2–§7 and the §11 scorecard. If
a new endgame-conversion failure mode appears, record it in
[`ISSUES.md`](./ISSUES.md) and link the finding from §5.*
