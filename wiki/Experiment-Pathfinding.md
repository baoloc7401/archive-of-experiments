# Experiment: Pathfinding

**Status:** 🟢 live · **Tags:** algorithms, graphs
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/pathfinding

Classic graph-search algorithms navigating mazes on an interactive grid. Pick
algorithms, build (or generate) a maze with optional weighted terrain, then watch
them search - side by side - and compare who explores least and finds the
shortest path.

## Algorithms

| Algorithm | Class | Optimal? |
|---|---|---|
| **BFS** | unweighted | ✅ shortest (unweighted) |
| **DFS** | unweighted | ❌ |
| **Dijkstra** | weighted | ✅ |
| **A\*** | heuristic (Manhattan) | ✅ |
| **Greedy Best-First** | heuristic | ❌ |
| **Bidirectional BFS** | unweighted | ✅ |
| **Jump Point Search** | heuristic (uniform-cost) | ✅ (ignores terrain weights) |

## Features

- **Maze builder** - paint walls and weighted terrain (grass / sand / water /
  mountain), or generate mazes at sparse / moderate / dense route density.
- **Multi-run comparison** - run several algorithms on the same grid and rank
  them by nodes explored, path length, cost, and steps.
- A live "scan" materialise animation as cells are explored.

## Code

- Algorithms: [`src/experiments/pathfinding/algorithms/`](https://github.com/baoloc7401/archive-of-experiments/tree/main/src/experiments/pathfinding/algorithms)
- Maze generation: [`src/experiments/pathfinding/maze.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/pathfinding/maze.ts)

## Research doc

[`docs/pathfinding/TEXTBOOK.md`](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/pathfinding/TEXTBOOK.md)
covers: canonical definitions for all seven algorithms, the 4-directional JPS
adaptation (and the open-grid "no path" bug it fixed), weighted terrain and
heuristic admissibility, maze generation, and a full fidelity scorecard.

Key findings documented there:
- JPS silently reports "no path" on wall-free grids unless vertical scans
  include a cross-scan for horizontal jump points (§0 and §4.1).
- JPS path renders as disconnected dots without interpolating intermediate
  cells between jump-point waypoints (§4.2).
- The `flex: 1; min-height: 0` flex-collapse trap that prevented page scrolling
  when the options panel expanded (§4.5).

See also: [[Experiments]]
