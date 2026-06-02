# Experiment: Chess

**Status:** 🟢 live · **Tags:** algorithms, AI, game
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/chess

A full chess engine with a **minimax + alpha-beta** search. Play Human vs Human,
Human vs AI, or watch AI vs AI — with selectable AI skill levels.

## What it is

- **Negamax alpha-beta** search with **quiescence** (captures/en-passant),
  **piece-square tables**, and standard move ordering.
- **Modes:** Human vs Human, Human vs AI, AI vs AI.
- **Skill levels** from Beginner (1-ply, blunders freely) to Master (full engine,
  deepest search).
- Move history with grades, promotion picker, check/draw/mate detection.

## Deep dives

- 🛠 **[docs/chess/IMPROVEMENT.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/chess/IMPROVEMENT.md)**
  — the engine-strength roadmap: what the engine already does and the planned
  upgrades (transposition tables, null-move pruning, LMR, king safety, aspiration
  windows, …), with references to the Chess Programming Wiki.
- 🔧 **[docs/chess/ISSUES.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/chess/ISSUES.md)**
  — known issues and fixes (e.g. failing to convert overwhelmingly won endgames
  into mate).

## Code

- AI / search: [`src/experiments/chess/ai/`](https://github.com/baoloc7401/archive-of-experiments/tree/main/src/experiments/chess/ai)
- Engine: [`src/experiments/chess/engine.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/chess/engine.ts)

See also: [[Documentation Conventions]] · [[Experiments]]
