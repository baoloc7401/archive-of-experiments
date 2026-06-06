# Experiment: Elevator Scheduling

**Status:** 🟢 live · **Tags:** algorithms, simulation, visualization
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/elevator

Six classic **disk-scheduling** algorithms - FCFS, SSTF, SCAN, LOOK, C-SCAN,
C-LOOK - taught on an elevator metaphor and animated as cars riding a building.
Make hall calls and in-car calls, then watch a car serve them; or race several
algorithms on the *same* calls in compare mode.

## The algorithms

| Algorithm | One-liner |
|---|---|
| **FCFS** | first-come, first-served - fair but zig-zags wildly |
| **SSTF** | nearest pending request - fast, but can starve distant floors |
| **SCAN** | sweep to the wall, then reverse (the "elevator algorithm") |
| **LOOK** | sweep, but turn back at the last request, not the wall |
| **C-SCAN** | up-only; express back to the bottom; fairest waits |
| **C-LOOK** | up-only; express back to the lowest request |

## The headline finding

> These are **disk-scheduling** algorithms. They're taught on an elevator
> metaphor but they are **not** how real elevators are dispatched - a real call
> carries a *direction* (▲/▼) that none of the six model.

In the sim the up/down distinction is therefore cosmetic. That's faithful to the
disk-scheduling definitions and deliberately unfaithful to a real directional
elevator - a conscious scope choice.

## Deep dives

- 📖 **[docs/elevator/TEXTBOOK.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/elevator/TEXTBOOK.md)**
  - canonical definitions, per-algorithm fidelity, the idle-restart problem, the
  circular-return "teleport" modeling, comparison table, fidelity scorecard, and
  where this is *not* a real elevator.
- 🔧 **[docs/elevator/ISSUES.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/elevator/ISSUES.md)**
  - the craft log: bugs hit (e.g. the car "teleporting" between floors), their
  causes, and the fixes to not regress.

## Code

- Algorithms: [`src/experiments/elevator/algorithms.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/elevator/algorithms.ts)
- Simulation: [`src/experiments/elevator/useSimulation.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/elevator/useSimulation.ts)

See also: [[Documentation Conventions]] · [[Experiments]]
