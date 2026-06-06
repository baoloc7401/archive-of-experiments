# Boids Flocking - Improvement Roadmap

Reference (modular - the component is thin React glue):
[`simulation.ts`](../../src/experiments/boids/simulation.ts) (the engine: grid, steering, forces, predators, snapshot),
[`render.ts`](../../src/experiments/boids/render.ts) (all canvas drawing),
[`flock.ts`](../../src/experiments/boids/flock.ts) (SoA flock + formations),
[`palette.ts`](../../src/experiments/boids/palette.ts) (theme tokens),
[`constants.ts`](../../src/experiments/boids/constants.ts) (tunables + bounds),
[`components/BoidsCanvas.tsx`](../../src/experiments/boids/components/BoidsCanvas.tsx) (refs, effects, rAF loop, pointer),
[`components/Controls.tsx`](../../src/experiments/boids/components/Controls.tsx) (sliders + transport),
[`index.tsx`](../../src/experiments/boids/index.tsx) (page shell).

Sources: [Reynolds 1987, "Flocks, Herds, and Schools"](https://www.red3d.com/cwr/papers/1987/boids.html) ·
[Reynolds, Steering Behaviors](https://www.red3d.com/cwr/steer/) ·
[Shiffman, The Nature of Code ch. 5 (Autonomous Agents)](https://natureofcode.com/autonomous-agents/) ·
[Vicsek model (order parameter)](https://en.wikipedia.org/wiki/Vicsek_model)

Note: As we move down the implementations, update each entry's PROGRESS as
TODO / Doing / Done.

---

## What the Experiment Already Does

| Feature | Detail |
|---|---|
| Agent model | `Boid = {x, y, vx, vy}` in canvas px; flock held in a `boidsRef` array, never in React state |
| Three rules | Separation (inverse-square repulsion within `SEP_RADIUS_FACTOR · radius`), alignment (avg neighbor velocity), cohesion (steer to avg neighbor position) |
| Reynolds steering | Each rule: `setMag(desired, maxSpeed) - velocity`, clamped to `MAX_FORCE`, weighted, summed into acceleration (`addSteer`) |
| Integration | `v += a` (speed-clamped to `maxSpeed`), `p += v`, toroidal wrap at all four edges |
| Tunables | Count, neighbor radius, separation/alignment/cohesion weights, max speed - all live `Slider`s |
| Transport | `ControlBar` play/pause/step/reset; `step()` advances exactly one tick while paused |
| Live count change | `syncCount` adds/removes boids to match the slider without re-scattering the rest |
| Rendering | Heading-oriented triangles; fastest boids tint to `--accent2`; faint motion tail per boid |
| Telemetry | `count`, smoothed `fps`, `avgSpeed`, pushed up every `STATS_INTERVAL` ms |
| Reduced motion | Starts paused for reduced-motion users; decorative tails gated off, functional motion kept |
| DPR + resize | `ResizeObserver` (rAF-deferred) sizes the backing store; first measurement re-scatters the flock |
| Theme-aware | Palette re-read from CSS tokens on theme flip; repaints when idle |

**The baseline is a faithful, watchable Reynolds simulation.** Unlike the chess
engine there is no *strength* to chase; the improvement axis is **making the
emergence legible (seeing the rules act), behavioral breadth, and scaling the
flock** - not solution quality.

---

## Improvements

### Tier 1 - Highest Value (visibility + scale + correctness)

---

#### 1. Spatial hash grid for neighbor queries

PROGRESS: Done

**Shipped:** `stepBoids` in [`BoidsCanvas.tsx`](../../src/experiments/boids/components/BoidsCanvas.tsx)
now bins boids into a uniform grid with `cell = radius` (so a within-radius
neighbor is at most one cell away) and scans only the wrapped 3x3 block around
each boid. Buckets use head/next `Int32Array` linked lists, so the grid adds zero
per-boid allocation. The neighbor accumulation (`gatherInto`) and steering
(`combineForces`) are shared verbatim with the retained brute-force path, so the
two produce identical flocking - only the candidate set differs.

**What:** Replace the `O(n^2)` double loop in `stepBoids` with a uniform spatial
grid bucketed at the neighbor radius. Each frame: bin every boid into a cell of
side `radius`, then for each boid scan only its own cell plus the 8 neighbors.
Average work drops to roughly `O(n)` for an evenly spread flock.

**Why it matters:** The current loop is exact but quadratic - at the 400-boid
cap that is 160k pairs every frame. The grid is the single biggest lever for
raising `MAX_COUNT` (murmurations want thousands) without dropping frames, and it
is the prerequisite for most Tier 2 work.

**Gotcha found & fixed:** when the stage is too small to hold a `GRID_MIN_CELLS`
(3) grid in either axis, the wrapped 3x3 cell block revisits the same cell and
would double-count neighbors. The code falls back to the exact brute-force pass
in that case (small canvas or huge radius, where the grid buys nothing anyway).

---

#### 2. Toroidal (wrapped) neighbor distance

PROGRESS: Done

**Shipped:** `wrapDelta` computes the shortest signed delta on each axis, used by
`gatherInto` for the radius test, separation, and cohesion, and by the hover
pick. Cohesion was reworked to accumulate the *relative* offset toward each
neighbor (`-d`) rather than absolute positions, so the averaged center direction
is wrap-correct (averaging absolute positions across the seam would point the
wrong way). The decorative motion tail stays in screen space, as noted below.

**What:** Today positions wrap but neighbor *distance* is raw screen delta
(`dx = b.x - o.x`), so two boids straddling an edge are treated as far apart even
though they are visually adjacent across the seam. Compute the wrapped minimal
delta on each axis: `if (dx > w/2) dx -= w; else if (dx < -w/2) dx += w` (same for
`dy`), used for both the radius test and the steering directions.

**Why it matters:** Removes the invisible "wall" at the wrap seam - flocks
currently shear apart as they cross it. With wrapped distance the torus becomes
truly seamless, which is the whole point of edge-wrapping.

**Caveat:** The decorative motion tail in `draw()` should still be drawn in
screen space (a wrapped tail would streak across the canvas); only the *physics*
deltas wrap.

---

#### 3. Visualize the rules (radius + steering vectors)

PROGRESS: Done

**Shipped:** Hovering the canvas pins the nearest boid (`pickFocus`, within
`FOCUS_PICK_RADIUS`). `draw()` then overlays its neighbor radius ring, rings
around each perceived neighbor, and four arrows from the boid: separation
(`--wip`), alignment (`--accent2`), cohesion (`--accent`), and the heavier
resultant (`--text-hi`). Vectors come from `computeFocusForces`, which reuses the
exact `gatherInto`/`combineForces` math the simulation runs, so the arrows are
the real forces - scaled by `ARROW_GAIN` and capped at `2 * radius` for legibility.
A colour key sits under the stage; the overlay works while paused (the pointer
handler repaints when idle). All four labels are in i18n (`separation`,
`alignment`, `cohesion`, `resultant`) plus a `hover_hint`.

**What:** Let the user hover (or pin) a boid and draw: its neighbor radius ring,
its perceived neighbors highlighted, and the three steering vectors
(separation/alignment/cohesion) plus their weighted sum as colored arrows.

**Why it matters:** This is the educational headline and matches the repo ethos
(see river-crossing's search visualization, aco's pheromone web). Right now the
weights are abstract numbers; drawing the vectors *shows* why raising separation
blows the flock apart and why cohesion pulls it into a knot.

**Implementation sketch:** Add an optional `focusRef` (boid index under cursor).
In `draw()`, after the flock, stroke the radius circle and three arrows from the
focused boid using the per-rule vectors - `addSteer` would return them via an
out-param instead of folding straight into the accumulator.

**Caveat:** Keep it gated to a single focused boid; drawing rings for all 400
would be noise and a perf hit.

---

### Tier 2 - Behavioral Breadth

---

#### 4. Edge behavior toggle (wrap / bounce / steer-away)

PROGRESS: Done

**Shipped:** `EdgeMode = "wrap" | "bounce" | "avoid"` on `BoidParams`, picked via a
segmented control. The integration branch in `stepBoids` wraps, reflects velocity
on contact, or hard-clamps; "avoid" additionally adds a turn-from-wall steer
(`EDGE_AVOID_WEIGHT`) inside an `EDGE_MARGIN` band so boids bank away before they
reach the edge, with the clamp as a backstop. Crucially, neighbor distance only
wraps in "wrap" mode (the `wrap` flag threaded through `gatherInto`), so bounce
and avoid see a flat, bounded world.

**What:** Offer the three classic boundary policies as a control: toroidal wrap
(current), elastic bounce off walls, or Reynolds' "turn back" steering force near
the edges that keeps the flock in a bounded box.

**Why it matters:** Boundary topology visibly changes the emergent shape - wrap
gives an infinite-plane drift, the bounded box produces the swirling
"murmuration in a tank" look most people picture. Cheap to add, instructive to
contrast.

**Caveat:** The wrapped-distance work (#2) only applies to the wrap policy;
bounce/steer use plain screen-space deltas. Branch the integration on the policy.

---

#### 5. Predator / mouse interaction

PROGRESS: Done

**Shipped:** Press-and-hold on the stage makes the cursor a force source within
`PREDATOR_RADIUS` - boids flee it (`repel`) or chase it (`attract`), chosen by a
segmented toggle. The force is a weighted Reynolds steer scaled by proximity
(`PREDATOR_WEIGHT * (1 - d/R)`), applied during integration; a dashed reach ring
tinted by mode draws while held. Pointer capture keeps the drag alive off-canvas;
the rule-overlay hover is suppressed while disturbing so the two interactions do
not fight. Obstacle dropping with look-ahead avoidance is left as a follow-up.

**What:** A pointer-driven force: hold to attract or scatter the flock, or a
predator agent the boids flee (a fourth rule - flee any predator within a larger
radius, weighted high). Click to drop static obstacles they steer around.

**Why it matters:** Turns a passive demo into a toy. Evasion is also the most
visually dramatic emergent behavior (the flock splits and re-forms), and it
introduces a new steering rule cleanly on top of the existing three.

**Caveat:** Obstacle avoidance wants look-ahead (project velocity, steer if the
ray hits) rather than simple radial repulsion, or boids orbit obstacles instead
of clearing them.

---

#### 6. Field of view (perception angle)

PROGRESS: Done

**Shipped:** A `fov` slider (degrees) gates neighbors in `gatherInto`: a neighbor
counts only if `dot(heading, toNeighbor) >= cos(fov/2) * |v| * |toNeighbor|`. The
test is skipped at >= 360 (no blind spot) and when the boid's speed is near zero
(undefined heading), avoiding the stall edge case. The default is 300, and the
focus overlay draws the perception wedge so the blind spot is visible. Because
gating happens in the shared gather, the overlay's highlighted neighbor set
already excludes the blind spot for free.

**What:** Real birds do not sense flockmates directly behind them. Add a
perception half-angle slider; a neighbor only counts if it falls within that arc
of the boid's heading (`dot(normalize(toNeighbor), normalize(velocity)) > cos(fov)`).

**Why it matters:** A narrow FOV produces noticeably more lifelike, directional
flocks (followers trailing leaders) instead of the omnidirectional blob a 360
view gives. One dot product per neighbor - nearly free.

**Caveat:** At very narrow angles a stationary or near-stalled boid has an
undefined heading; fall back to 360 perception when `|v|` is below a threshold,
or add a small minimum speed (see Tier 4).

---

#### 7. Behavior presets

PROGRESS: Done

**Shipped:** `PRESETS` in [`constants.ts`](../../src/experiments/boids/constants.ts)
defines eight bundles - murmuration, schooling, swarm, lockstep, vortex, scatter,
stampede, huddle - each a `Partial<BoidParams>` (count + six rule params + fov)
applied in one tap via the existing `patch`/`onChange` path. Edge mode and pointer
mode are left untouched so a preset never overrides the user's boundary/interaction
choice. Rendered as pill chips; all names are in i18n. The chip whose fields still
match the live params shows a selected state (`aria-pressed` + highlight), and
dragging any of those sliders deselects it - so the chips double as a readout of
"am I on a preset or have I drifted off one".

**What:** One-tap weight bundles like aco's layout chips: e.g. "tight
murmuration", "loose schooling", "chaotic swarm", "lockstep". Each sets the six
params at once.

**Why it matters:** The interesting regimes live in narrow weight bands that are
fiddly to find by dragging six sliders. Presets are a guided tour of the
parameter space and a fast way to show the range of emergence.

---

### Tier 3 - Measurement & Polish

---

#### 8. Order parameter (polarization) + chart

PROGRESS: Done

**Shipped:** `emitStats` computes `phi = |sum(v_i / |v_i|)| / moving` over boids
with non-negligible speed (stalled boids have undefined heading, so they are left
out of the sum - the documented caveat). It rides on `BoidSnapshot.order` and
shows as a highlighted `Stat`. [`OrderChart.tsx`](../../src/experiments/boids/components/OrderChart.tsx)
sparklines the history on a *fixed* `[0, 1]` axis (with a dashed 0.5 guide), so
the curve height is the alignment level directly - nudge the alignment slider and
watch it climb toward 1. The page keeps a capped history (`ORDER_HISTORY_MAX`),
cleared on reset. Pairs naturally with heading-colour (#10): order -> 1 is the
moment the flock collapses to a single hue.

**What:** Compute the Vicsek order parameter `phi = |sum(v_i / |v_i|)| / n` - 0
when headings are random, 1 when the flock moves as one. Surface it as a `Stat`
and chart it over time like aco's convergence sparkline.

**Why it matters:** `avgSpeed` says how fast, not how *aligned*. The order
parameter is the canonical, literature-backed measure of flocking emergence and
makes the alignment slider's effect quantitative: nudge alignment up and watch
phi climb toward 1.

**Caveat:** Skip boids with near-zero speed in the sum (their heading is noise),
or phi reads artificially low when the flock stalls.

---

#### 9. Debug bridge (`buildReport`) [N/A]

PROGRESS: TODO

**What:** Add a copy-to-clipboard report like aco / river-crossing: params, stage
size + dpr, count, fps, avgSpeed, order parameter, and a small sample of boid
states. Paste-ready for debugging visuals back in chat (the repo's debug-bridge
workflow).

**Why it matters:** Consistency with the other experiments and the established
"paste the report back to Claude" loop for diagnosing motion/render issues that
are hard to describe in words.

**Note:** This text is a diagnostic dump - it stays English, exempt from i18n per
the house rules.

---

#### 10. Color by heading or cluster

PROGRESS: Done

**Shipped:** A `colorMode = "heading" | "speed"` toggle. In heading mode each boid
is filled `hsl(headingDegrees, 75%, L%)` where `L` is theme-aware (62 dark / 45
light) so hues read on either stage - the documented contrast caveat. An aligned
flock collapses to one colour band, which is exactly the order parameter (#8) made
visual; "speed" keeps the original fastest-tint-to-`--accent2` cue. Heading is the
default. The cheaper hue-wheel option was taken over grid cluster-colouring.

**What:** Tint each boid by heading (hue wheel) so coherent sub-flocks read as
solid color bands, or run a light connected-components pass on the grid (#1) and
color by cluster id.

**Why it matters:** Makes flock *structure* pop - splits, merges, and competing
sub-flocks are obvious at a glance instead of a uniform-color smear. The
heading-hue version is nearly free once #1 exists.

**Caveat:** Respect theme/contrast - a full-saturation hue wheel can fight the
stage on the light theme; clamp lightness to the palette.

---

### Tier 4 - Engineering / Performance (scaling push)

The grid (#1) unblocked the deferred scaling work, so this tier was taken as a
**full scaling push**: hold thousands of boids smoothly.

PROGRESS: Done (scaling); Web Worker + Quadtree deliberately Skipped.

**Shipped:**

| Item | Outcome |
|---|---|
| Structure-of-arrays | `Flock` in [`types.ts`](../../src/experiments/boids/types.ts) holds `x/y/vx/vy` as `Float32Array`s plus `count`/`capacity`. Buffers are allocated **once** at `MAX_COUNT`, so changing the live count never reallocates - it grows/shrinks the active prefix (`seed`/`syncCount`). The shared steering helpers (`gatherInto`/`addSteer`/`combineForces`) were reworked to take primitives, so `stepBoids` and the focus overlay still share one implementation. |
| Reusable scratch | A ref-held `Scratch` (`accX`/`accY`/`next` at capacity, `head` grown lazily) replaces the four per-tick typed-array allocations; `head` is cleared with `fill(-1, 0, cellCount)` each frame. |
| Higher cap | `MAX_COUNT` 400 -> 2000; the count slider picks it up automatically. |
| Batched draw | Triangles are built with manual rotation (no per-boid `save/translate/rotate/restore`) into a few `Path2D` buckets - `HUE_BUCKETS` (24) by heading, or 2 by speed - then one `fill()` per bucket. Tails batch into a single `stroke()`. Draw stays O(n) with a fixed handful of draw calls at any count. |
| Minimum speed floor | `MIN_SPEED_FRAC` (0.2) floors velocity after the max clamp, so boids never stall and FOV/order headings stay defined. |

**Deliberate tradeoff:** heading colour is quantized to 24 hues (15 deg) to make
the bucketed fill possible. Imperceptible in motion; bump `HUE_BUCKETS` if it ever
reads stepped. An aligned flock still collapses to ~1 bucket, preserving the
#8/#10 synergy.

**Skipped (verdicts stand, recorded so the call is explicit):**

| Item | Verdict |
|---|---|
| Web Worker for the sim | **Skip.** With the grid + SoA + scratch, the per-tick cost is O(n) and runs comfortably on the main thread at 2000; a worker adds serialization, state ping-pong, and cancellation complexity for no gain. The `fps` Stat surfaces the headroom - revisit only if a much higher cap stutters. |
| Quadtree instead of uniform grid | **Skip.** Queries are fixed-radius and the flock is roughly uniform, where a uniform grid is simpler and faster (O(1) bucketing, no tree rebuild); a quadtree only wins under wildly varying density, which flocking does not produce. |

---

### Tier 5 - Fun & Experiments

The sim is faithful, legible, and scales. This tier is pure play: the cool,
sandbox-y additions that make people lose ten minutes to it. All build on the SoA
flock, the grid, and the steering already in place.

---

#### 13. Flow field / wind (Perlin)

PROGRESS: Done

**Shipped:** `flowAngle` in [`simulation.ts`](../../src/experiments/boids/simulation.ts) is a layered-sine pseudo-noise field that drifts over time (`FLOW_DRIFT`); the `flow` slider weights a steer toward the local field direction. (Streamlines skipped - the motion reveals the current.)

**What:** A hidden vector field the boids ride - either a uniform "wind"
(angle + strength sliders) or a Perlin/curl-noise flow field that slowly drifts.
Add it as one more steering force toward the field's local direction. Optional
faint streamlines drawn behind the flock to reveal the current.

**Why it's cool:** Turns flat flocking into rivers and eddies; the murmuration
visibly surfs invisible currents. The single highest "whoa" per line of code.

---

#### 14. Obstacles

PROGRESS: Done

**Shipped:** The `obstacle` pointer tool drops a disc on click (click an existing one to remove it). `stepBoids` adds a proximity-scaled steer-away within `OBSTACLE_MARGIN` plus a rim-clamp so boids never tunnel through. (Drag-to-move skipped; click-remove covers editing.)

**What:** Click to drop circular obstacles (drag to move, click to remove) the
flock streams around via look-ahead avoidance (project velocity; if the ray hits
a disc, steer along the tangent). Completes the deferred half of #5.

**Why it's cool:** Streaming a 2000-strong flock around pillars is mesmerizing,
and it makes the steering feel physical. Pairs with `avoid` edges for a real arena.

---

#### 15. Multiple species / factions

PROGRESS: Done

**Shipped:** A `species` `Uint8Array` on the `Flock` and a `speciesCount` slider (1-4). `gatherInto` applies separation to all neighbors but alignment/cohesion only to same-species (`sameRules`); when active, bodies are coloured by faction hue (overriding the colour mode). Predator-prey ranking skipped - sorting/territories emerge from the rules alone.

**What:** 2-3 tinted sub-flocks that align/cohere only with their own kind but
separate from everyone. A per-boid `species` byte (extra SoA array); gather skips
alignment/cohesion across species. Optionally a predator-prey ranking so one
species flees another.

**Why it's cool:** Emergent sorting, territories, and chase scenes from one extra
field. Reads instantly with the existing per-boid color.

---

#### 16. Autonomous predators + population

PROGRESS: Done

**Shipped:** A `predatorCount` slider (0-5) spawns hawks in `world.predators`; `updatePredators` steers each toward its nearest boid at `HAWK_SPEED_FACTOR`, boids flee within `HAWK_FLEE_RADIUS`, and a caught boid respawns at a random edge. Drawn larger in `--wip` with a faint danger ring. Respawn-on-catch was chosen over true removal to avoid SoA swap-compaction and keep the population stable.

**What:** A few AI "hawks" that seek the nearest boid; boids gain a flee force
within a danger radius; a caught boid is removed (or respawns after a beat).
Surface live population as a Stat / second chart line.

**Why it's cool:** Boom-bust population dynamics and the flock tearing open to
dodge a hunter - the most dramatic emergent behavior on offer.

---

#### 17. Waypoint / goal seeking

PROGRESS: Done

**Shipped:** The `goal` pointer tool appends waypoints to `world.goals`; `stepBoids` adds a weak `GOAL_WEIGHT` seek toward the active one and advances `goalIndex` (looping) once the flock center is within `GOAL_REACH`. Drawn as a dashed path with the current waypoint highlighted. The `clear` button removes obstacles + goals.

**What:** Click to set an attractor the whole flock migrates toward; chain clicks
into a tour it follows in order. A weak global seek force toward the active goal.

**Why it's cool:** Lets you choreograph the swarm - draw a path and watch the
flock flow along it while still flocking.

---

#### 18. Light-painting trails + PNG export

PROGRESS: Done

**Shipped:** A `trails` toggle makes `drawScene` fade the previous frame (`fillRect` at low alpha) instead of clearing, painting glowing ribbons; the per-boid tail is suppressed in that mode and the fade is gated behind reduced-motion. The `save png` button calls `canvas.toBlob` and downloads `boids.png`.

**What:** A "trails" view that fades the previous frame instead of clearing (long
exposure), so the flock paints glowing ribbons. An "export frame" button saves the
canvas to PNG (`canvas.toBlob`). Gate the fade behind reduced-motion.

**Why it's cool:** Instant generative art; people will want to screenshot it. Near
free given the draw loop already owns the clear.

---

#### 19. Startup formations

PROGRESS: Done

**Shipped:** `placeFormation` in [`flock.ts`](../../src/experiments/boids/flock.ts) lays the flock out as scatter / ring / grid / clumps / point, chosen by the `formation` segmented control (re-seeds on change, and applied at the correct size on first measurement).

**What:** Seed options beyond random scatter - ring, grid, two clumps, a single
point burst - chosen at reset. Just different `setBoid` initial positions.

**Why it's cool:** Watching an ordered grid melt into a flock (or two clumps
merge) is a tiny, satisfying experiment in its own right.

---

#### 20. Shareable URL config [N/A]

PROGRESS: N/A (skipped by request - kept out to limit surface area and bloat)

**What:** Encode the live params in the query string (debounced) and read them on
load, so a tuned vibe is a copy-pasteable link. Mirrors the repo's route-param
habit (pathfinding's `:screen`).

**Why it's cool:** "Look at this one" becomes a URL. Turns presets into an
open-ended, shareable space.

---

#### 21. Density coloring

PROGRESS: Done

**Shipped:** A `density` colour mode. `stepBoids` writes each boid's neighbor count into `scratch.density`; `drawScene` buckets them onto a cool->hot ramp (`DENSITY_MAX`), so dense cores glow hot and lone scouts stay cool.

**What:** A third `colorMode` that tints each boid by local neighbor count (the
gather already has it) on a cool->hot ramp - a live crowding heatmap.

**Why it's cool:** Makes the *structure* of separation visible: dense cores glow
hot, lonely scouts stay cool. Cheap, since the neighbor count is already computed.

---

*Maintained alongside the code. When an item ships, flip its PROGRESS to Done and
fold the lasting lessons into a TEXTBOOK.md; this file tracks intent, the textbook
records what was learned.*
