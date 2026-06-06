# Experiment: Minesweeper

**Status:** 🟢 live · **Tags:** algorithms, game, fun
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/minesweeper

A Minesweeper whose star is the **minefield generator**: every field is
**first-click-safe** and **guaranteed solvable by pure logic - no guessing,
ever**. Behind it sits a suite of **seven solver engines**, from a naive count-
rules baseline to a complete CSP/SAT prover and an exact mine-probability
calculator - and you can watch any of them play the board like a person.

## What it is

- **Play it** - click to reveal (the first click is always safe and opens a
  region), right-click or long-press to flag, click a number to chord. Because
  the field is no-guess, if you're stuck there is *always* a logical move.
- **Inspect the generator** - forge a field and read the **Generation report**:
  a no-guess verdict, a logic-difficulty rating (trivial → brutal) derived from
  the hardest technique the proof needed, 3BV, density, attempts/repairs, and a
  reproducible seed.
- **Watch an engine solve** - pick **Single-Point**, **Single-Point +
  Backtracking**, **Constraint Propagation**, **Linear Algebra**, **Backtracking**,
  **SAT / CSP**, or **Probabilistic**, and watch it replay the solve move-by-move
  (real clicks + cascades, in deduction order). The Probabilistic engine can
  overlay exact mine odds and highlight the safest guess.
- **Tune it** - dimensions, mine count, first-click-safety radius, and seed.

## Try this

- Run **Single-Point** on an Intermediate board - watch it clear the easy
  interior then **stall** (~60 cells undecided), because it can't reason across
  two clues.
- Run **Single-Point + Backtracking** on the *same* board - it sails through;
  the result readout shows how lopsided the split is (lots of `count`, a little
  `subset`, usually a single `enumerate`).
- Forge an Expert field and note it solves in **single-digit milliseconds**
  despite the no-guess guarantee.
- Turn on **show odds** after a Probabilistic solve gets genuinely stuck (on a
  hand-built 50/50) - every cell reads its exact mine probability.

## Key findings (the short version)

- **A no-guess field can't be *built*, only *found*.** Generation is
  generate-and-test: place mines at random, ask a complete solver "could a
  perfect player clear this with no guess?", and repair/retry until yes. **The
  generator's power is exactly the solver's power.**
- **Single-mine hill-climb repair makes Expert instant** - it edits the specific
  ambiguous frontier instead of re-rolling the whole board.
- **Subset elimination is a *tractability* step, not just a deduction:** it
  shrinks border components below the `ENUM_LIMIT = 22` enumeration cap, which is
  what keeps the complete search inside budget (no-subset solved 8/10 Expert;
  with subset, 10/10).
- **To animate a solver "playing," replay its *decisions*, not its result** -
  record the move log (clicks + cascades, in deduction order) and replay it;
  verified to reproduce the solve exactly, 144/144.
- **Exact mine probability is global**, not local: enumerate each border
  component and combine them under the global mine budget via a BigInt
  generating-function convolution (Σ probabilities == remaining mines, 40/40).

## Deep dive

📖 **[docs/minesweeper/TEXTBOOK.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/minesweeper/TEXTBOOK.md)**
- the full research record: the two-problem model, the no-guess generator
(generate-and-test + hill-climb repair, first-click safety, difficulty rating),
all seven solver engines with their fidelity and completeness, the `ENUM_LIMIT`
finding, exact probability under the global budget, the move-log replay, the
verification harness results, **tips for human players**, the fidelity scorecard,
and the scope boundary.

## Code

- No-guess forge: [`src/experiments/minesweeper/generator.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/minesweeper/generator.ts)
- Shared solver substrate + `fullPropagate`: [`src/experiments/minesweeper/solvers/core.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/minesweeper/solvers/core.ts)
- Engine registry: [`src/experiments/minesweeper/solvers/index.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/minesweeper/solvers/index.ts)
- Game state + solver playback: [`src/experiments/minesweeper/useMinesweeper.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/minesweeper/useMinesweeper.ts)

See also: [[Documentation Conventions]] · [[Experiments]]
