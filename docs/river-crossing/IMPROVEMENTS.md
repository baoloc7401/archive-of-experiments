# River Crossing — Improvement Roadmap

Reference: [`solver.ts`](../../src/experiments/river-crossing/solver.ts) (the search engine),
[`useRiverCrossing.ts`](../../src/experiments/river-crossing/useRiverCrossing.ts) (state + playback),
[`narrative/storyEngine.ts`](../../src/experiments/river-crossing/narrative/storyEngine.ts) (story layer),
[`components/RiverScene.tsx`](../../src/experiments/river-crossing/components/RiverScene.tsx) (scene).

See the [TEXTBOOK](TEXTBOOK.md) for the model, the three algorithms, and the
findings this roadmap builds on.

Note: As we move down the implementations, update each entry's PROGRESS as
TODO / Doing / Done.

---

## What the Experiment Already Does

| Feature | Detail |
|---|---|
| State-space model | `(ml, cl, boat)`, right bank derived; `successors()` generates legal-only moves |
| BFS | FIFO queue (array + `head` cursor), mark-on-enqueue; **optimal** (fewest crossings) |
| DFS | LIFO `frontier.pop()`, shared discovery set; any-solution |
| A\* | Linear-scan PQ, `g`-relaxation, admissible `h = ceil((ml+cl)/k)` |
| Greedy / IDDFS / Bidirectional / UCS | added in Tier 2 below — best-first by `h`, iterative deepening, meet-in-the-middle, and weighted Dijkstra |
| Search visualization | `searchSteps()` generator + `SearchGraph` view animate the exploration over the state graph (Tier 1) |
| Search telemetry | `expanded`, `discovered`, `frontierPeak`, `cost` returned from every call |
| Solvability as output | No hardcoded table — search proves impossible instances (e.g. 4/4/2) |
| Committed-plan playback | Snapshots `solution.moves` into `plan`; never re-solves mid-walk (the §0 DFS fix) |
| Manual game | `rawApply` allows an illegal crossing → judged `lost` with a death animation |
| Reconfiguration | `M, C ∈ [1, 5]`, `K ∈ [2, 4]` — bounded for a small, watchable graph |
| Debug bridge | `buildReport()` — paste-ready config, banks, solver plan, replayed move history, event log |
| Narrative layer | `generateStory()` retells the played moves as seeded, deterministic prose with evolving tension/trust |

**The solver is already complete and (for BFS/A\*) optimal** on every in-bounds
instance. Unlike the chess engine, there is no *strength* to chase here — the
improvement axis is **educational depth (seeing the search work), breadth of
algorithms and variants, and the narrative layer**, not solution quality.

---

## Improvements

### Tier 1 — Highest Educational Impact

These make the *search itself* visible, which is the whole point of the
experiment. Today the panel shows the answer and the cost numbers, but the
exploration that produced them is invisible.

---

#### 1. Animate the search (frontier + explored set)

PROGRESS: Done

**Shipped:** `searchSteps()` in [`solver.ts`](../../src/experiments/river-crossing/solver.ts)
is a generator that yields a `SearchStep` after every expansion and *returns* the
`SearchResult`; `solveFrom` now just drains it, so the animated trace and the
answer come from one run and can never disagree. The hook materializes the trace
once per `(cfg, state, algo)`.

**What:** Instead of running `solveFrom` to completion in one call, expose it as
a generator that yields after each node expansion, and let the UI replay those
steps. Tint each of the `(M+1)(C+1)·2` states by its role at each step:
unseen → discovered (in frontier) → expanded (closed).

**Why it matters:** The TEXTBOOK's headline finding — BFS/A\* fan out broadly
while DFS dives — is currently only legible as `frontierPeak` numbers. Watching
the frontier swell for BFS and stay thin for DFS *shows* it.

**Implementation sketch:**
```ts
export function* searchSteps(cfg, from, algo): Generator<SearchStep> {
  // same loop as solveFrom, but `yield { expanded: s, frontier: [...], closed: [...] }`
  // after each pop, instead of only returning at the goal.
}
```
Drive it from the playback timer already in `useRiverCrossing` (reuse `crossMs`
/ `PLAY_GAP` cadence). Keep `solveFrom` as the one-shot path for the plan.

---

#### 2. State-graph view

PROGRESS: Done

**Shipped:** [`SearchGraph.tsx`](../../src/experiments/river-crossing/components/SearchGraph.tsx)
draws the reachable graph (`reachableGraph()` in `solver.ts`) as an SVG node-link
diagram: x = missionaries-left, y = cannibals-left, the two boat sides offset
within each cell. Nodes tint live by role, the solution path lights up at the end,
and an unsolvable instance shows the goal as a detached, unreachable node — the
visual proof of impossibility.

**What:** Draw the reachable state graph (≤ 32 nodes for the default puzzle) as
a small node-link diagram — nodes are `(ml, cl, boat)`, edges are legal
crossings. Overlay the solution path and, with #1, the live frontier.

**Why it matters:** "You can hold the whole graph in your head" (TEXTBOOK §1.4)
is asserted but never drawn. A static graph makes the state space concrete; with
#1 it becomes the canonical search visualization.

**Note:** Layout can be trivial — bucket nodes by `ml + cl` (distance-ish) on
one axis and `boat` side on the other; no force-directed layout needed at this
size.

---

#### 3. Step-through controls for the search

PROGRESS: Done

**Shipped:** The search view has its own ◀ / play-pause / ▶ / ↺ transport over
the materialized trace (step-back is free because the whole trace is in memory),
re-using the existing speed presets via `SEARCH_STEP_MS`. It is separate from the
ferry "solve & play" — one animates the *exploration*, the other the *crossings*.

**What:** With #1 in place, add *step forward / step back* over search steps
(not just over crossings, which `step()` already does for the solution).

**Why it matters:** Lets a learner pause exactly when BFS and DFS diverge on the
same instance. Complements the existing crossing-level `step()`.

---

### Tier 2 — More Algorithms

All share `successors()` and differ only in frontier discipline — cheap to add,
and each contrasts instructively with the existing three. Add to the `SearchAlgo`
union in [`types.ts`](../../src/experiments/river-crossing/types.ts) and the
`ALGOS` table in [`constants.ts`](../../src/experiments/river-crossing/constants.ts).

---

#### 4. Greedy best-first search

PROGRESS: Done

**Shipped:** Added as a `frontierOpts` entry — least-`h` pick, discover-once (no
`g`-relaxation). Returns *a* valid path, often non-optimal, exactly as intended.

**What:** Best-first ordered by `h` alone (drop the `g` term from A\*). Reuse the
existing linear-scan PQ; order by `heuristic(cfg, ns)` instead of `f = g + h`.

**Why it matters:** The cleanest foil to A\*. On this puzzle greedy will often
return a **non-optimal** path while expanding very few nodes — a direct,
side-by-side demonstration of why the `g` term buys optimality.

---

#### 5. Iterative-deepening DFS (IDDFS)

PROGRESS: Done

**Shipped:** `iddfsSteps()` runs depth-limited DFS with a rising limit and
**per-path** cycle detection (not a global visited set), so a shorter route is
never blocked — the first limit that reaches the goal yields a BFS-optimal depth
while only the current path is held in memory. The search view shows the live
depth limit and the path diving and re-diving deeper each iteration.

**What:** Depth-limited DFS in a loop with rising limit, until the goal is found.

**Why it matters:** Gives BFS-optimal crossing counts with DFS's tiny frontier —
the textbook "best of both" result. Pairs naturally with the `frontierPeak`
telemetry to show the memory/optimality trade-off the existing DFS makes.

---

#### 6. Bidirectional BFS

PROGRESS: Done

**Shipped:** `bidirSteps()` grows a forward and a backward frontier, expands the
smaller each round, and stops on the `best ≤ depthF + depthB` cutoff (kept
shortest — verified against BFS across every in-bounds config). The graph is
undirected (any crossing can be rowed back), so the backward search just reuses
`successors`.

**Gotcha found & fixed:** when the goal itself is illegal (C > M, so the right
bank would have cannibals outnumbering missionaries on arrival), edges *out of*
the goal aren't real reverse edges — a naïve backward search falsely connects and
reports the instance solvable. The fix bails out of the backward search when the
goal is invalid. Forward BFS was never affected (it simply never reaches an
illegal goal). This is a concrete instance of the "a search result is a path, not
a policy"-class subtlety the [TEXTBOOK](TEXTBOOK.md) dwells on.

**What:** Search forward from `startState` and backward from the goal `(0,0,R)`
simultaneously; stop when the frontiers meet. Backward moves are just
`successors` applied with the boat-flip reversed.

**Why it matters:** Halves the explored depth — a dramatic drop in `expanded` on
the larger instances, visible immediately in the telemetry.

---

#### 7. Weighted crossings → Dijkstra / meaningful A\*

PROGRESS: Done

**Shipped:** Uniform-Cost Search (`ucs`), edge cost = **people ferried** (`m + c`)
rather than uniform 1, so it minimizes total people carried instead of crossings.
It reuses the shared best-first generator with `relax: true`, `edgeCost`
people-weighted, and `h = 0` (pure Dijkstra). `SearchResult` now carries `cost`;
the solver panel and debug report surface it for UCS. The least-cost path can
differ from the fewest-crossings path — the point of the contrast.

**What:** Let a crossing carry a cost (e.g. crossing time scaling with load, or a
fixed return-trip penalty) instead of uniform 1. Add Uniform-Cost Search
(Dijkstra). The `g`-relaxation in the A\* branch already supports non-unit edge
costs; only the `+1` in `tentative = gs + 1` and the heuristic need updating.

**Why it matters:** TEXTBOOK §9 names this as the boundary where "BFS already
gives the optimum" stops holding and A\*/Dijkstra "earn their keep." It turns the
toy into a genuine shortest-path problem and links conceptually to the
Pathfinding sibling.

**Caveat:** Pick a weighting that keeps `h` admissible (scale the heuristic by the
minimum possible per-crossing cost), or A\* loses optimality.

---

### Tier 3 — Puzzle Breadth

---

#### 8. Jealous-husbands variant

PROGRESS: TODO

**What:** Swap the constraint: no person may be on a bank with someone else's
spouse unless their own spouse is present. Same engine, different `isValid`.

**Why it matters:** Demonstrates that the *engine* is general — only the
predicate changes — which is exactly the state-space lesson (TEXTBOOK §10). The
puzzle's medieval near-twin, so it earns the historical note.

**Caveat:** Identity matters here (who is whose spouse), so `PuzzleState` would
need per-person tracking rather than counts — a larger change than it looks.

---

#### 9. Show the full solution tree / count solutions

PROGRESS: TODO

**What:** Beyond the single returned path, enumerate *all* shortest solutions (or
count them) by continuing BFS through the goal layer.

**Why it matters:** The classic 3/3/2 puzzle has more than one optimal 11-move
solution; surfacing that distinguishes "a path" from "the path."

---

### Tier 4 — Narrative Layer

The story engine ([`narrative/`](../../src/experiments/river-crossing/narrative/))
retells the played `moveLog` as seeded, deterministic prose — a named cast,
evolving tension/trust, and dynamic intro/win/loss framing that reacts to actual
run stats. Wired into the page via
[`StoryPanel`](../../src/experiments/river-crossing/components/StoryPanel.tsx).

---

#### 10. Core story generation

PROGRESS: Done

**What:** `generateStory(cfg, moves, status, seed)` builds a roster, replays the
moves over it, tracks tension/trust per resulting bank, and renders intro / cross
/ win / loss beats. Deterministic in `(cfg, moves, status, seed)`; *retell* bumps
the seed. PRNG is `mulberry32` ([`rng.ts`](../../src/experiments/river-crossing/narrative/rng.ts)).

**Note:** The story follows `moveLog` (what the player actually did), not the
solver plan — so a losing manual run gets a death beat with the exact doomed
ratio.

---

#### 11. Localize the prose (Vietnamese)

PROGRESS: TODO

**What:** The story *UI* labels (`story.title/copy/retell`) are in `en.ts`/`vi.ts`,
but every template string in
[`templates.ts`](../../src/experiments/river-crossing/narrative/templates.ts) is
hardcoded English. Move the phrase banks into i18n (or a locale-keyed template
module) so a VI telling reads as VI.

**Why it matters:** The repo rule is that nothing user-visible stays hardcoded
when i18n applies (see the death-shout handling in TEXTBOOK §5, which already
follows this). The story is the largest body of hardcoded English in the repo.

**Caveat:** This is non-trivial — the templates rely on English grammar
(`cap()`, `listNames`'s "and", pluralization). A VI port needs its own
joiners/clauses, not a 1:1 string swap.

---

#### 12. Per-character arcs

PROGRESS: TODO

**What:** The `Actor.crossed` counter is already tracked and used to favour
rested crossers; extend it into light arcs — call out the one who ferried most,
a cannibal who never crossed, a missionary's recurring epithet across beats.

**Why it matters:** Cheap continuity payoff from data already in hand; makes a
retell feel authored rather than templated.

---

### Tier 5 — Engineering / Performance (mostly N/A, recorded)

These are deliberately *not* worth doing at this scale; noted so the decision is
explicit rather than an oversight.

| Item | Verdict |
|---|---|
| A\* binary heap (vs. linear-scan PQ) | **Skip.** The state space is ≤ ~32 nodes; the linear scan is already comments-justified in `solveFrom`. A heap would add code for no measurable gain. |
| Web Worker for search | **Skip.** Search completes in microseconds on the bounded space; there is no main-thread stall to offload (unlike the chess engine). |
| Memoize `solveFrom` across renders | **Already handled** — `useMemo` keys it on `(cfg, state, algo)` in `useRiverCrossing`. |

If a *much* larger variant is ever added (relaxing `MAX_PEOPLE`/`MAX_CAP` in
[`constants.ts`](../../src/experiments/river-crossing/constants.ts)), revisit the
heap and the worker — but the bounds exist precisely to keep the graph
comprehensible, so growing them is itself the thing to question first.

---

*Maintained alongside the code. When an item ships, flip its PROGRESS to Done and
fold the lasting lessons into [TEXTBOOK.md](TEXTBOOK.md); this file tracks intent,
the textbook records what was learned.*
