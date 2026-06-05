# Documentation Conventions

The code-adjacent docs live in
[`docs/<experiment>/`](https://github.com/baoloc7401/archive-of-experiments/tree/main/docs)
in the repository. This wiki is the human-facing **portal** that links to them;
the repo docs are the **single source of truth** (so nothing drifts).

## The doc family

| File | Purpose | Audience |
|---|---|---|
| **TEXTBOOK.md** | Research record: the canonical algorithm + how faithfully the code models it + the real findings discovered building/debugging it. The *why it behaves this way* and *where the model parts ways with reality*. | reader who wants to understand |
| **ISSUES.md** | Craft log: specific bugs, their root causes, the fixes, and regressions to avoid. The full debugging narrative. | maintainer touching the code |
| **IMPROVEMENT.md** | Roadmap: what exists and what's planned next (used by the chess engine). | maintainer planning work |

A `TEXTBOOK` **summarizes** a finding and points to `ISSUES` for the gory detail —
they cross-link, they don't duplicate.

## What's written so far

| Experiment | TEXTBOOK | ISSUES | IMPROVEMENT |
|---|---|---|---|
| [[Experiment ACO]] | [✓](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/aco/TEXTBOOK.md) | — | — |
| [[Experiment River Crossing]] | [✓](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/river-crossing/TEXTBOOK.md) | — | — |
| [[Experiment Elevator]] | [✓](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/elevator/TEXTBOOK.md) | [✓](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/elevator/ISSUES.md) | — |
| [[Experiment Chess]] | [✓](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/chess/TEXTBOOK.md) | [✓](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/chess/ISSUES.md) | [✓](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/chess/IMPROVEMENTS.md) |
| [[Experiment Pathfinding]] | [✓](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/pathfinding/TEXTBOOK.md) | — | — |
| [[Experiment Minesweeper]] | [✓](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/minesweeper/TEXTBOOK.md) | — | — |

## The `textbook` skill

The repo ships a Claude Code skill at
[`.claude/skills/textbook/`](https://github.com/baoloc7401/archive-of-experiments/blob/main/.claude/skills/textbook/SKILL.md)
that writes/updates a `TEXTBOOK.md` in the house style — gather ground truth from
the code, find the single most important finding (the `§0` blockquote), blend
canonical definitions with fidelity notes, end with a scorecard and a scope
boundary. Invoke it with `/textbook` or "make a textbook for <experiment>".

## House style (in brief)

- Title: `# <Name> — Textbook & Real-World Research`.
- A `Reference code:` lead block linking the key files.
- **§0 — The single most important finding** as a blockquote. This is the point.
- Honest about every deviation from the textbook, and *why*.
- A **fidelity scorecard** and a **"where this is *not* a real <thing>"** section.
- Footer: `*Maintained alongside the code…*`.

See also: [[Home]] · [[Experiments]]
