# Pathfinding - Textbook & Real-World Research

Reference code:
[`algorithms/bfs.ts`](../../src/experiments/pathfinding/algorithms/bfs.ts),
[`algorithms/dfs.ts`](../../src/experiments/pathfinding/algorithms/dfs.ts),
[`algorithms/dijkstra.ts`](../../src/experiments/pathfinding/algorithms/dijkstra.ts),
[`algorithms/astar.ts`](../../src/experiments/pathfinding/algorithms/astar.ts),
[`algorithms/greedy.ts`](../../src/experiments/pathfinding/algorithms/greedy.ts),
[`algorithms/bidirectional-bfs.ts`](../../src/experiments/pathfinding/algorithms/bidirectional-bfs.ts),
[`algorithms/jps.ts`](../../src/experiments/pathfinding/algorithms/jps.ts),
[`maze.ts`](../../src/experiments/pathfinding/maze.ts),
[`constants.ts`](../../src/experiments/pathfinding/constants.ts),
[`types.ts`](../../src/experiments/pathfinding/types.ts).

This is the research record for the pathfinding experiment: seven graph-search
algorithms running side-by-side on an interactive maze grid with optional weighted
terrain. It covers the canonical definitions, how faithfully each algorithm is
modelled, and - the real point - **what was discovered building and debugging the
visualizations.** The deepest lesson came from porting Jump Point Search from
8-directional to 4-directional movement. Findings accumulated while building and
debugging.

---

## 0. The single most important finding

> **Jump Point Search was designed for 8-directional grids. On a 4-directional
> grid it silently reports "no path" for any maze where the goal is diagonally
> offset from every axis-aligned scan line - including a completely wall-free grid.**

In 8-directional JPS, diagonal steps naturally sweep both axes at once: a
diagonal scan "reaches" every cell. In 4-directional JPS there are no diagonal
moves, so a vertical scan only ever visits one column. On a wall-free grid,
forced neighbors never appear (they require a wall to block the pruned path).
The scan hits the grid boundary, returns `null`, and JPS concludes no path
exists - even with start at `(0,0)` and end at `(rows-1, cols-1)` and not a
single wall.

The fix is two-part:

1. **Cross-scan in the vertical `jump` function.** At each step of a vertical
   scan, call `jump` horizontally in both directions. If either finds a jump
   point, the current cell is a jump point too. This makes vertical scans
   "aware" of the full grid. Horizontal scans must *not* reciprocate (that
   would cause infinite mutual recursion); the asymmetry is intentional.

2. **Always try horizontal in `successors` after a vertical arrival.** The
   original code only probed horizontal directions from a vertically-reached
   jump point when a wall forced it. But a cross-scan–identified jump point has
   no wall - without the unconditional horizontal probe, the algorithm finds the
   jump point and then never follows up on why it was interesting.

Neither fix alone is sufficient. Both are in [`algorithms/jps.ts`](../../src/experiments/pathfinding/algorithms/jps.ts)
lines 61–65 and 103–108.

---

## 1. Grid model and shared terminology

All seven algorithms operate on the same `GridConfig`:

```
GridConfig {
  rows, cols          – grid dimensions
  cells[][]           – CellState per cell
  start, end          – [row, col] coordinates
  terrainWeights?     – Partial<Record<TerrainType, number>> (optional overrides)
}
```

`CellState` is one of: `plain | grass | sand | water | mountain | wall | start | end`.

**Traversal cost** per cell type (defaults; overridable by `terrainWeights`):

| Terrain | Default weight |
|---------|---------------|
| plain   | 1 |
| grass   | 2 |
| sand    | 3 |
| water   | 5 |
| mountain | 10 |
| wall    | ∞ (impassable) |

Movement is **4-directional** (up / down / left / right) throughout. No
diagonal movement.

Each algorithm is a TypeScript generator (`function*`) that yields an `AlgoState`
snapshot - `{ visited, frontier, current, path, status, steps, pathCost }` -
after every logical step. The visualizer ticks through these snapshots on an
interval; speed and steps-per-tick are slider-controlled at runtime.

---

## 2. The seven algorithms

### 2.1 Breadth-First Search (BFS)

**Definition.** Explores nodes level-by-level via a FIFO queue. Guarantees the
shortest path in an unweighted graph (fewest edges / hops).

**Character.** Expands outward uniformly in all directions - on an open grid it
looks like a growing diamond. On wall-heavy mazes, the "diamond" conforms to
the corridor structure.

**Our implementation.** Textbook BFS. Queue-based, `parent` map for path
reconstruction, `visited` set for de-duplication.
[`bfs.ts`](../../src/experiments/pathfinding/algorithms/bfs.ts)

**Fidelity.** ✅ Exact. `pathCost` reports hop count (= path length − 1), which
equals the weighted cost only on uniform-cost grids.

---

### 2.2 Depth-First Search (DFS)

**Definition.** Explores via a LIFO stack (last in, first out). No optimality
guarantee - commits deeply to the first branch found, backtracks only when
stuck.

**Character.** Produces winding, maze-hugging paths on maze grids. On open
grids, path quality is essentially random, dictated by the order DIRS are tried
(`[-1,0], [1,0], [0,-1], [0,1]`).

**Our implementation.** Iterative DFS (explicit stack, not recursive). `parent`
is recorded only the *first* time a node is discovered, so the reconstructed
path traces back along the first route taken - not the last. This matches the
standard DFS contract (first-found path) without the risk of stack overflow on
large grids.
[`dfs.ts`](../../src/experiments/pathfinding/algorithms/dfs.ts)

**Fidelity.** ✅ Correct DFS semantics. The "frontier" visualization shows the
current stack contents, which can look confusingly large since DFS re-pushes
cells before de-duplicating on pop.

---

### 2.3 Dijkstra's Algorithm

**Definition.** Priority queue ordered by cumulative cost g(n). Expands the
lowest-cost unvisited node. Guarantees the minimum-cost path on non-negative
edge weights.

**Character.** On a uniform-cost grid, Dijkstra and BFS are identical in
behavior. The difference becomes visible with weighted terrain: Dijkstra's
search expands "cheaply" into open plains before reluctantly crossing expensive
mountains, producing non-diamond expansion shapes.

**Our implementation.** Min-heap priority queue (`heap.ts`), lazy-deletion for
stale entries (`if (visited.has(cur)) continue`). Reads terrain cost from
`cellWeight(cell, grid.terrainWeights)` - respects custom per-session weights.
[`dijkstra.ts`](../../src/experiments/pathfinding/algorithms/dijkstra.ts)

**Fidelity.** ✅ Exact.

---

### 2.4 A* Search

**Definition.** Priority queue ordered by f(n) = g(n) + h(n), where g(n) is
the actual cost from the start and h(n) is an admissible heuristic estimating
the cost to the goal.

**Admissibility.** On a 4-directional grid, Manhattan distance is a perfect
admissible heuristic: it never overestimates (the true cost is always ≥ the
Manhattan distance when all weights ≥ 1). It is also *consistent* (satisfies
the triangle inequality), which means the first time A* expands a node, it has
the optimal cost - no re-expansion is needed.

```
h(r, c) = |r − end.r| + |c − end.c|
```

**Character.** On uniform-cost grids, A* typically explores a narrow "banana"
shape pointing toward the goal rather than BFS's full diamond. On weighted
grids, it must sometimes explore wider to account for expensive terrain between
it and the goal.

**Our implementation.** Identical structure to Dijkstra, with the priority
function changed from `g` to `g + h`.
[`astar.ts`](../../src/experiments/pathfinding/algorithms/astar.ts)

**Fidelity.** ✅ Exact, including terrain weights.

---

### 2.5 Greedy Best-First Search

**Definition.** Priority queue ordered by h(n) alone - the heuristic estimate
to the goal, ignoring actual path cost entirely. Not optimal; can be tricked by
walls into long detours.

**Character.** Visually the most dramatic: it charges straight for the goal and
only backtracks when hitting a wall. On open grids it looks almost psychic.
On maze grids with a convoluted path it can explore surprisingly many nodes
before finding the (non-optimal) route.

**Our implementation.** Uses the same Manhattan heuristic as A\*. Tracks actual
path cost in `gCost` for the `pathCost` stat, but that value does not influence
the search - it is for display only.
[`greedy.ts`](../../src/experiments/pathfinding/algorithms/greedy.ts)

**Fidelity.** ✅ Exact greedy semantics. `pathCost` is informational; the path
is not cost-optimal.

---

### 2.6 Bidirectional BFS

**Definition.** Runs two simultaneous BFS sweeps - one forward from start, one
backward from end - alternating one expansion each. Terminates when the two
frontiers meet. Explores roughly O(b^(d/2)) nodes versus O(b^d) for
unidirectional BFS on a branching-factor-b tree.

**Meeting condition.** A meeting is detected when a node being added to one
frontier is already in the *other frontier or visited set*: `otherVisited.has(nk) || nk in otherParent`.
Using `otherVisited` alone misses nodes that are queued by the other sweep but
not yet dequeued (they are in `otherParent` but not `otherVisited`).

**Path reconstruction.** The forward half traces `start → meetKey` via
`fParent`; the backward half traces `meetKey → end` via `bParent` (skipping
`meetKey` to avoid duplication). The two halves are concatenated.

**Character.** On large open grids the b^(d/2) advantage is clearly visible -
the two growing diamonds are significantly smaller than a single BFS diamond.
On tight maze corridors the advantage narrows because branching factor is low.

**Our implementation.**
[`bidirectional-bfs.ts`](../../src/experiments/pathfinding/algorithms/bidirectional-bfs.ts).
The visualization shows the forward frontier in cyan and the backward frontier
in yellow. The `AlgoState.frontierB` field exists only for bidirectional BFS;
all other algorithms leave it `undefined`.

**Fidelity.** ✅ Correct shortest-path guarantee. The implementation uses
per-level alternation rather than a shared priority queue (acceptable for
unweighted grids). A weighted bidirectional variant would require symmetric
stopping criteria (Pohl's condition or the Kaindl-Kainz criterion) - not
implemented.

---

### 2.7 Jump Point Search (JPS)

**Definition.** Accelerates A\* on uniform-cost grids by identifying "jump
points" - the only nodes worth placing on the open list. Between jump points,
the search "jumps" over provably symmetric paths without examining each cell.
First described by Harabor & Grastien (2011) for 8-directional grids.

**Forced neighbor.** A neighbor n of x is *forced* if:
- n is not a *natural* neighbor of x (i.e., it could be reached from x's parent
  without going through x at the same or lower cost)
- AND there is a wall that makes the detour-free path impossible.

On a 4-directional grid moving horizontally (direction dc): a cell directly
above or below x is forced if the cell *behind-above* (or *behind-below*) is
a wall - meaning the parent's "free" path to that neighbor is blocked.

**The 4-directional adaptation problem.** The original JPS is for 8-directional
movement. In 4-directional movement there are no diagonal steps, so:

- A vertical scan only visits one column. The goal at `(rows-1, cols-1)` is
  invisible to a vertical scan starting at column 0 unless a wall creates a
  forced neighbor on that column.
- On a wall-free grid, no forced neighbors ever arise. Every scan terminates
  without a jump point. JPS concludes "no path" even though the grid is
  completely open.

**Our fix (added May 2026):**

1. **Cross-scan in the vertical `jump` loop** - at each step, call
   `jump(r, c+1, 0, 1)` and `jump(r, c-1, 0, -1)`. If either returns a jump
   point, the current position is itself a jump point. Horizontal scans do not
   call vertical scans in return (prevents infinite recursion).

2. **Unconditional horizontal probing in `successors` for vertical arrivals** -
   the original code only branched horizontally when a forced wall was detected.
   Replaced with always trying both `jump(r, c-1, 0, -1)` and
   `jump(r, c+1, 0, 1)`.

**Weight limitation.** JPS uses the Manhattan distance between consecutive jump
points as the edge cost. This is correct only when all traversal costs are
uniform (= 1). On weighted terrain the jump "hops over" expensive cells without
paying their cost - the path found is geometrically short but **not
cost-optimal**. A warning icon in the AlgoPanel header (`⚠`) signals this when
weighted terrain is present.

**Path visualization.** `reconstructPath` returns only the sparse list of jump
points. Without expansion, the visualization shows disconnected dots. Each
straight segment between consecutive jump points is expanded cell-by-cell using
the direction vector `[Math.sign(dr), Math.sign(dc)]`.
[`jps.ts` lines 122–138](../../src/experiments/pathfinding/algorithms/jps.ts)

**Our implementation.**
[`jps.ts`](../../src/experiments/pathfinding/algorithms/jps.ts).

**Fidelity.** ✅* on uniform grids (correct and optimal). ⚠ on weighted grids
(finds a path, not necessarily the cheapest one).

---

## 3. Weighted terrain and heuristic admissibility

### 3.1 Custom weights at runtime

Weights are no longer a static constant. The `GridConfig.terrainWeights` field
carries a `Partial<Record<TerrainType, number>>` that overrides the defaults for
the current session. Weighted algorithms (`dijkstra`, `astar`, `greedy`) call:

```typescript
cellWeight(cell, grid.terrainWeights)
// → grid.terrainWeights?.[cell] ?? CELL_WEIGHT[cell] ?? 1
```

This means a user can set mountain cost to 2 and water cost to 20 mid-session,
and the next run uses those values without restarting anything. The weights are
embedded in `GridConfig` at generation time (`generateMaze`) and synced
whenever options change (`handleOptionsChange` in `index.tsx`).

### 3.2 Admissibility with custom weights

The Manhattan heuristic `h = |Δr| + |Δc|` remains admissible as long as every
terrain weight ≥ 1. The UI slider is clamped to `[1, 20]`, so this invariant
cannot be violated through normal use. If a user somehow set a weight below 1,
A* would become inadmissible and might miss the optimal path.

### 3.3 Observations on weighted mazes

On a maze with the default weights (grass ×2, sand ×3, water ×5, mountain ×10):

- **Dijkstra and A\*** route clearly around mountain clusters even when the
  geometrically shorter path passes through them.
- **BFS and Bidirectional BFS** ignore weights and find the hop-shortest path,
  which can be dramatically more expensive than Dijkstra's path on mountain-heavy
  terrain.
- **Greedy** is fast but frequently finds a costly path - it sees the goal's
  direction, not the terrain between them.
- **JPS** finds the geometrically-short path and reports a cost equal to the
  hop count, not the weighted cost. The ranking section reports this cost - it
  looks implausibly low compared to Dijkstra on weighted grids.

---

## 4. Real findings from building the visualization

### 4.1 JPS "no path" on open grids (the §0 finding)

Described in full above. The root cause was discovered by testing on a
completely wall-free grid: all other algorithms found a path instantly; JPS
returned "no path." This exposed a fundamental gap in the 4-directional
adaptation: the `jump` function had no mechanism to "see" across columns during
a vertical scan.

### 4.2 JPS path rendered as disconnected dots

After fixing the no-path bug, the next observation was that JPS displayed a
handful of disconnected bright cells rather than a continuous path. `reconstructPath`
traces the `parent` chain, which for JPS contains only the jump-point waypoints
- not the cells between them. The fix (interpolation between consecutive
waypoints) is straightforward but non-obvious: it requires knowing that JPS
guarantees axis-aligned straight-line movement between any two consecutive jump
points, so the intermediate cells are exactly `r1 + k*dr, c1 + k*dc` for
integer k.

### 4.3 Path overlay contrast on colorful terrain

The first attempt at a path color used a generic highlight. On the dark theme,
the chosen color was nearly identical to the wall color (`#dde2f8` near-white
wall vs. a near-white path highlight). On the light theme the same values
matched the dark-navy wall. The solution: use `var(--accent)` (the same cyan
used for the start cell) at full brightness. It is distinct from every terrain
color, from the visited overlay (purple), from the frontier overlay (diluted
cyan), and from the wall color in both themes.

### 4.4 CSS stacking and the JPS warning tooltip

The weight-warning tooltip (a CSS `::after` pseudo-element triggered by `:hover`)
was initially invisible: the panel had `overflow: hidden`, clipping anything
that extended above its top edge. Changing the tooltip to drop *below* the icon
fixed the clip issue - but then the tooltip was painted over by sibling panels
in DOM order. Final fix: `isolation: isolate` on `.pf-panel` (creates a stacking
context without clipping) plus `:has(.pf-panel-warn-icon:hover) { z-index: 10 }`
to lift the active panel above its siblings.

### 4.5 Scroll layout: the flex-collapse trap

The experiment originally used `height: 100vh; overflow: hidden` on the page
shell with `flex: 1; min-height: 0` throughout - a common "fill the viewport"
pattern. When the options panel was expanded and the terrain editor was added,
the grid-scroll container simply *collapsed* (its `min-height: 0` allowed
flex to shrink it to nothing), making the footer inaccessible. The underlying
problem: a `flex: 1; min-height: 0` child always absorbs exactly the remaining
space, so the total content never exceeds the container and `overflow-y: auto`
never triggers. Resolution: unlock the page (`min-height: 100vh` instead of
`height: 100vh`) with a sticky topbar, and remove the flex-collapse tricks.
The page now scrolls naturally.

### 4.6 Bidirectional BFS meeting condition

An early version used `otherVisited.has(nk)` as the sole meeting test. This
missed meetings where the other sweep had queued but not yet dequeued the
meeting node (`nk in otherParent` but not yet in `otherVisited`). The fix adds
`|| nk in otherParent` to the condition.

### 4.7 Generator step count vs. "explored" node count

`steps` counts how many times the outer `while` loop body executes - one per
node dequeued. `visited.size` counts unique nodes expanded. On Dijkstra with a
lazy-deletion heap, a single node can be *enqueued* multiple times (each time a
shorter path is found) but *dequeued and skipped* on subsequent pops. The `steps`
counter therefore counts dequeues including stale skips; `visited.size` counts
only genuine expansions. The ranking section surfaces `visited.size` under
"explored" and `steps` under "steps" - they can differ noticeably on
weighted mazes where many cells are re-queued.

---

## 5. Maze generation

The maze builder uses an **iterative recursive backtracker** (Wilson's-style
DFS on a room graph):

1. Place rooms at even grid positions `(2i, 2j)`. Odd positions are initially
   walls.
2. Push `(0,0)` onto a stack. Mark visited.
3. While the stack is non-empty: pick a random unvisited neighbor of the top
   room; carve the wall between them; push the neighbor.
4. After the spanning tree, randomly open a fraction of "loop-eligible" walls
   (walls with ≥ 2 open orthogonal neighbors) - the fraction is controlled by
   the `routeDensity` option (`sparse` = 4%, `moderate` = 20%, `dense` = 45%).
5. If `minPathLength > 0`, iteratively wall off random middle path cells until
   the BFS-shortest path is at least `minPathLength` cells long (capped at 80
   attempts).
6. If `weighted = true`, assign terrain to plain cells using a distribution
   weighted toward plains (`plain × 4`, each enabled terrain `× 2`).

The `start` is always `(0,0)` and `end` is always `((roomRows-1)*2, (roomCols-1)*2)` -
the opposite corner of the room grid.

---

## 6. Fidelity scorecard

| Feature | Fidelity | Notes |
|---------|----------|-------|
| BFS | ✅ | Exact |
| DFS | ✅ | Iterative; first-discovered path |
| Dijkstra | ✅ | Lazy-deletion heap; custom weights |
| A* (Manhattan heuristic) | ✅ | Admissible and consistent on 4-dir grids |
| Greedy Best-First | ✅ | h-only priority; g tracked for display |
| Bidirectional BFS | ✅* | Unweighted only; per-level alternation |
| JPS (uniform) | ✅* | 4-dir cross-scan adaptation; see §0 and §4.1–4.2 |
| JPS (weighted) | ⚠ | Finds a path; cost is hop-count, not terrain cost |
| Terrain weights | ✅ | Per-session overrides; embedded in GridConfig |
| Heuristic admissibility | ✅ | Maintained; slider clamped to weight ≥ 1 |

---

## 7. Where this is *not* a real pathfinder

- **No real-time replanning.** Algorithms run once to completion on a static
  grid. Dynamic replanning (D*, D* Lite, LPA*) and moving-obstacle avoidance
  are not modelled.
- **No tie-breaking.** A* with identical f-values expands in insertion order -
  this can produce suboptimal *looking* searches even when the final path is
  optimal. Production A* implementations use secondary tie-breaking on h(n).
- **No diagonal movement.** All seven algorithms use 4-directional movement.
  JPS in the original paper targets 8-directional grids; our 4-directional
  adaptation deviates from the paper.
- **Single goal.** No multi-target search (closest-node Dijkstra, multi-source
  BFS, etc.).
- **Small grids only.** Maximum grid is 35 × 51 = 1785 cells. Real-world map
  data involves millions of nodes; techniques like hierarchical A*, contraction
  hierarchies, and transit routing are not included.
- **Visualization overhead.** Each generator copies the `visited` and `frontier`
  sets on every yield (`new Set(visited)`). This is O(n) per step and would
  be unacceptable on large graphs; it exists only to give the renderer
  immutable snapshots.

---

## 8. Further real-world context

**BFS / Dijkstra** underpin most production routing engines at the lowest level.
GPS navigation, game pathfinding, and network routing all have Dijkstra variants
at their core - often augmented with pre-processing (ALT, contraction
hierarchies) to scale to road-network sizes.

**A\*** is the dominant algorithm in game AI. Nearly every commercial game
pathfinder from the 1990s onward is some variant of A\*. The choice of heuristic
is game-specific: Euclidean distance for continuous space, Manhattan for
grid-locked movement, octile distance for 8-directional grids.

**Bidirectional BFS** is used in social-network shortest-path queries (e.g., LinkedIn's
"degrees of separation") where the branching factor makes unidirectional BFS
impractical. The weighted bidirectional extension requires careful stopping
criteria (the Kaindl-Kainz condition) to remain optimal.

**Jump Point Search** is widely used in game pathfinding where the map is a
uniform-cost grid (common in RTS and tile-based games). The Harabor & Grastien
2011 paper is one of the most-cited pathfinding papers of the 2010s. JPS+ and
Bounded JPS are later refinements. On non-uniform grids, A* or Dijkstra remain
superior.

**Greedy Best-First** is rarely used as a final planner but is common as a
*probe* in anytime algorithms or as the first pass in bidirectional search
setups. Its speed advantage on obstacle-free paths makes it useful for
pre-screening.

---

*Maintained alongside the code. If the algorithm set changes (new algorithms
added, movement model changed from 4-directional), update §2 and the fidelity
scorecard. If terrain weight ranges change, re-check the admissibility note in
§3.2. If the grid model changes, re-check §1 and the maze generation description
in §5.*
