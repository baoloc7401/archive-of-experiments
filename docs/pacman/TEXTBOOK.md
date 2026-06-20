# Pac-Man & Ghost AI - Textbook & Real-World Research

Reference code: [`targeting.ts`](../../src/experiments/pacman/targeting.ts) (the
four ghost heuristics + greedy chooser),
[`simulation.ts`](../../src/experiments/pacman/simulation.ts) (movement, modes,
pen lifecycle, eating, collisions, scoring),
[`constants.ts`](../../src/experiments/pacman/constants.ts) (every tunable),
[`coordination.ts`](../../src/experiments/pacman/coordination.ts) (coordinated
ghosts), [`pacai/`](../../src/experiments/pacman/pacai/) (the Pac-Man driver
ladder + static graph), [`pellets/registry.ts`](../../src/experiments/pacman/pellets/registry.ts)
(board content), [`mazes/`](../../src/experiments/pacman/mazes/) (generator,
validator, serializer), [`render.ts`](../../src/experiments/pacman/render.ts) +
[`sound.ts`](../../src/experiments/pacman/sound.ts) (canvas + Web Audio).
Action logs: [`IMPROVEMENTS.md`](./IMPROVEMENTS.md) (the planned feature ladder),
[`ISSUES.md`](./ISSUES.md) (the bug/debt review).

This is the research record behind building a faithful, *legible* Pac-Man whose
real purpose is to make ghost AI visible: live target tiles, steering lines, an
explain-on-hover freeze mode, and an opt-in roster of AI drivers for Pac-Man
himself. The findings below accumulated while building, debugging, and arguing
with the 1980 design. Where this project deviates from the arcade it says so and
why - it is framed as an "homage + improvement", not a clone.

---

## 0. The single most important finding

> **A ghost has no idea where Pac-Man is. It only knows one tile - its "target" -
> and greedily steps toward it. Every ghost runs the identical movement rule;
> the only thing that differs between Blinky, Pinky, Inky and Clyde is the one
> line of arithmetic that picks that tile. "Personality" is target selection,
> nothing more.**

This is the entire teaching thesis, and it survives contact with every feature
we added. The decoy pellet proves it the hardest: eat one and a *phantom* Pac is
planted on a tile, the chase targeting aims at the phantom, and all four ghosts
mob an empty square while the real Pac strolls past. We did not write special
"fooled" behaviour - the ghosts were always just chasing a tile, and we changed
which tile. Coordinated mode proves it from the other side: to make the pack
*surround* Pac we changed only the targets (four stations around him), never the
movement rule. **If you remember one thing about ghost AI: it is target
selection feeding a shared, dumb, local greedy step.**

---

## 1. The ghost movement rule (greedy, not pathfinding)

The issue text loosely called the ghosts "BFS". They are not. The historically
accurate rule, and the one in [`targeting.ts`](../../src/experiments/pacman/targeting.ts)
`chooseDirection`, is purely **local**:

1. At each tile centre, look at the (up to four) legal exits.
2. **Never reverse** - the direction you came from is removed (this is what makes
   ghosts orbit instead of jitter).
3. Of the remaining exits, pick the one whose **neighbour tile** has the smallest
   straight-line (Euclidean, compared squared) distance to the target tile.
4. **Ties break in a fixed priority: up > left > down > right** (`TIE_ORDER`).

No path is ever computed. A ghost cannot "see" walls ahead beyond the next tile,
which is why a ghost will happily run *toward* a target and get stuck taking the
long way around a block. The BFS overlay in the app exists only as a foil - it
draws what a real planner *would* do, and the gap between the dashed BFS line and
the ghost's actual route is the lesson made visible.

**Why straight-line and not Manhattan:** the arcade used squared Euclidean. It
matters at decision tiles where the two metrics disagree on which exit is
"closest"; matching it reproduces the exact turns players memorised.

---

## 2. The four personalities are four target functions

All in [`targeting.ts`](../../src/experiments/pacman/targeting.ts); each returns a
*tile*, then §1 does the rest.

| Ghost | Chase target | Character |
| ----- | ------------ | --------- |
| **Blinky** (red) | Pac-Man's exact tile | relentless tail |
| **Pinky** (pink) | 4 tiles **ahead** of Pac-Man's facing | ambusher, cuts you off |
| **Inky** (cyan) | reflect Blinky's position through the point 2 ahead of Pac, **doubled** | unpredictable, needs Blinky |
| **Clyde** (orange) | Pac's tile if **> 8 tiles** away, else his own scatter corner | shy; bimodal pursue/flee |

Two global states override the personal target:

- **Scatter:** every ghost targets a fixed off-map "home corner" (`SCATTER_TARGET`),
  so the pack disperses. The corners are *outside* the board on purpose, which is
  why the overlay has to clamp the crosshair to the nearest edge tile for
  drawing.
- **Frightened:** ghosts stop targeting and **flee** (`chooseFlee` maximises
  distance to Pac). The arcade actually moves them *pseudo-randomly*; we chose
  deterministic flee as a legibility improvement and label it as such.

The mode itself runs on a fixed **scatter/chase schedule** (`SCHEDULE`): 7s
scatter, 20s chase, repeating with shrinking scatter windows, ending in
**permanent chase**. A mode flip force-**reverses** every active ghost - that
sudden about-face is a scheduled event, not a reaction to you.

---

## 3. Faithful bugs are content, not defects

The 1980 ROM has famous bugs. Reproducing them precisely (and *explaining* them)
is more valuable than "fixing" them:

- **Pinky/Inky up-overflow:** the "tiles ahead of Pac" math has an 8-bit overflow
  when Pac faces **up**: the target also shifts *left* by the same amount (Pinky's
  4-ahead becomes 4-up-**and**-4-left; Inky's intermediate point likewise). The
  code reproduces this in `offsetAhead` and flags it with `upOverflow` so the
  explain panel can call it out. Players exploited this for decades without
  knowing why.
- **The four "no-up" tiles** (`NO_UP_TILES` = `12,11 15,11 12,23 15,23`): at these
  specific tiles a ghost in scatter/chase is forbidden from choosing to turn
  upward, an original restriction baked into the maze. It subtly changes routes
  near the ghost house.

**Lesson:** when recreating a historical system, treat its quirks as
first-class. A "corrected" Pac-Man is a different, lesser game.

---

## 4. The movement model is the thing that bites you

Actors are **lane-locked and move centre-to-centre on integer tile coordinates**
(tile centre = integer x/y; pixel centre = `(v + 0.5) * tile`). All decisions
happen exactly at tile centres, via the `advance()` stepper's `decide` callback
([`simulation.ts`](../../src/experiments/pacman/simulation.ts)). This is the single
biggest source of subtle bugs:

- **Spawns must be integer tile centres.** We shipped half-tile spawn values once
  and actors decided "mid-lane", desyncing the whole greedy model. If an actor is
  not on an integer centre, it is between decisions and the rules do not apply.
- **The ghost house is outside the model.** Bobbing in the pen, leaving through
  the gate, and eyes re-entering are hand-animated special cases
  (`stepGhostHouse/Leaving/Entering`), not `advance()`. Mixing them in breaks the
  "decide only at centres" invariant.
- **Tunnel wrap is a coordinate hack, not a portal.** Horizontal wrap at the
  tunnel row is handled by `wrapX` plus modulo distance in every metric. Any code
  that measures distance or steps neighbours must wrap, or the AI thinks the two
  tunnel mouths are 26 tiles apart.

**Speeds (tiles/sec, slowed from arcade for legibility):** pac 5.2, ghost 4.8,
frightened 3.0, tunnel 2.6, eaten (eyes) 10.0. The tunnel slowdown is the classic
escape valve - ghosts lose ground there, so the tunnel is a refuge.

---

## 5. The Warden: when greedy *fails*, you need a planner

We added a 5th custom ghost, the Warden, to *guard energizers*. The first attempt
reused the canonical greedy rule and the Warden visibly **ran away** from the
energizer it was meant to sit on - greedy local stepping orbits a target it
cannot reach in a straight line, it does not camp. The fix taught the
complementary lesson to §1:

- Targeting (`wardenDecision`): guard the nearest energizer while Pac heads toward
  it / is near it; otherwise hunt Pac's tile; pounce if Pac strays within 5 tiles.
- Movement (`wardenDirection`): the Warden is the **only** ghost that uses true
  **BFS shortest path** and is **allowed to reverse**, so it can actually arrive
  and then *camp* by bouncing in place.

**Lesson:** greedy local chasing and goal-camping are different problems. The
classic ghosts want the orbiting, harassing feel greedy gives; a guardian needs a
planner. Same board, opposite algorithm.

---

## 6. Coordinated ghosts: change the targets, keep the rule

An opt-in mode where the four ghosts stop each running their own heuristic and
instead **surround** Pac. The design constraint we set ourselves (to keep §0
true): **only the targets change, the movement rule does not.**

[`coordination.ts`](../../src/experiments/pacman/coordination.ts) builds a shared
"blackboard" each chase tick: four stations around the hunted tile (chaser on
Pac, ambusher ahead, two cutters on the perpendicular flanks at lookahead 5,
snapped to the nearest passable tile by a ring search), then a **greedy min-cost
assignment** - each station, in priority order, goes to the nearest unassigned
ghost by true BFS distance. Extra ghosts become lurkers.

Findings:

- **It is built over the *hunted* tile, so a decoy still misdirects the whole
  coordinated pack** - the abstraction composed for free.
- Gated to chase only (not scatter/frightened) - surrounding a fleeing target is
  incoherent.
- Greedy assignment with reused typed-array scratch is more than good enough; a
  full Hungarian matching for four agents is not worth it.

---

## 7. Pac-Man as the agent: a 6-rung AI ladder on a static graph

The mirror image of ghost AI: let an algorithm drive Pac. The drivers live in
[`pacai/`](../../src/experiments/pacman/pacai/) as a registry, climbing in
sophistication:

| Rung | Driver | Idea |
| :--: | ------ | ---- |
| 1 | `greedy` | walk to the nearest pellet (BFS) |
| 2 | `safe` | greedy, but refuse tiles near a ghost |
| 3 | `astar` | danger-weighted Dijkstra: flee, and *hunt* frightened ghosts |
| 4 | `coverage` | a global nearest-neighbour sweep tour, so it clears regions |
| 5 | `search` | bounded look-ahead (expectimax-lite) over a compact node model |
| 6 | `montecarlo` | many random rollouts; the move with the best average future |

The engineering lessons matter more than the algorithms:

- **One precomputed graph, zero steady-state allocation.** Tiles are numeric ids
  (`id = row*COLS + col`); adjacency, BFS, multi-source danger fields and
  Dijkstra all run on **reused typed arrays** ([`pacai/graph.ts`](../../src/experiments/pacman/pacai/graph.ts)).
  An AI that re-decides every tile at 60fps cannot afford to allocate.
- **Share the world model or the futures diverge.** `search` and `montecarlo`
  both step through the *same* [`node.ts`](../../src/experiments/pacman/pacai/node.ts)
  (`stepNode`: Pac one tile, each ghost one greedy step toward the *predicted*
  Pac). Two slightly different look-ahead models is a bug factory.
- **Wormholes are an edge redirect, not a node.** Making planners portal-aware
  was just resolving each discovered neighbour through `resolvePortal`; uniform
  BFS stays correct because a portal is a 1-step relabel, not a 0-cost edge.
- **Determinism is a feature.** `montecarlo` originally used `Math.random`, so the
  same position gave different moves and the rollout-fan overlay shimmered. We
  reseed a mulberry32 PRNG each decision from a hash of the live state, making the
  driver a **pure function of state**. For a *visualizer*, reproducibility is not
  optional - a shimmering explanation is a broken explanation.

---

## 8. Board content as a registry, with `effectiveKind` as the key idea

The board started as two `Set<string>` (dots, energizers). Generalising to a
**registry** ([`pellets/registry.ts`](../../src/experiments/pacman/pellets/registry.ts))
- every placed item is a `PelletKind` with points, colour, a goal flag, and an
optional `onEat(state)` effect - unlocked decoy / freeze / speed / trap / fruit /
wormhole, each individually toggleable like the ghosts.

The linchpin is **`effectiveKind(state, key)`**: it returns a tile's kind, *or
`"dot"` when that special is toggled off*. This one indirection means:

- The board is **always clearable** - turn everything off and every special is
  just a 10-point dot.
- The win check, the AI's pellet set, and the renderer all ask the same question
  and never disagree about what a tile "is".
- Effects stay decoupled: `onEat` only sets timers/flags (`frightTime`,
  `freezeTime`, `pacStunTime`, `decoy`, ...), and the loop reads them, so the
  registry imports **no** engine code (no cycle).

**The trap is the interesting one for AI:** eating it is pure loss (points +
stun), never a trade, so *every* driver must route strictly around it. That
turned "respect the content" from a nicety into a correctness property of the
planners (masked BFS, trap step-cost, penalised search leaves).

---

## 9. Mazes as runtime data: connectivity by construction

Making the maze editable meant the layout could no longer be a constant. The
move: a module-level **active maze + version counter**
([`maze.ts`](../../src/experiments/pacman/maze.ts)); the four readers (char
lookup, AI graph, renderer, board builder) all read it, and the AI graph rebuilds
its adjacency when the version changes. `COLS/ROWS` and all house/spawn/tunnel
geometry stay fixed; only walls/dots/specials vary.

The generator ([`mazes/generate.ts`](../../src/experiments/pacman/mazes/generate.ts))
is the prettiest result: grow walls as a **spanning *forest*** over an
even-coordinate pillar lattice, using union-find that **refuses any wall edge
that would close a loop of walls**. Because the walls never form a closed loop,
their complement - the corridors - is **guaranteed connected**, while *not*
completing a full spanning tree leaves the open loops a Pac-Man board needs. Then
mirror the left half for symmetry and stamp the locked structure back on.

- **Generate-and-validate beats generate-correctly for edge cases.** A wall can
  still close a loop *against the locked house*, so we flood-fill validate and
  reseed (mulberry32, deterministic) up to 24 times, classic layout as the last
  resort.
- **Symmetry gotcha:** mirroring tile-by-tile breaks where a tile's mirror is
  locked. Fix: mirror the whole half unconditionally, *then* re-apply locks.
- **Content lives in the grid chars** (`. o D F S T W`), so a layout carries its
  own pellets - placeable, serializable (`pm1;` format), validatable. Fruit is
  the exception: a fixed central spawner, because its tile sits inside the locked
  house region.

---

## 10. Feel: canvas, popups, and the transform that ate the HiDPI buffer

- **The DPR bug worth remembering:** `drawScene` folds *both* the on-screen tile
  scale *and* the device pixel ratio into **one** `ctx.setTransform`. An earlier
  version called `setTransform` (for tile scale) which **wiped** a prior
  `ctx.scale(dpr, dpr)`, leaving the HiDPI backing store half-cleared - persistent
  smear trails on retina screens. One transform, computed once, every frame.
- **Score popups should scale with magnitude.** Floating a number on *every*
  mutation (dots included, per request) risks clutter; sizing the text by
  `log10(amount)` keeps a stream of `+10`s tiny while a `+1600` ghost combo reads
  large. A `label` escape hatch lets the same system draw a green **"1UP"**.
- **Two animations for two meanings.** The maze editor uses a dramatic diagonal
  scan reveal for full wall swaps, but a *subtle* per-pellet bloom for
  content-only edits - the animation should match the size of the change.
- **Reduced motion gates decoration, not information.** Pellet pulses and ghost
  skirt-shuffle are gated off; popups and the death animation stay, because they
  carry state.

---

## 11. Sound: synthesize it, and respect the gesture

[`sound.ts`](../../src/experiments/pacman/sound.ts) generates **every** effect at
runtime with Web Audio oscillators - no sample files. Findings:

- **No samples = no recording copyright** (see §13). It also keeps the bundle
  tiny and lets effects be parametric (the waka alternates pitch; the siren's
  pitch tracks danger).
- **Autoplay policy is a gesture problem, not a code problem.** Browsers block an
  `AudioContext` until a user gesture. The mute toggle *is* that gesture, so we
  create/resume the context on **unmute** and prime it with one silent sample so
  the first real cue is not dropped.
- **The engine must not import the audio layer.** The framework-free sim only
  *pushes string cue tags* onto `state.sfx`; the React/canvas view drains and
  plays them. Same for the ambient **siren**: the sim exposes nothing audio, the
  view computes a danger level (nearest lethal ghost, tunnel-wrapped) each frame
  and drives `setSiren`. This keeps the simulation pure and testable.
- **Batch then dedupe.** Several fixed-steps can run per rendered frame, each
  possibly queuing a `chomp`; played verbatim they stack at the same instant
  (a "double-volume" click). Deduping identical cues per drain fixes it.

---

## 12. The architecture rule that paid off everywhere

> **Keep the engine framework-free and let the view drain it.**

Every `.ts` logic file in the experiment imports zero React. The simulation is a
pure `step(state, dt)` mutation; the React component is glue (refs, a fixed-step
rAF loop, handlers). Two consequences:

- **Headless verification is trivial.** Throughout this work, features were
  checked by bundling the engine with esbuild and running assertions in Node
  (ghost release, no-NaN long runs, targeting vs the Pac-Man Dossier, generator
  symmetry/connectivity over 60 seeds, every pellet effect firing, AI clearing
  generated mazes, montecarlo determinism, the 1UP firing exactly once). No
  browser, no DOM. The harnesses are throwaway, deleted after.
- **View-feedback channels are explicit and quarantined.** `popups` and `sfx`
  live on the state but are documented as *not* simulation state -
  `computeSnapshot` ignores them, nothing serializes them. When you thread
  view-only data through a pure core, label it loudly or someone will treat it as
  truth.

---

## 13. Licensing: the honest version

You **cannot** "properly license" a Pac-Man clone. PAC-MAN is a Bandai Namco
trademark; the character, the four named ghosts and the maze are their
copyrighted works, and no public license exists. The repo's CC BY-NC 4.0 covers
only *our* original code and art - its own text excludes trademark rights.

The two real paths:

1. **Homage + disclaimer** (chosen): a clear non-affiliation, nominative-use
   notice ([`NOTICE.md`](../../NOTICE.md), an in-experiment line, surfaced from
   the README). Standard and widely tolerated for a non-commercial educational
   piece - but it is *tolerance*, not a granted right.
2. **De-brand:** rename the game and ghosts to generic equivalents; then CC BY-NC
   cleanly owns everything. The only way to fully control the IP, at the cost of
   recognizability. Left open.

Audio sidesteps the issue by construction: synthesized blips are original work,
*provided* you do not transcribe Namco's actual compositions (we kept the win
jingle a generic major run on purpose).

**Lesson:** "do the licensing right" for a fan recreation is not a coding task
with a clean answer - it is choosing, honestly, between tolerated-homage and
de-brand, and documenting the choice. Not legal advice; just the shape of the
decision.

---

## Appendix: the numbers we settled on

| Constant | Value | Note |
| -------- | ----- | ---- |
| Board | 28 x 31 tiles | tunnel row 14 |
| Frightened | 6 s | warning blip at 2 s remaining |
| Death animation | 0.3 s | short, for legibility (arcade is longer) |
| Pen release | pinky 0 / warden 10 / inky 30 / clyde 60 dots | force-out after 4 s |
| Clyde flip | 8 tiles | pursue vs scatter |
| Coordinated stations | lookahead 5, ring snap 6 | |
| Extra life (1UP) | 10,000 | once per game |
| Generator | wall density 0.72, mulberry32 | spanning forest, reseed up to 24x |
| Score popup | 0.9 s, size ~ log10(amount) | green "1UP" label variant |

All tunables live in [`constants.ts`](../../src/experiments/pacman/constants.ts);
change the game there, not in the logic.
