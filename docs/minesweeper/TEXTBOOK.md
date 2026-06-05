# Minesweeper — Textbook & Real-World Research

Reference code:
[`generator.ts`](../../src/experiments/minesweeper/generator.ts) (the no-guess forge),
[`solvers/core.ts`](../../src/experiments/minesweeper/solvers/core.ts) (shared substrate + `fullPropagate`),
[`solvers/index.ts`](../../src/experiments/minesweeper/solvers/index.ts) (the engine registry),
the seven engines in [`solvers/`](../../src/experiments/minesweeper/solvers/),
[`useMinesweeper.ts`](../../src/experiments/minesweeper/useMinesweeper.ts) (game state + solver playback),
[`constants.ts`](../../src/experiments/minesweeper/constants.ts).

This is the research record for the Minesweeper experiment, which has **two**
algorithmic halves: a generator that forges minefields guaranteed to be
first-click-safe *and* solvable with no guessing, and a suite of seven solver
engines that range from a naive baseline to a complete CSP prover and an exact
probability calculator. It covers the canonical theory, how faithfully the code
models it, the deviations and why they were chosen, and a section of player tips
that fall straight out of the solver logic. Findings accumulated while building
and debugging the experiment.

---

## 0. The single most important finding

> **A no-guess minefield cannot be *constructed*; it can only be *found*. You
> place mines at random and let a complete solver be the judge — regenerating or
> repairing until it passes. So the generator's power is exactly the solver's
> power: the same logic a perfect player would use is the oracle that defines
> what "solvable" means.**

There is no known way to *directly* lay out mines so that the board is
guaranteed solvable by pure logic — the property "no arrangement of the
remaining mines is ambiguous from the first click" is global and emergent, not
local. Every serious no-guess generator is therefore **generate-and-test**: it
proposes a board and asks a solver "could a perfect logician clear this without
ever flipping a coin?" Our [`generateField`](../../src/experiments/minesweeper/generator.ts)
does exactly that, and the judge is [`fullPropagate`](../../src/experiments/minesweeper/solvers/core.ts)
— the very routine the in-app "backtracking" engine runs to play.

Two consequences, both of which surprised us in the build:

1. **Generation quality is solver quality.** A weak solver rejects boards that
   *are* solvable (it just can't see the deduction), so it wastes attempts and
   biases difficulty. Strengthening the solver immediately makes the generator
   faster and able to accept harder boards. They are the same problem wearing
   two hats.
2. **It is fast.** Folklore treats no-guess *Expert* (30×16, 99 mines)
   generation as expensive. With a complete solver plus single-mine hill-climb
   repair (§2), our Expert boards forge in **single-digit milliseconds** —
   because repair edits the *specific* ambiguous frontier instead of re-rolling
   the whole board (§2.3).

---

## 1. Shared model & terminology

| Term | Meaning here |
|---|---|
| **Field** | `width × height` grid, row-major index `i = y·width + x`. |
| **Cell** | ground truth: `{ mine, adjacent }` — `adjacent` = mines in the 8-neighbourhood (0–8). |
| **Clue / constraint** | a revealed number `n` over its still-hidden neighbours: *exactly `n − (known mines)` of these `k` cells are mines*. The whole board is a conjunction of such exact-cardinality constraints. |
| **Frontier** | hidden cells adjacent to a revealed number (the only cells any clue can speak about). |
| **Component** | a maximal set of frontier cells joined by shared constraints (independent sub-puzzles). |
| **Opening** | a connected region of `adjacent = 0` cells plus its numbered border — what one click on a zero cascades open. |
| **3BV** | Bechtel's Board Benchmark Value: minimum left-clicks to clear with perfect play = (number of openings) + (non-mine numbered cells not touching any opening). The board's intrinsic click-complexity. |
| **No-guess** | the board is fully determinable by logic from the first click — `revealed + identified == total` with no step ever requiring a probability. |

Geometry helpers live in [`grid.ts`](../../src/experiments/minesweeper/grid.ts)
(`neighbors`, `neighborTable`, `disk`); the seedable PRNG (mulberry32) in
[`rng.ts`](../../src/experiments/minesweeper/rng.ts) so any field is
reproducible from its `seed`.

---

## 2. The generator

[`generateField(cfg, origin)`](../../src/experiments/minesweeper/generator.ts)
forges a field that is, by construction, **first-click-safe**, **no-guess
solvable**, and **difficulty-rated**.

### 2.1 First-click safety

Mines are drawn only from cells **outside** `disk(origin, safeRadius)` (a
Chebyshev square around the first click). With the default `safeRadius = 1` the
clicked cell and all 8 neighbours are mine-free, so the clicked cell has
`adjacent = 0` and the first click always **cascades open a region** — the
satisfying opening move, guaranteed. `safeRadius = 0` guarantees only the single
clicked cell. This is the modern-Minesweeper convention: mines are placed
*after* the first click is known, never before.

### 2.2 Generate-and-test

`mines` cells are chosen uniformly at random from the candidate set, adjacency
is computed, and the board is handed to `fullPropagate` (§3.7). If it solves the
board from `origin`, accept. The whole forge is **synchronous** and bounded by a
wall clock, so the constants are time governors:

| Constant | Value | Role |
|---|---|---|
| `FRESH_BEFORE_SWAP` | 12 | fresh random boards tried before switching to repair |
| `MAX_ATTEMPTS` | 600 | total fresh boards |
| `MAX_SWAPS` | 1500 | single-mine relocations during repair |
| `TIME_BUDGET_MS` | 1400 | hard wall for one forge |
| `MAX_DENSITY` | 0.28 | mine density past which no-guess is effectively impossible — we clamp and say so |

### 2.3 Single-mine hill-climb repair (the speed trick)

Pure re-rolling is hopeless at Expert density — random boards are almost never
no-guess. After a few fresh tries the generator switches to **hill climbing**:
take the best board so far, find a mine that *borders an undecided frontier
cell* (the knot the solver choked on), relocate it to a random empty cell, and
re-solve. Keep the candidate if its **logic coverage** (cells the solver
resolves) doesn't regress; restart fresh after ~220 stagnant swaps. Because the
edit targets the actual ambiguity instead of perturbing the whole board, it
converges far faster than independent re-rolls — this is why Expert is
instant rather than a frozen tab.

Every candidate is re-verified from scratch, so repair can never produce a
false "solvable" — correctness rides entirely on the solver.

### 2.4 Honesty when the budget runs out

If no no-guess board is found within budget (only realistic near `MAX_DENSITY`),
`generateField` returns the **best near-solvable board** with `solved: false`
and the list of `undecided` cells. The UI surfaces these as "guess points." A
generator that silently shipped an unsolvable board would be worse than one that
admits defeat; the diagnostic is the honest answer.

### 2.5 Difficulty rating

The generator does not *target* a difficulty — it rates whatever it forged. The
score (0–100, tiers trivial → easy → medium → hard → brutal) blends three
signals (see `rate()`):

```
rating ≈ min(1, density/0.28)·34          # how dense
       + (enumerate ? 34 : subset ? 18 : 0)  # the hardest technique the proof NEEDED
       + min(26, (3BV/total)·64)             # how much board there is to clear
       (unsolved boards are floored at 88 — an unavoidable guess is its own brutal)
```

The middle term is the interesting one: **difficulty is defined by the hardest
deduction the board forces**, read straight off the solver's technique counter.
A board solvable by counting alone is trivial; one that needs frontier
enumeration is hard. This is a more honest difficulty axis than mine count.

---

## 3. The solver suite

Seven engines, all behind one [`Solver`](../../src/experiments/minesweeper/solvers/types.ts)
interface returning a normalized `SolverReport` (safe/mine/undecided sets,
per-cell probabilities, best guess, technique counts, an ordered move log, and
timing) so a future side-by-side comparison view can line them up. They share
the substrate in [`core.ts`](../../src/experiments/minesweeper/solvers/core.ts):
a mutable `Knowledge` (revealed/mine bitsets), `reveal` (with zero-cascade),
`markMine`, constraint extraction, and the deduction primitives. **Soundness is
structural:** every engine only ever reveals a truly-safe cell or flags a
truly-mine cell, because the board is consistent and the deductions are valid —
so "solved" genuinely means "no guess was needed."

Each engine is also a building block: a richer engine is a weaker one plus an
escalation. Ordered weakest → strongest.

### Single-Point
**Definition.** The two trivial count rules on one clue at a time: if a number
already touches all its mines, its other hidden neighbours are safe; if its
hidden-neighbour count equals its remaining mines, they're all mines.
**Character.** Instant, but blind to anything spanning two clues. Stalls the
moment a board needs a 1-2-1.
**Our impl.** `singlePointStep` run to a fixpoint.
**Completeness.** Incomplete — the baseline every other engine must beat. On
random Intermediate no-guess boards it typically clears ~75–80% then halts.

### Single-Point + Backtracking
**Definition.** Count rules as the cheap fast path; when they stall, escalate —
subset elimination, then exhaustive component enumeration, then the endgame
global count — and hand control back to counting after each breakthrough.
**Character.** The "and it actually finishes" upgrade to Single-Point: counting
carries the bulk of the board for free; real search only ever breaks the
occasional impasse.
**Our impl.** [`singlePointBacktracking.ts`](../../src/experiments/minesweeper/solvers/singlePointBacktracking.ts).
**Completeness.** Complete — clears every no-guess board. (See §4 for why the
subset step is *required*, not optional, for completeness within budget.)

### Constraint Propagation
**Definition.** Single-Point plus **subset elimination**: when one clue's hidden
cells are a subset of another's, the difference carries `B.mines − A.mines` mines
— often resolving the difference outright. This is the closure that cracks
1-2-1 / 1-2-2-1.
**Character.** What a strong human plays on sight. When it halts with cells left,
that's a reliable signal the position needs deeper search.
**Our impl.** `singlePointStep` + `subsetStep` to a fixpoint.
**Completeness.** Incomplete (no enumeration) but far stronger than Single-Point.

### Linear Algebra
**Definition.** Treat the clues as a linear system **A·x = b** over mine
indicators `x ∈ {0,1}`; row-reduce to echelon form. Each reduced row is a fresh
combination of clues; a **min/max bound argument** pins cells (if a row's RHS
equals its max = Σ positive coefficients, every positive-coef cell is a mine and
every negative-coef cell is safe; symmetrically at the min).
**Character.** A different, polynomial-time lens than subset — catches some cases
subsets miss, and vice versa.
**Our impl.** [`linearAlgebra.ts`](../../src/experiments/minesweeper/solvers/linearAlgebra.ts)
with exact rational (`Frac`) Gaussian elimination.
**Completeness.** Incomplete — the linear relaxation can't always settle
integrality.

### Backtracking ("tank")
**Definition.** When propagation stalls, split the border into independent
components and **enumerate every consistent mine arrangement** of each; a cell
that's a mine in all of them is a mine, in none is safe. In the endgame the
global mine budget becomes one more constraint.
**Character.** The complete reasoner — confirms solvability and pinpoints true
ambiguity (a genuine 50/50 yields no forced cell).
**Our impl.** [`backtracking.ts`](../../src/experiments/minesweeper/solvers/backtracking.ts)
= `fullPropagate` (count → subset → component enumeration → endgame), bounded by
`ENUM_LIMIT` and `ENUM_NODE_CAP`.
**Completeness.** Complete within the enumeration budget. This is the generator's
judge.

### SAT / CSP
**Definition.** Model the board as exact-cardinality constraints and ask
**satisfiability** questions via DPLL with feasibility propagation: a cell is
*provably safe* iff "this cell is a mine" is UNSAT; *provably a mine* iff "this
cell is safe" is UNSAT.
**Character.** A formal *certificate*, not a count — the right tool for *proving*
a position has no ambiguity. Slower than counting (two SAT calls per frontier
cell) but it's the rigorous oracle.
**Our impl.** [`sat.ts`](../../src/experiments/minesweeper/solvers/sat.ts). On
hitting the node cap it returns "satisfiable" so it never *over*-claims a forced
cell — it degrades to conservatively incomplete, never wrong.
**Completeness.** Complete within budget; corroborates Backtracking (§6).

### Probabilistic
**Definition.** Run the full logic; when stuck, compute each remaining cell's
**exact mine probability** and recommend the safest click.
**Character.** The endgame brain — and the bridge from "is it solvable" to "what
should a human do when it isn't."
**Our impl.** [`probabilistic.ts`](../../src/experiments/minesweeper/solvers/probabilistic.ts).
Probabilities are exact, not local estimates: each component is enumerated, then
the components are combined under the **global mine budget** (including the
"outside" cells no clue touches) via a generating-function convolution counted in
**BigInt** (§5). Cells at probability 0 or 1 are forced — so it also catches
global-count deductions the frontier-only engines miss.
**Completeness.** Incomplete in general (bails if a component exceeds the cap),
but it's the only engine that *quantifies* the residual.

### 3.7 `fullPropagate` — the shared complete pipeline

The escalation loop `count → subset → per-component enumerate → endgame global
enumerate`, run to a fixpoint, lives once in `core.ts` and is reused by the
Backtracking engine, the Single-Point+Backtracking engine, the Probabilistic
engine's logic phase, **and the generator's no-guess check**. One source of
truth for "solvable," so the generator and the in-app solver can never disagree.

---

## 4. The `ENUM_LIMIT = 22` finding — why subset is *required*, not optional

The first cut of Single-Point + Backtracking deliberately *omitted* subset
elimination, to make the point that "counting + search is enough to finish." It
wasn't: it solved only **8/10** Expert boards and 18/20 Intermediate, while the
full pipeline did 10/10 and 20/20.

The cause is a hard budget, not a logic gap. Component enumeration is capped at
**`ENUM_LIMIT = 22`** cells (with an `ENUM_NODE_CAP = 60000` backtracking-node
guard) — without a cap, a 30-cell component is `2³⁰` arrangements and the tab
freezes. The generator only accepts boards that `fullPropagate` solves, and
`fullPropagate` runs **subset first** — and subset elimination *shrinks border
components* by resolving their cheap cells, dropping them under 22 so enumeration
can finish. Strip subset out and some components stay larger than the cap, get
skipped, and the solver stalls on a board that is genuinely solvable.

> **Subset elimination earns its keep less as a deduction and more as a
> *tractability* step: it keeps the exponential search inside its polynomial
> budget.** Re-adding it took Single-Point + Backtracking to 10/10. The lesson
> generalises to any CSP with an exponential fallback: cheap propagation isn't
> just a speed-up, it's what makes the complete step *reachable*.

---

## 5. Exact probability under the global budget

When the logic genuinely runs out, "what's the safest cell?" is not a local
question — a cell's mine probability depends on every consistent global
arrangement of the *remaining* mines, across all border components and the cells
no clue touches. The Probabilistic engine computes it exactly:

1. Enumerate each component, recording, per mine-total `m`, how many solutions
   have that total (`countByM`) and how many have a given cell as a mine.
2. Treat each component's `countByM` as a polynomial in `t` (coefficient of `tᵐ`
   = number of arrangements with `m` mines) and **convolve** them — the product
   counts joint frontier arrangements by total frontier mines.
3. Weight each total `S` by `C(outside, R − S)` — the ways to place the leftover
   `R − S` mines among the `outside` unconstrained cells.
4. A cell's probability is its weighted mine-count over the grand total.

All counts are **BigInt**: `C(n, k)` for Expert-sized outside regions overflows
`double` long before the ratios do, so exact integer arithmetic is the only way
to keep the probabilities correct.

The correctness check that pinned the implementation: **Σ(mine probability over
all unknown cells) must equal the number of remaining mines.** It held to
rounding on **40/40** random stuck positions — strong evidence the convolution
and the global weighting are right. The same routine emits forced cells (p = 0
or 1), which is how it finds global-count deductions — e.g. "all remaining mines
are on the frontier, so every outside cell is safe" — that a frontier-only
engine cannot.

---

## 6. Animating a solver like a human (replay the moves, not the answer)

The first auto-solve animation looked *fake* — and a user caught exactly why:
some regions "exploded" open while isolated numbered cells appeared one at a
time, with no causal rhythm. The reason: it painted the solver's **final
result** in waves ordered by distance from the first click. That's a geometric
sweep, not a solve.

The fix was to make the solvers **record an ordered move log** as they reason —
each `reveal` logs the *clicked* cell (the cascade it triggers is a side effect,
the one move a human would make), each `markMine` logs a flag — and replay that
log. A clicked zero cascades a whole opening as a single event (the satisfying
"explosion"); a clicked number reveals just itself; flags appear as mines are
deduced, frontier-outward, in deduction order. Recording is opt-in
(`createKnowledge(board, table, track)`) so the generator's hot loop, which runs
the solver hundreds of times per field, pays nothing.

The equivalence that made this safe to ship: **replaying `report.actions` with
real click-cascades reproduces the solver's exact safe/mine sets, and never
clicks a mine** — verified **144/144** (3 difficulties × 8 boards × 6 engines).
Under `prefers-reduced-motion` the whole log is applied at once (no animation),
so the accessibility path and the visual path share the same source of truth.

> **To animate an algorithm "playing," replay its *decisions*, not its result.
> The result is a set; a performance is a sequence.**

---

## 7. Verification (this is research, so it's measured)

Throughout the build, claims were checked with throwaway harnesses
(esbuild-bundled, run under Node, then deleted). The facts that held:

| Claim | Result |
|---|---|
| Generator produces first-click-safe, no-guess fields | Beginner/Intermediate **100%**; Expert ~100% within budget, worst ~5–8 ms |
| Seeded generation is reproducible | identical mine sets for identical `seed` |
| Every solver is **sound** (never reveals a mine / flags a safe cell) | **0** violations across all boards/engines |
| A genuine 50/50 is *not* falsely "solved" | 2×2 / 1-mine corner → all engines report `stuck`; Probabilistic gives ⅓ each + a best guess |
| Two independent complete methods agree | Backtracking ↔ SAT: **40/40** on random boards |
| Exact probabilities are consistent | Σ(probabilities) == remaining mines: **40/40** |
| Move-log replay == solve | **144/144** (and 0 mine-clicks) |
| Subset is needed for budget-completeness | no-subset 8/10 Expert → with subset **10/10** |

---

## 8. Tips for human players (straight from the solver logic)

Because this field is **guaranteed no-guess**, the single most important rule is:
*if you're stuck, you've missed a deduction — there is always a logical move.*
The engines above are exactly the ladder of techniques to climb:

1. **Start anywhere; the first click is always safe and opens a region.** Work
   outward from the opening's numbered border.
2. **Count first (Single-Point).** A number whose flags already equal it → every
   other neighbour is safe (sweep them). A number whose hidden neighbours equal
   its remaining count → they're all mines.
3. **Then compare neighbours (subset / 1-2-1).** Two adjacent clues over
   overlapping cells pin the difference. The textbook shape: a `1 2 1` along a
   wall means *mine–safe–mine* under it; `1 2 2 1` means *mine–safe–safe–mine*.
   Learn these patterns and most boards fall without arithmetic.
4. **Flags are optional; chording is the speedup.** You never *need* to flag —
   flags are just memory. Once a number's mines are flagged, **chord** it
   (click the number) to clear all its other neighbours at once. This is how the
   board clears fast, and it mirrors the count rule.
5. **Use the mine counter in the endgame (global count).** When few cells
   remain, "mines left = total − flags" is a constraint in its own right: if all
   remaining mines must sit on the frontier, every other hidden cell is safe —
   and vice versa. This is the deduction the endgame pass and the Probabilistic
   engine make.
6. **When you genuinely must guess (in *real* Minesweeper, not here): take the
   lowest-probability cell, and prefer opening into the largest unconstrained
   region** — a corner or an edge far from clues is often safest, and opening a
   big empty area gives the most new information. The "show odds" overlay in this
   experiment is the Probabilistic engine doing this for you.

---

## 9. Fidelity scorecard

| Aspect | Status |
|---|---|
| First-click safety (mines placed after first click) | ✅ canonical modern-Minesweeper |
| No-guess guarantee via generate-and-test | ✅ the standard approach |
| Count rules / subset elimination / 1-2-1 patterns | ✅ canonical |
| Component (frontier) enumeration — the "tank" solver | ✅ canonical |
| Exact probabilities under the global mine budget | ✅ canonical (BigInt-exact) |
| SAT/CSP forced-cell proof | ✅ a faithful DPLL on cardinality constraints |
| Linear-algebra (Gaussian) deduction | ✅* a real technique, deliberately left incomplete |
| 3BV board-complexity metric | ✅ Bechtel's standard definition |
| Difficulty *targeting* (generate a board of tier X) | ❌ not implemented — we *rate*, we don't *target* (§2.5, §11) |

`✅*` = a genuine method included for the comparison, not the complete reasoner.

---

## 10. Where this is *not* "real" Minesweeper (scope boundary)

- **No timer / score / high-score / 3BV-per-second.** The HUD tracks mines-left
  and status; player efficiency isn't recorded. The 3BV shown is the *board's*
  complexity, not the player's clicks.
- **No difficulty *selector*.** You set dimensions + mine count (which drive
  density and thus the rating); you can't ask for "a Hard board" and have it
  regenerate to hit that tier.
- **Enumeration is capped** (`ENUM_LIMIT = 22`, `ENUM_NODE_CAP = 60000`). A
  pathological component beyond the cap makes the complete engines
  conservatively bail rather than freeze — so "complete" means "complete within
  budget," which is why the generator also caps density at 0.28.
- **The AI solver plays from the safe origin, not your current position.**
  "Solve" replays a full game from the first click; it's a demonstration of the
  engine, not a mid-game assistant that continues *your* board.
- **Single board, single solver at a time.** The registry is built for a
  side-by-side comparison view, but that view is still planned.

---

## 11. Further real-world context

- **No-guess generators in the wild.** This is exactly how community no-guess
  Minesweeper (e.g. `mwgenerator`, Simon Tatham's *Mines*, and most "no-flagging
  / no-guessing" mods) work: random placement + a logic solver as acceptance
  test, with local repair to make harder densities tractable. We rediscovered
  the same shape independently (§0).
- **The "tank" solver** is the community name for frontier-component enumeration
  with a global-count endgame (our Backtracking engine) — long the standard
  complete Minesweeper reasoner.
- **Minesweeper is NP-complete.** Kaye (2000) showed the *consistency* problem
  (is there any mine arrangement consistent with these numbers?) is NP-complete,
  which is why the complete engines are exponential in the worst case and why the
  cap exists. Most *real* boards have small components, so it's fine in practice.
- **CSP / SAT framing** is not a toy: Minesweeper is a standard pedagogical CSP,
  and our SAT engine is a miniature of how real solvers prove unsatisfiability to
  certify forced moves. Exact probability under a global count is the same
  inclusion-style counting used in constrained combinatorics.
- **Difficulty by hardest-technique** (§2.5) mirrors how Sudoku and other
  logic-puzzle generators rate puzzles — not by how full the grid is, but by the
  most advanced deduction the solution path forces.

---

*Maintained alongside the code. If the generation strategy or budget constants
change, update §2 and §7; if a solver's technique or completeness changes, update
its §3 entry, §4, and the §9 scorecard; if the probability model changes, update
§5.*
