# Experiment: Chess

**Status:** 🟢 live · **Tags:** algorithms, AI, game
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/chess

A full chess engine with an **alpha-beta + quiescence** search, a hand-crafted
evaluation, a transposition table, an opening book, and a Web Worker so the UI
stays responsive while it thinks. Play Human vs Human, Human vs AI, or watch
AI vs AI — with five selectable skill tiers from Beginner to Master.

## What it is

- **Alpha-beta** (explicit minimax-style, not negamax) with **PVS**, **LMR**,
  **null-move pruning**, **futility pruning**, **check extensions**, killer +
  history move ordering, and a depth-preferred **transposition table** keyed on
  an incrementally-maintained **Zobrist hash**.
- **Quiescence** extends past the horizon on captures, on check-giving moves,
  and on full evasions when the side to move is in check.
- **Hand-crafted evaluation:** material + piece-square tables + mobility +
  pawn structure (doubled / isolated / passed) + king safety + a mop-up term
  that drives the losing king to a corner for KX-vs-K mating.
- **Opening book** of ~20 mainlines, replayed at module load.
- **Search runs in a Web Worker** so deep play doesn't block the UI; the
  worker keeps its TT hot between moves and is cleared on game reset.
- **Modes:** Human vs Human, Human vs AI, AI vs AI.
- **Skill tiers** (Beginner → Master) dial six independent knobs each: search
  depth, quiescence depth, eval noise, top-N weighted move pick, opening
  book on/off, and per-term eval toggles (mobility / king safety / pawn
  structure / mop-up).
- Move history with grades (`!!` … `??`), promotion picker, check / draw / mate
  detection, animated piece slides.

## Deep dives

- 📚 **[docs/chess/TEXTBOOK.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/chess/TEXTBOOK.md)**
  — the research record: the full search stack and evaluation explained, why
  won endgames used to draw and how the three-layer fix (mate-distance
  encoding, king-restriction term, static-eval tiebreak) works, the
  cross-thread Zobrist hazard and its deterministic-seed fix, and the
  difficulty-scaling design.
- 🛠 **[docs/chess/IMPROVEMENTS.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/chess/IMPROVEMENTS.md)**
  — the engine-strength roadmap: what the engine does today and what's
  planned next (with notes on what was tried and reverted, e.g. aspiration
  windows), referenced against the Chess Programming Wiki.
- 🔧 **[docs/chess/ISSUES.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/chess/ISSUES.md)**
  — known issues and fixes (e.g. failing to convert overwhelmingly won
  endgames into mate, and the layered root causes).

## Code

- AI / search: [`src/experiments/chess/ai/`](https://github.com/baoloc7401/archive-of-experiments/tree/main/src/experiments/chess/ai)
- Engine: [`src/experiments/chess/engine.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/chess/engine.ts)
- Zobrist hashing: [`src/experiments/chess/zobrist.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/chess/zobrist.ts)
- Skill presets: [`src/experiments/chess/ai/skill.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/chess/ai/skill.ts)
- Web Worker: [`src/experiments/chess/ai/worker.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/chess/ai/worker.ts)

See also: [[Documentation Conventions]] · [[Experiments]]
