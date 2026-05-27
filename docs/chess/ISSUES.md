# Chess AI — Known Issues

Reference: [`src/experiments/chess/ai/search.ts`](../../src/experiments/chess/ai/search.ts),
[`src/experiments/chess/ai/evaluate.ts`](../../src/experiments/chess/ai/evaluate.ts),
[`src/experiments/chess/ai/index.ts`](../../src/experiments/chess/ai/index.ts)

---

## ISSUE-1: Engine fails to convert overwhelmingly won endgames

**Status:** Fixes applied — needs in-game verification
**Severity:** High — turns trivially won games into draws

### Symptoms

The AI reaches a completely winning material balance and then shuffles until a
draw (50-move rule or threefold repetition) instead of delivering mate.

Observed in real games:

- **K+Q+R+B vs lone K** — White drew by the 50-move rule while up a queen, a
  rook, and a bishop.
- **K+Q+Q vs lone K** — Black, two queens up against a lone king, drew by
  repetition without ever forcing mate.
- **K+Q+Q vs cornered K** — even with the losing king already driven into a
  corner, the engine cannot finish the mate.

### Root causes

There are three independent contributors. They stack, and each must be addressed.

#### 1. Flat mate scores — no distance-to-mate encoding (PRIMARY) — **FIXED**

Both mate returns now produce `±(MATE_SCORE − ply)` so a quicker mate scores
strictly higher in magnitude. The transposition table converts mate scores on
store (add ply → "distance from this node") and probe (subtract ply → "distance
from current root"), so a transposition reached at a different ply still decodes
to the right root-relative mate distance. `quiesce()` now takes a `ply`
parameter and uses `ply + qdepth` for the effective distance of any mate it
finds. See `scoreToTT` / `scoreFromTT` in
[`search.ts`](../../src/experiments/chess/ai/search.ts).

#### 2. Mop-up heuristic only guides the kings, not the winning pieces — **FIXED**

`kingRestriction()` in [`evaluate.ts`](../../src/experiments/chess/ai/evaluate.ts)
now counts the on-board squares around the losing king that it cannot escape
to (occupied by its own piece, or attacked by the winner), and adds
`restriction × 15` cp to the mop-up bonus. This provides the gradient that was
missing once the king was cornered: each attacker that covers another escape
square is a small but consistent eval improvement, so the engine actively
coordinates its heavy pieces around the bare king instead of plateauing.

#### 3. Random tie-breaking actively undoes progress on plateaus — **FIXED**

The root in [`index.ts`](../../src/experiments/chess/ai/index.ts) now resolves
ties in two stages: among moves with identical deep-search scores, it prefers
the one whose resulting position has the best **static eval** (which now
includes the king-restriction term from #2), then falls back to random choice
among any still-tied moves. This preserves loop-breaking while preventing the
engine from picking a move that visibly undoes mop-up progress just because the
deep search couldn't see past the horizon.

### Already applied (partial mitigation)

The mop-up term was previously gated behind `isEndgame()` — defined as total
non-king/non-pawn material `< 1500`. Ironically this *disabled* mate-driving
exactly when the winner had the most material (K+Q+R+B = 1730 > 1500), so the
engine never even tried to corner the king. This was fixed by adding
`isMatable()` in [`evaluate.ts`](../../src/experiments/chess/ai/evaluate.ts):
the mop-up now fires whenever the *losing* side is a near-bare king (no pawns,
at most a single minor), independent of the winner's material. This restores the
corner-driving gradient, but issues #1–#3 still prevent the final mate.

### Reproduction

1. Start an `ava` or `hva` game and reach (or set up) a lone king vs K+Q+Q.
2. Observe the winning side corner the losing king (mop-up working) but then
   shuffle without delivering mate, ending in a 50-move or repetition draw.

---

## Notes

- Search runs at a **fixed depth** (`hva` = 4, `ava` = 3, +1/+2 in low-piece
  endgames), not a time budget. So slow heuristics cost wall-clock time but do
  not reduce search depth.
- Aspiration windows (roadmap #14) were implemented then reverted — negligible
  benefit at fixed depth and a slight tie-break risk. See
  [`IMPROVEMENT.md`](./IMPROVEMENT.md).
