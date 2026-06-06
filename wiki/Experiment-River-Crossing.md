# Experiment: River Crossing

**Status:** 🟢 live · **Tags:** algorithms, AI, graphs, game
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/river-crossing

The classic **Missionaries & Cannibals** puzzle, modelled as an explicit
**state-space search**. Ferry everyone across without ever letting cannibals
outnumber missionaries on a bank - play it yourself, or watch BFS / DFS / A\*
solve it (or prove it impossible).

## What it is

A side-view river scene over a real search engine:

- **Play manually** - tap people onto the boat (1–K seats, never empty) and cross.
  An illegal crossing is *allowed* and promptly punished: the outnumbered
  missionaries get a keel-over **death animation** and a hilarious last-words
  speech bubble.
- **Watch the solver** - pick **BFS** (fewest crossings), **DFS** (any solution),
  or **A\*** (admissible heuristic), then *solve & play* or take a *hint step*.
- **Reconfigure the puzzle** - change missionaries, cannibals, and boat seats; the
  same search solves every variant or proves none exists.
- **Search telemetry** - nodes expanded, states discovered, frontier peak, and the
  plan from the current state, all live.
- A **day/night cycle**: the theme toggle animates a sunset/sunrise as the sun and
  moon trade places behind the horizon.

## Try this

- Solve **3M / 3C / boat 2** with BFS - the canonical **11-crossing** answer.
- Set **4M / 4C / boat 2** - the solver proves it **unsolvable** (a common myth
  says it's possible; it isn't until you grow the boat to 3).
- Run the **same instance with DFS vs BFS** and compare crossings + nodes expanded.
- Send 1 missionary with 2 cannibals to a bank - watch the loss animation and a
  random shout (localized EN/VI).

## Key findings (the short version)

- **A search result is a *path*, not a *policy*.** Driving the animation by
  re-solving each step and taking the first move only works for *progress-
  monotonic* paths (BFS, A\*). DFS oscillates forever - the fix is to **commit to
  one snapshotted plan** and follow it.
- **Solvability is a first-class output.** Exhausting the reachable space *proves*
  an instance impossible; no per-variant table is hardcoded - the search is the
  source of truth.
- **A\*'s heuristic `ceil((ml+cl)/K)` is admissible**, so it stays optimal and
  agrees with BFS on length.
- **A stacking-context trap hid the boat behind the banks** until it was lifted
  out of the (positioned, lower-z) water layer.

## Deep dive

📖 **[docs/river-crossing/TEXTBOOK.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/river-crossing/TEXTBOOK.md)**
- the full research record: the state model and validity rules, the three search
algorithms and their fidelity, the path-vs-policy argument behind the DFS loop,
solvability as output, the manual-loss game, the visualization/engineering
findings, the debug-bridge methodology, and the fidelity scorecard.

## Code

- Search engine: [`src/experiments/river-crossing/solver.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/river-crossing/solver.ts)
- Game state + playback: [`src/experiments/river-crossing/useRiverCrossing.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/river-crossing/useRiverCrossing.ts)
- Scene rendering: [`src/experiments/river-crossing/components/RiverScene.tsx`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/river-crossing/components/RiverScene.tsx)

See also: [[Documentation Conventions]] · [[Experiments]]
