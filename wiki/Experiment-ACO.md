# Experiment: Ant Colony Optimization

**Status:** 🟢 live · **Tags:** algorithms, AI, simulation, visualization
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/aco

Virtual ants lay pheromone trails to converge on short tours through the
**Traveling Salesman Problem**. No single ant is smart; the short tour is a
property of the *colony* and its evaporating shared memory (stigmergy).

## What it is

A faithful **Ant System** (Dorigo, 1992) with **elitist reinforcement** on the
symmetric Euclidean TSP, rendered on a canvas:

- Green **pheromone web** that sharpens as the colony learns.
- Bright **best-so-far tour** as a closed loop.
- Amber **ants** physically walking their tours each generation, with comet trails.
- A **convergence sparkline** and a `% vs greedy (nearest-neighbour)` gain.

## Try this

- Drag **β (distance)** down to 0 — the colony goes nearly blind and struggles.
- Push **α (pheromone)** up and **ρ (evaporation)** down — watch it lock in early
  on a mediocre loop (premature convergence).
- Toggle **elitist** — faster convergence, but easier to get stuck.
- Use the **trails** slider to reveal or hide the faint pheromone web.
- Click the board to add cities; pick a layout (scatter / ring / clusters / grid).

## Key findings (the short version)

- **Visualization is a contrast problem, not a drawing problem.** Rendering trail
  strength relative to the *max* gives an n² hairball early; the signal is the
  *deviation from uniformity*. The settled approach normalizes each edge
  min→max and shapes it with a user-controlled gamma.
- **Pheromone converges to a bimodal distribution**, which is why an early
  "excess-over-baseline" visibility slider felt inert.
- **A HiDPI canvas with `width:100%` can inflate a `1fr` grid track and grow
  without bound on resize** — fixed by taking canvases out of flow and deferring
  ResizeObserver work to a frame.

## Deep dive

📖 **[docs/aco/TEXTBOOK.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/aco/TEXTBOOK.md)**
— the full research record: the algorithm and equations, implementation choices
(`τ₀ = m/L_nn`, the build/commit split), parameter intuition, the three
rendering attempts, the animation model, the canvas/layout bug, fidelity
scorecard (AS vs ACS vs MMAS), and real-world context.

## Code

- Engine: [`src/experiments/aco/aco.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/aco/aco.ts)
- Rendering + animation: [`src/experiments/aco/components/ColonyCanvas.tsx`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/aco/components/ColonyCanvas.tsx)
- Layouts: [`src/experiments/aco/layouts.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/aco/layouts.ts)

See also: [[Documentation Conventions]] · [[Experiments]]
