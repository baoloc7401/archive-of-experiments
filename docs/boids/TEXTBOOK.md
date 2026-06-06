# Boids Flocking - Textbook & Real-World Research

Reference code (modular - the React component is thin glue):
[`simulation.ts`](../../src/experiments/boids/simulation.ts) (the engine: grid, steering, forces, predators, snapshot),
[`render.ts`](../../src/experiments/boids/render.ts) (all canvas drawing),
[`flock.ts`](../../src/experiments/boids/flock.ts) (SoA flock + formations),
[`palette.ts`](../../src/experiments/boids/palette.ts) (theme tokens),
[`constants.ts`](../../src/experiments/boids/constants.ts) (tunables + bounds),
[`components/BoidsCanvas.tsx`](../../src/experiments/boids/components/BoidsCanvas.tsx) (refs, effects, rAF loop, pointer),
[`components/OrderChart.tsx`](../../src/experiments/boids/components/OrderChart.tsx) (the order-parameter sparkline).
Roadmap of shipped/skipped work: [`IMPROVEMENTS.md`](./IMPROVEMENTS.md).

This is the research record for the boids experiment: Reynolds' three-rule
flocking model, how faithfully we model it, and the things that only became
obvious once it was running on a real canvas with a real edge. The algorithm is
famously short; the surprises are all in the details - the topology of the
stage, what "seeing emergence" actually requires, and what it takes to keep
thousands of agents at 60fps. Findings accumulated while building and debugging.

---

## 0. The single most important finding

> **A wrapping (toroidal) stage quietly breaks two halves of the model unless
> you fix them deliberately: neighbor *distance* must wrap, and cohesion must be
> built from *relative* offsets, not absolute positions. Wrap the screen but not
> the math and the flock shears apart at an invisible wall down the seam.**

The position wrap is the easy 90%: `if (x < 0) x += w` and the boid reappears on
the other edge. It looks finished. It is not, because two boids hugging opposite
edges are *visually adjacent* but **numerically `w` apart**, so:

- **Distance.** Raw `dx = b.x - o.x` says they are a full screen apart, so they
  never see each other. The flock develops a hard seam: cohesive masses tear in
  half as they cross it. Fix: every delta goes through `wrapDelta`, the shortest
  signed distance on a ring (`if (d > size/2) d -= size; else if (d < -size/2) d += size`).
- **Cohesion.** The textbook writes cohesion as "steer toward the average
  *position* of neighbors." Average absolute positions across the seam and the
  centroid lands in the **middle of the screen** - the empty side of the torus -
  so a flock straddling the edge gets yanked inward, the opposite of cohesion.
  Fix: accumulate the *relative* offset toward each neighbor (`cX -= dx` with the
  already-wrapped `dx`) and average that. The mean offset is a wrap-correct
  direction to the local center, no absolute coordinates involved.

The lesson generalizes: **on a torus there is no global "position," only
relative displacement.** Any rule phrased in absolute coordinates is a latent
bug. This is also why the edge-mode toggle (§7) threads a `wrap` flag through
`gatherInto` - in `bounce`/`avoid` the world is genuinely flat and deltas must
*not* wrap.

---

## 1. The model and our steering form

Reynolds (1987) gives each agent three local rules over the neighbors inside a
perception radius `r`. We implement them in `gatherInto` + `combineForces` +
`addSteer` ([`simulation.ts`](../../src/experiments/boids/simulation.ts)).

**Per-rule steering (Reynolds' "steer = desired - velocity").** Every rule
produces a *desired direction*, which `addSteer` turns into a force:

```
steer = setMag(desired, maxSpeed) - velocity      // align the desired speed, subtract current
if |steer| > MAX_FORCE: steer = setMag(steer, MAX_FORCE)   // clamp turn authority
acc += steer * weight                              // weighted into acceleration
```

`MAX_FORCE = 0.06`, `maxSpeed` default `3.4` px/frame. The clamp is what makes
boids *bank* into turns instead of snapping - turn authority is bounded, so the
flock has momentum.

**Integration** (per boid, per frame): sum the three rule forces plus any world
forces (§7) into `acc`; `v += acc`; clamp `|v|` to `maxSpeed`; **floor** `|v|`
to `MIN_SPEED_FRAC * maxSpeed` (0.2) so boids never stall; `p += v`; apply the
edge rule.

**Defaults that matter** (`DEFAULT_PARAMS`): `radius 64`, `separation 1.6`,
`alignment 1`, `cohesion 1`, `fov 300°`. Note separation is weighted *above*
alignment/cohesion by default - without that the flock collapses into
overlapping points (see §3).

---

## 2. The three rules, as implemented (and their fidelity)

| Rule | Desired direction in code | Fidelity note |
|---|---|---|
| **Separation** | Sum of `(b - o) / |b - o|²` over neighbors within `SEP_RADIUS_FACTOR · r` (0.55·r), i.e. weighted toward the *nearest* crowders | ✅* see below |
| **Alignment** | Average neighbor *velocity* | ✅ |
| **Cohesion** | Average *relative offset* toward neighbors (wrap-correct centroid direction) | ✅ rephrased for the torus (§0) |

**The separation-weighting nuance (a real finding).** The code accumulates
`(dx,dy) · (1/d²)`. A vector of magnitude `d` scaled by `1/d²` has magnitude
`1/d`, so per-neighbor influence falls off as inverse *distance* (the in-code
comment's "inverse-square" is loosely worded). But it almost doesn't matter:
`addSteer` immediately `setMag`s the summed vector to `maxSpeed`, so the exponent
never changes the force *magnitude* - it only changes how the summed *direction*
is biased toward close vs. far crowders. The clamp launders the weighting. Worth
remembering: in this steering formulation, distance-weighting inside a rule is a
direction-blending knob, not a strength knob.

**Separation acts on a smaller radius** than alignment/cohesion (0.55·r). Real
boids and most implementations do this: you want to match and gather over a wide
field but only shove off genuinely-too-close neighbors, or the flock can never
condense.

**Field of view (a deliberate realism touch).** A neighbor is ignored unless it
lies within the forward cone: `dot(heading, toNeighbor) ≥ cos(fov/2)·|v|·|to|`.
Default `fov = 300°`, i.e. a 60° rear blind spot - **not** the textbook's
implicit 360°. Narrow FOV produces visibly more lifelike, directional flocks
(followers trailing leaders) instead of an omnidirectional blob. The test is
skipped when `fov ≥ 359.5°` or when `|v|` is near zero (a stalled boid has no
defined heading - the same reason the min-speed floor exists).

---

## 3. Parameter intuition, as observed

The three weights look symmetric; they are not. The interesting regimes live in
**narrow bands**, which is why the experiment ships eight one-tap presets as a
guided tour rather than expecting anyone to find them by dragging six sliders.

- **Cohesion > separation, low alignment** → a tight wandering blob (`huddle`).
- **Alignment high, others modest** → the flock locks into one heading and
  marches (`lockstep`, `stampede`); the order parameter (§4) pins near 1.
- **Separation high, cohesion/alignment low** → gas, not flock (`scatter`,
  `swarm`); boids wander and dodge.
- **Balanced with a touch more alignment + a hair of separation** → the
  rolling, turning murmuration most people picture (`murmuration`, `vortex`).

Two stability fences fall out of building it:

- **Default separation is weighted up (1.6 vs 1.0).** Equal weights let cohesion
  win at close range and the flock implodes into a point; a little extra
  separation keeps spacing.
- **Min-speed floor (`MIN_SPEED_FRAC = 0.2`).** With only a `maxSpeed` clamp,
  opposing forces can cancel a boid's velocity to ~0; it then freezes and its
  heading (hence FOV and the order parameter) becomes undefined. Flooring the
  speed keeps the flock alive and the math well-defined. A small change with
  outsized effect on "feel."

---

## 4. Seeing emergence: the order parameter and heading colour

Flocking's whole point - global order from local rules - is **invisible if you
only watch dots move.** Two cheap instruments make it legible, and they agree:

- **Vicsek order parameter** `φ = |Σ (vᵢ / |vᵢ|)| / n`, computed in
  `computeSnapshot` over boids above a tiny speed (stalled boids excluded - their
  heading is noise). `φ = 0` is disordered, `φ = 1` is one shared heading. It
  rides on the telemetry and is sparklined by
  [`OrderChart.tsx`](../../src/experiments/boids/components/OrderChart.tsx) on a
  **fixed [0,1] axis** (not auto-scaled, unlike aco's convergence chart) - the
  curve's height *is* the alignment level, so nudging the alignment slider and
  watching φ climb is a direct cause→effect demo.
- **Heading colour.** Each boid is tinted by `hsl(headingAngle)`. An aligned
  flock collapses to a single colour band; a disordered one is a rainbow. This is
  the *same* fact as φ → 1, shown spatially. The two were built to corroborate
  each other, and they do: colour uniformity and the φ sparkline move together.

There is also a **rule-inspection overlay**: hovering a boid draws its radius
ring, its perceived neighbors, and the three steering vectors plus their
resultant as arrows. Crucially these arrows come from the *same*
`gatherInto`/`combineForces` the simulation runs (via `computeFocusForces`), so
they are the real forces, not a re-derivation that could drift. This is the
repo's recurring ethos (cf. aco's pheromone web, river-crossing's search
animation): *make the mechanism visible using the engine's own state.*

---

## 5. Scaling findings: O(n) neighbors, SoA, batched draw

The naive flock is `O(n²)` per frame (every boid checks every other). Reaching
the thousands a murmuration wants took three independent moves, each a finding in
its own right:

- **Uniform spatial grid** (`stepBoids`). Bin boids into cells of side `=
  radius`; a within-radius neighbor is then at most one cell away, so each boid
  scans only the wrapped 3×3 block. Buckets are a head/next `Int32Array` linked
  list - **zero per-boid allocation.** Collapses the inner loop to ~`O(n)` for a
  spread flock. *Gotcha found and fixed:* when the stage is too small for a 3×3
  grid (`GRID_MIN_CELLS`), the wrapped 3×3 block revisits the same cell and
  double-counts; the code falls back to exact brute force there (where the grid
  would buy nothing anyway).
- **Structure-of-arrays** (`Flock`). `x/y/vx/vy` as parallel `Float32Array`s
  allocated once at `MAX_COUNT = 2000`; changing the live count never
  reallocates, it grows/shrinks an active prefix. The steering helpers were
  rewritten to take primitives, not objects, so the same code serves the engine
  and the overlay.
- **Batched draw** (`render.ts`). Per-boid `save/translate/rotate/restore` is the
  real cost at scale, not the fills. Triangles are built with manual rotation (no
  canvas transform) into a small number of `Path2D` buckets - 24 by heading hue,
  or 2 by speed - then **one `fill()` per bucket.** Draw stays O(n)-build with a
  fixed ~24 draw calls at any count. *Deliberate tradeoff:* heading colour is
  quantized to 24 hues (15°); imperceptible in motion, and an aligned flock still
  collapses to ~one bucket, preserving the §4 colour↔order correspondence.

**Verdicts recorded, not pursued** (see IMPROVEMENTS.md Tier 4): a **Web Worker**
is unnecessary - after the grid the tick is O(n) and runs comfortably on the main
thread at 2000; the `fps` stat shows the headroom. A **quadtree** would be
*slower* here - queries are fixed-radius over a roughly-uniform flock, exactly
where a uniform grid wins (O(1) bucketing, no tree rebuild); quadtrees only pay
under wildly varying density, which flocking does not produce.

---

## 6. The engineering finding: the component is glue, the work is modules

The canvas component reached **~1340 lines** with simulation, rendering, palette,
and React wiring all tangled together, then was split into `simulation.ts` /
`render.ts` / `flock.ts` / `palette.ts`, leaving a ~390-line component that does
only React things (refs, effects, the rAF loop, pointer handlers, the imperative
handle). The lesson was promoted into the repo's [`CLAUDE.md`](../../CLAUDE.md):
keep simulation/render logic out of the component; split when a component passes
~300 lines, a function runs longer than a screen, a helper touches no refs/props,
or a block gets pasted twice (which is also why the three identical segmented
controls became one generic `SegRow`). The split is free at runtime and the
engine is now plain functions you could test or reuse without React.

A second wiring note worth keeping: **all mutable sim state lives in refs**
(`flockRef`, `worldRef`, `scratchRef`, `pointerRef`), never React state, so the
60fps loop never triggers a re-render. Only a throttled snapshot (`STATS_INTERVAL
= 250ms`) flows up via `onStats` to paint the telemetry. React owns the chrome;
the rAF loop owns the pixels.

---

## 7. The world layer: extensions and what they reveal

Beyond the three rules, the stage gained forces and entities. Each is one more
weighted steer folded into the same integration, which is the quiet payoff of the
steering formulation - new behaviors compose without touching the core.

- **Edge modes.** `wrap` (torus), `bounce` (reflect velocity on contact), `avoid`
  (a turn-from-wall steer inside `EDGE_MARGIN`, with a hard clamp as backstop).
  Only `wrap` wraps neighbor distance (§0).
- **Pointer tools.** `push` (hold to repel/attract within `PREDATOR_RADIUS`),
  `obstacle` (click to drop/remove discs; boids steer away with a rim-clamp so
  they never tunnel), `goal` (click to chain waypoints the flock migrates through,
  advancing when the flock *center* reaches one).
- **Autonomous predators.** Hawks seek the nearest boid slightly faster than it
  can flee (`HAWK_SPEED_FACTOR = 1.12`); boids flee within `HAWK_FLEE_RADIUS`. A
  caught boid **respawns at an edge** rather than being removed - a deliberate
  simplification that keeps the population constant and avoids SoA
  swap-compaction (true removal was judged not worth the bookkeeping for a toy).
- **Multiple species.** A `species` byte per boid; separation applies across all
  factions but alignment/cohesion only within a faction (`sameRules`). Emergent
  sorting and territories appear from that single asymmetry, with no
  predator-prey ranking needed.
- **Flow field.** A drifting layered-sine pseudo-noise field (`flowAngle`); boids
  steer toward the local current. It is *not* true Perlin/curl noise - three sines
  are cheaper and read the same in motion (rivers and eddies).
- **Light-painting trails.** Fade the previous frame instead of clearing, so the
  flock paints ribbons; gated behind reduced-motion, and the per-boid tail is
  suppressed in that mode. Plus PNG export via `canvas.toBlob`.
- **Density colour.** Tint by local neighbor count (already computed by the
  gather, stashed in `scratch.density`) on a cool→hot ramp - a live crowding
  heatmap.

---

## 8. Fidelity scorecard

| Aspect | Status | Note |
|---|---|---|
| Three rules (sep/align/cohesion) | ✅ | Reynolds' steer = desired - velocity, force-clamped |
| Cohesion definition | ✅* | rephrased as relative-offset average for toroidal correctness (§0) |
| Separation falloff | ✅* | `1/d²`-scaled vectors = inverse-*distance* blend; magnitude laundered by `setMag` (§2) |
| Neighbor distance on wrap | ✅ | `wrapDelta` shortest-path; the headline fix |
| Field of view | ✅ | forward cone, default 300° (rear blind spot) - richer than textbook 360° |
| Speed limits | ✅* | both a max clamp *and* a min floor (anti-stall), the floor being non-canonical |
| Neighbor search | ✅ | exact; uniform grid is an acceleration, identical results, brute-force fallback |
| Numerical integration | ✅* | explicit Euler at one step/frame; fine for a visual toy, not physically rigorous |
| Predator population | ✅* | respawn-on-catch, not death; population is constant by design |
| Flow field | ✅* | layered sines, not real Perlin/curl noise |

---

## 9. Where this is *not* a real flocking model

- **No physics.** No mass, drag, or true acceleration units; "force" is a
  per-frame velocity nudge and time is measured in frames, not seconds (only the
  flow field's drift is wall-clock scaled).
- **2D only.** Real boids/murmurations are 3D; there is no depth, no banking in
  pitch, no thermal soaring.
- **No sensing cost or latency.** Every boid reads exact neighbor state
  instantaneously; real animals have reaction time, noise, and occlusion.
- **Predators are not agents with goals** beyond "chase nearest"; no stamina,
  stooping, or flock-confusion modeling.
- **The order parameter is descriptive, not optimized.** Nothing in the sim tries
  to maximize φ; it just reports what the rules produce.

This is a teaching/observation model of *emergence from local rules*, not a
biological or aerodynamic simulation.

---

## 10. Further real-world context

- **Origin.** Craig Reynolds, "Flocks, Herds, and Schools: A Distributed
  Behavioral Model" (SIGGRAPH 1987). The three rules are unchanged 35+ years
  later; everything since is refinement (perception, obstacle avoidance, LOD).
- **Order parameter.** Borrowed from the Vicsek model (1995) of self-propelled
  particles, where the alignment-vs-noise phase transition is the central result.
  Our `φ` is the same quantity.
- **In practice.** Reynolds' steering behaviors underpin crowd and flock systems
  in games and film (the technique was used for bat/penguin swarms in *Batman
  Returns*); spatial-hash neighbor queries are standard in particle systems and
  real-time physics. The species/predator/flow extensions here echo how agent
  systems layer behaviors as weighted steers - the same compositional trick that
  makes the core loop extensible.
- **Performance shape.** The `O(n²)`→grid→SoA→batched-draw progression mirrors
  how any large-N agent sim is made real-time: fix the asymptotics (broad-phase),
  then the constants (memory layout), then the draw calls (batching).

---

*Maintained alongside the code. If the steering math changes, update §1-§2 and
the scorecard; if the edge/wrap handling changes, update §0 and §7; if the
rendering or scaling approach changes, update §5-§6.*
