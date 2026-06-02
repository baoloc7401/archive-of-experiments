# River Crossing — Textbook & Real-World Research

Reference code:
[`solver.ts`](../../src/experiments/river-crossing/solver.ts) (the search engine),
[`useRiverCrossing.ts`](../../src/experiments/river-crossing/useRiverCrossing.ts) (game state + playback),
[`constants.ts`](../../src/experiments/river-crossing/constants.ts),
[`types.ts`](../../src/experiments/river-crossing/types.ts),
[`components/RiverScene.tsx`](../../src/experiments/river-crossing/components/RiverScene.tsx) (rendering).

This is the research record for the **Missionaries & Cannibals** puzzle modelled
as an explicit **state-space search**. It covers the model, the three search
algorithms (BFS / DFS / A\*) and how faithfully we implement them, and — the
point — **what we learned wiring a search algorithm to an animation.** The
headline finding is not about the puzzle; it is about the gap between "find a
path" and "drive a step-by-step player along one." Findings accumulated while
building and debugging the experiment.

---

## 0. The single most important finding

> **Driving a step-by-step animation by re-solving from the current state each
> step and applying `moves[0]` only works for algorithms that return a
> *progress-monotonic* path. BFS and A\* do; DFS does not — so the naïve player
> loops forever. The fix is to commit to one plan and follow it, not to
> re-derive the next move every tick.**

The auto-player's first design recomputed `solveFrom(cfg, state, algo)` after
every committed crossing and took the first move of the freshly-returned path.
For **BFS** and **A\*** this is safe: the first edge of a *shortest* path always
lands on a state strictly closer to the goal, so re-solving from there returns a
path one move shorter, and stepping converges.

**DFS broke it.** DFS returns *a* path, not a shortest or progress-monotonic one.
With the 5M/5C/boat-4 puzzle, the player got stuck ferrying `2M+2C` across and
back **forever**:

```
#1 → 2M+2C  ⇒  L(3,3) R(2,2) boat@R
#2 ← 2M+2C  ⇒  L(5,5) R(0,0) boat@L
#3 → 2M+2C  ⇒  L(3,3) R(2,2) boat@R   … ad infinitum
```

Re-solving DFS from `L(3,3)@R` returns a path whose *first* move is `←2M+2C`
(straight back to the start); re-solving from `L(5,5)@L` returns one starting
`→2M+2C` again. Each recomputation undoes the last. The path DFS finds in a
single call is perfectly valid and finite (its `discovered` set prevents
internal cycles) — the bug was **recomputing it from intermediate states**, which
is a different, oscillating process.

**The fix** (`useRiverCrossing.ts`): snapshot the *entire* plan once when the
user presses *solve & play* (or *hint step*) into a `plan` array, and walk it
move-by-move. A single DFS path has no cycles, so following it reaches the goal.
The plan is dropped whenever the player deviates — a manual cross, undo, reset,
config change, or switching the algorithm. This was surfaced by the in-app
**debug report** (§7), not by reading code: the user pasted the looping log and
the failure was obvious from the move list. See §3 for the full argument.

---

## 1. The model & the state space

The puzzle: ferry `M` missionaries and `C` cannibals across a river in a boat of
capacity `K`, never letting cannibals outnumber missionaries on a bank where any
missionary stands, and never sailing the boat empty.

### 1.1 State

The whole world collapses to three numbers ([`types.ts`](../../src/experiments/river-crossing/types.ts)):

```
state = (ml, cl, boat)
```

`ml`, `cl` = missionaries and cannibals on the **left** bank; `boat ∈ {L, R}`.
The right bank is always `(M − ml, C − cl)`, so it is never stored
(`rightBank()`). The start is `(M, C, L)`; the goal is `(0, 0, R)` — everyone
across *and* the boat parked on the far side.

### 1.2 Validity

A state is legal when, on **each** bank, cannibals don't outnumber missionaries
*while missionaries are present* (`isValid`):

```
(ml = 0  or  ml ≥ cl)   and   (mr = 0  or  mr ≥ cr)
```

An all-cannibal bank is always fine (no missionary to eat). This is checked on
**both** banks of the resulting state, which automatically covers the bank the
boat just *left* as well as the one it arrived at.

### 1.3 Moves and the branching factor

A crossing carries 1..K people. `boatLoads(K)` enumerates every `(m, c)` with
`1 ≤ m + c ≤ K`. For `K = 2` that is `(1,0),(2,0),(0,1),(0,2),(1,1)` — five
candidate loads. `successors()` applies each to the docked bank, flips the boat,
and keeps only the **legal, in-bounds** results.

### 1.4 State-space size

The reachable space is tiny and finite:

```
|states| = (M + 1)(C + 1) × 2
```

For the default 3/3 puzzle that is `4 × 4 × 2 = 32` states — which is exactly why
the puzzle is a clean teaching vehicle for search: you can hold the whole graph
in your head, yet BFS/DFS/A\* visibly differ on it. Config bounds keep it small:
`M, C ∈ [1, 5]`, `K ∈ [2, 4]` (`constants.ts`).

---

## 2. The three search algorithms

All three share the graph (`successors`) and differ only in frontier discipline.
Each call returns the path, the moves, and **search-cost telemetry** —
`expanded` (nodes pulled off the frontier), `discovered` (distinct states ever
seen), and `frontierPeak` (largest the frontier grew) — which the panel surfaces
so you can *watch the cost*, not just the answer.

### BFS — Breadth-First Search
**Definition.** Expand the frontier in FIFO order; the first time you reach the
goal you have a path with the **fewest edges**.
**Character.** Optimal in crossings; explores broadly; frontier can be wide.
**Our implementation.** A queue (array + `head` cursor), states marked
**discovered on enqueue** so each is queued once.
**Fidelity.** Faithful and **optimal**. On 3/3/2 it returns the canonical
**11-crossing** solution, expanding 15 nodes.

### DFS — Depth-First Search
**Definition.** Expand LIFO; dive deep, backtrack on dead ends. Returns *a*
solution — not necessarily short.
**Character.** Small frontier (a stack), but the path can be long and its shape
depends entirely on which successor is pushed last (explored first).
**Our implementation.** Same loop as BFS with `frontier.pop()` instead of a queue
head, sharing the **mark-on-discovery** set (so a single call never revisits a
state and never cycles).
**Fidelity.** Faithful. It happens to return 11 moves on 3/3/2 here, but that is
not guaranteed — DFS is "any solution," and **its non-monotonic paths are the
root of the §0 finding.**

### A\* — best-first with an admissible heuristic
**Definition.** Expand the frontier node minimizing `f = g + h`, where `g` is
crossings so far and `h` a lower bound on crossings remaining. With an admissible
`h`, A\* is **optimal**.
**Character.** BFS's optimality with fewer expansions when the heuristic bites.
**Our implementation.** A linear-scan priority queue (the state space is far too
small to justify a real heap), `g`-relaxation per the standard algorithm, and:

```
h(state) = ceil((ml + cl) / K)
```

**Why this `h` is admissible:** everyone still on the left bank must be ferried
across, and one forward trip removes at most `K` people, so at least
`ceil((ml + cl) / K)` forward crossings remain. It ignores the return trips the
boat must also make, so it never *over*estimates → A\* stays optimal and agrees
with BFS on length (11 on 3/3/2).

---

## 3. Why BFS/A\* step cleanly and DFS doesn't

This is the §0 finding stated precisely, because it is the genuine research
output of the build.

Let `d(s)` be the true minimum crossings from state `s` to the goal. A player
that "re-solves and takes the first move" is iterating the map
`s → first_move(solve(s))`. It terminates **iff** every step strictly decreases
some well-founded measure.

- **BFS / A\* return shortest paths.** The first edge of a shortest path goes to
  a state `s'` with `d(s') = d(s) − 1`. So `d` strictly decreases each step:
  re-solving is *stable*, and the sequence of first-moves is itself an optimal
  walk. The naïve player is correct here by accident of optimality.
- **DFS returns any path.** `first_move(dfs(s))` can go to a state `s'` with
  `d(s') = d(s) + 1` (further away). Re-solving from `s'` can then point straight
  back to `s`. There is no decreasing measure, so the iteration can cycle — and
  did, on 5/5/4.

The lesson generalises beyond this puzzle: **a search result is a *path*, not a
*policy*.** If you need to execute a search result step-by-step, commit to the
path you found; do not re-query the search at each step unless the search is
guaranteed to return a consistent (shortest/monotonic) path from every state.

**Implementation of the fix.** `useRiverCrossing` keeps the recomputed
`solveFrom` only for *display* (the panel's "plan from here" and the live
telemetry). Playback follows a separately-committed `plan: Move[]`:

- `play()` snapshots `solution.moves` into `plan` and sets `playIntent`.
- The auto-play effect schedules one move at a time from `plan` (never recomputes)
  and shifts it off.
- `plan` is cleared on manual `cross`, `undo`, `reset`, config change, and
  algorithm switch — any genuine deviation invalidates the committed plan.

The panel also prefers the active `plan` over the recomputed solution while one
is running, so what you *see* matches what's *executing* (otherwise DFS's
display would disagree with itself move to move). And because DFS isn't optimal,
the labels are honest: "crossings left" rather than "optimal", and "DFS plan
from here" rather than "optimal plan from here."

---

## 4. Solvability is a first-class output

A search that explores the *whole* reachable space and finds no goal has
**proved the instance impossible** — and that is as valuable as a solution.

The task that seeded this experiment shipped a variant table claiming
**4 missionaries + 4 cannibals** is solvable. With **boat capacity 2 it is
not** — and the solver says so, expanding 11 states, discovering 11, and
returning `solvable: false`. We deliberately **hardcode no solvability table**;
the BFS/DFS/A\* search is the single source of truth. Verified instances:

| M | C | K | Result | Min crossings | Notes |
|---|---|---|---|---|---|
| 3 | 3 | 2 | solvable | **11** | the classic puzzle |
| 4 | 4 | 2 | **unsolvable** | — | the prompt's table was wrong |
| 4 | 4 | 3 | solvable | 9 | bigger boat rescues it |
| 5 | 2 | 2 | solvable | 11 | lopsided populations are fine |
| 5 | 5 | 4 | solvable | (the §0 DFS loop case) | |

This is the educational payoff of the state-space framing: change the headcount
or boat size and the *same* engine either solves the new puzzle or proves none
exists — no per-variant special-casing. When unsolvable, the panel shows the real
search cost (non-zero `expanded`/`discovered`), because an early version returned
hardcoded zeros there and that hid how much work the proof took.

---

## 5. The manual game: illegal moves are *allowed*, then judged

The interactive (non-solver) game models the rules differently from the search on
one deliberate point: **`successors()` only ever generates legal moves, but the
human is allowed to make an illegal one and lose.**

- Boarding (`boardPerson`) is constrained to the docked bank's actual supply and
  the `K` seats, so counts can't go out of bounds.
- A crossing uses `rawApply` — which **skips the safety check** — then the
  finalize step judges the result: `won` (goal), `playing` (legal), or `lost`
  (a missionary was outnumbered → eaten).

This makes the failure mode *visible and consequence-bearing* rather than
prevented, which is the whole drama of the puzzle. When a crossing produces an
illegal state, the scene finds the **doomed bank** (where `c > m > 0`), plays a
keel-over **death animation** on those missionaries while the cannibals lunge,
and floats a **comic speech bubble** with a random last word. The shouts live in
i18n (`experiments.river-crossing.death_shouts`, EN + VI, kept in sync at 16
lines); the hook stores a random **index** — not the string — so the line is
stable across re-renders and localized at display time. (Hardcoding the strings
was the first cut; it was moved into the locale files because nothing
user-visible should be hardcoded.)

---

## 6. Visualization & engineering findings

Non-search lessons the build forced into the open, recorded because they cost
real time and generalise.

### 6.1 The boat hid behind the banks — a stacking-context trap
The boat was first nested inside `.rc-water`, a positioned element with
`z-index: 1`. A positioned element with a z-index **forms a stacking context**,
so the boat's own `z-index: 3` only ranked it *within the water layer* — it could
never paint above the banks (`z-index: 2`), which sit above the whole water
layer. **Fix:** lift the boat to be a direct child of the scene with
`z-index: 5`. Generalised: a child's z-index is meaningless outside its parent's
stacking context; raising the child can't escape a parent that's pinned lower.

### 6.2 Scene geometry is keyed to one waterline
A first pass left the boat "on the ground" — below the water band, behind the
land. The scene is a side view tied to a shared waterline: sky → a `40%` water
band along the bottom → land platforms rising to `52%` with the crowd anchored at
`bottom: 52%` (people stand on the land's flat top) → the boat at `bottom: 37%`
so its hull straddles the `40%` surface, docking at `left: 31%/69%`. The boat
glides on `left` with a transition whose duration is fed from the live tick
(`--rc-cross-ms`) so it lands exactly as the move commits.

### 6.3 Day/night cycle from the theme
Light/dark already swap the scene palette; the celestial body extends that into a
**cycle**. Both a sun and a moon always exist in the DOM; the theme only sets each
body's `top` (one risen at `9%`, the other set at `82%`), and a transitioned
`top` makes a theme flip animate as a **sunset/sunrise**. The setting body slides
*behind the horizon* because it sits at `z-index: 0`, below the water (`1`) and
banks (`2`), which occlude it as it sinks.

---

## 7. The debug-bridge methodology

Because the assistant can't see the running app, the experiment ships a
**copyable debug report** (the DebugLog panel, `buildReport()`). It bundles what
a screenshot can't: the config, both banks, boat side, status, the full solver
telemetry and plan from the current state, a **replayed move history with
per-move validity**, and a rolling event log.

This is not decoration — **it is how §0 was found.** The user pasted a report of
the 5/5/4 DFS run; the repeating `→2M+2C / ←2M+2C` move list made the oscillation
diagnosable without ever seeing the screen. The methodology generalises to any
interactive experiment: **expose the engine's internal state as paste-ready text,
and let the human bridge it back.** (Same pattern as the ACO experiment's debug
report.)

---

## 8. Fidelity scorecard

| Aspect | Status | Note |
|---|---|---|
| State model `(ml, cl, boat)`, right bank derived | ✅ | canonical |
| Validity on both banks (cannibals ≤ missionaries where present) | ✅ | canonical |
| Goal `(0, 0, R)` — boat must end on the far side | ✅ | |
| BFS optimal (fewest crossings) | ✅ | 11 on 3/3/2 |
| DFS any-solution | ✅ | non-optimal by design |
| A\* with admissible `h = ceil((ml+cl)/K)` | ✅ | optimal, agrees with BFS |
| Solvability as output (impossible instances proved) | ✅ | no hardcoded table |
| Arbitrary `M, C, K` reconfiguration | ✅\* | bounded `M,C∈[1,5]`, `K∈[2,4]` for a small, watchable space |
| Manual illegal move allowed → loss | ✅\* | deliberate: search generates legal-only, the *human* may err |

`✅*` = faithful with a deliberate, noted scope choice.

---

## 9. Where this is *not* a "real" anything (scope boundary)

The puzzle is a toy; the **state-space search** is the real subject. Boundaries:

- **Tiny, bounded instances.** `(M+1)(C+1)·2` states with `M,C ≤ 5` — chosen so
  the whole graph is comprehensible and the UI stays legible, not to stress-test
  search. Real search problems are astronomically larger.
- **Uniform-cost edges.** Every crossing costs 1, so BFS already gives the
  optimum and A\*'s heuristic is a tie-breaker on work, not a necessity. The
  moment crossings carry *weights* (time, fuel), this becomes a genuine
  shortest-path problem where A\*/Dijkstra earn their keep — see the
  [[Experiment Pathfinding]] sibling.
- **No people-level modelling.** Missionaries and cannibals are interchangeable
  counts, not individuals; the boat has no rower identity, fatigue, or night.
- **The solver never loses.** Only the *manual* game can reach a `lost` state;
  the search only ever traverses legal successors.

---

## 10. Further real-world context

- **State-space search** — modelling a problem as `(states, actions, goal-test)`
  and searching the implicit graph — is the foundational technique behind
  planning, routing, puzzle-solving, and game AI. M&C is the textbook on-ramp
  precisely because its graph is small enough to draw.
- **BFS / DFS / A\*** here are the same algorithms that, on a *weighted* grid,
  power the [[Experiment Pathfinding]] experiment. Seeing them on an abstract
  state graph and on a spatial grid is the same idea wearing two costumes.
- **The puzzle's history.** Missionaries & Cannibals (and its near-twin, the
  *jealous husbands* problem, where the constraint is "no woman with another man
  unless her husband is present") date to medieval recreational mathematics. The
  classic 3/3/boat-2 instance needs 11 crossings; scaling the populations past
  the boat's slack quickly makes it **unsolvable** — which the search discovers
  automatically (§4) rather than requiring a cleverness proof.
- **Why a general algorithm beats memorised moves.** The canonical solution is
  often taught as a fixed 11-move recipe. The instant any parameter changes
  (`4/4/2`, `K=3`, lopsided populations) the recipe is useless, but the search is
  not — the whole point of the state-space formulation.

---

*Maintained alongside the code. If the search engine (`solver.ts`) or the
playback/plan model (`useRiverCrossing.ts`) changes, update §1–§3 and the §8
scorecard; if the scene/celestial rendering changes, update §6.*
