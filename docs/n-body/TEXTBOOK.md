# N-Body Gravity - Textbook & Real-World Research

Reference code:
[`physics.ts`](../../src/experiments/n-body/physics.ts) (integrators, merging, energy),
[`octree.ts`](../../src/experiments/n-body/octree.ts) (the Barnes-Hut tree),
[`presets.ts`](../../src/experiments/n-body/presets.ts) (the 12 scenes / initial conditions),
[`constants.ts`](../../src/experiments/n-body/constants.ts),
[`renderer.ts`](../../src/experiments/n-body/renderer.ts) (WebGL2 glow + world-space trails),
[`components/NBodyCanvas.tsx`](../../src/experiments/n-body/components/NBodyCanvas.tsx) (rAF loop, camera).

This is the research record for the 3D N-body gravity experiment: the canonical
physics, how faithfully we model it, and - the part that earned its keep - **what
broke when we tried to make particular gravitational systems behave.** The force
calculation (Barnes-Hut) was the easy part. The genuine research was in the *time
integration*, and in three scenes that each ran aground on the same rock from a
different angle: a three-body problem, a solar system with moons, and a black
hole. Findings accumulated while building and debugging.

---

## 0. The single most important finding

> **In a fixed-global-timestep N-body integrator, the hard limit is not the
> number of bodies - Barnes-Hut handles that - it is the *ratio of the fastest
> local orbital timescale to the slowest*. Every "a body suddenly shot off into
> space" bug in this experiment was the same disease: a close, fast subsystem
> whose dynamical time fell below the global step, so the discrete integrator
> either failed to resolve it or overshot a near-singular pericentre, injected
> spurious energy, and slingshot a body to infinity.**

We hit this three separate times, each looking like a different bug:

- **Three-body** (§5.1): close encounters between comparable masses transfer
  energy; one body escapes while the other two tighten into a binary. *The
  ejection is real physics*, not a numerical artefact - and it happens even
  though the system is gravitationally bound.
- **Solar system with moons** (§5.2): a moon's period is ~100x shorter than the
  outer planets'. No single global step resolves both; the moons strip
  **seed-dependently** at any step we tried. This killed the moons entirely.
- **Black hole** (§5.3): a point mass is singular. A body diving at it gains
  unbounded speed; the discrete step jumps clean across the centre, conserving
  nothing, and the body is flung out at thousands of times its arrival speed.

The fix is always the same family of moves: **resolve the fast timescale (smaller
step), remove the singularity (soften / cap the force), or change the
configuration so the fast subsystem never forms (hierarchy, capture radius).**
Real N-body codes solve this with *individual / block timesteps* and
*regularization* (§11); a teaching sim with one global leapfrog step cannot, and
that boundary is the experiment's deepest lesson.

---

## 1. The model: Newtonian gravity, softened

Each body *i* feels the sum of pairwise inverse-square attractions:

```
            G · m_j · (x_j − x_i)
a_i  =  Σ  ─────────────────────────          (Plummer-softened)
        j≠i   (|x_j − x_i|² + ε²)^(3/2)
```

Implemented in [`physics.ts`](../../src/experiments/n-body/physics.ts) (`directForces`)
and [`octree.ts`](../../src/experiments/n-body/octree.ts) (`bhForces`). Notes on
fidelity:

- **Softening ε** (the `softening` slider, `0.002…0.08`) is the **Plummer**
  form: it replaces `1/r²` with `1/(r²+ε²)` so a close pass feels a *finite*
  peak force instead of a singularity. This is standard in collisionless
  stellar dynamics (you are modelling a smooth mass distribution, not literal
  point particles), and here it is also the main knob keeping close encounters
  numerically survivable. **ε is physics, not a fudge** - but we lean on it
  harder than a research code would, because our timestep is fixed (§0, §3).
- **G** is a slider (`gravity`, base 1); units are arbitrary, chosen so a scene
  lives in a ~unit sphere and a circular orbit at r = 1 around unit mass takes
  2π sim-seconds.
- **Potential energy** is accumulated in the *same* pass as the force (the
  `√` is already paid), so the total-energy and energy-drift readouts cost
  nothing extra. Energy drift is the experiment's honesty meter (§3).
- **Structure-of-arrays, zero per-frame allocation.** Positions/velocities are
  `Float64Array` (gravitational dynamics compounds rounding error fast in tight
  orbits); the renderer copies into `Float32` for the GPU.

---

## 2. Force calculation: Barnes-Hut octree

For `n` bodies, the direct sum is `O(n²)`. **Barnes-Hut** ([`octree.ts`](../../src/experiments/n-body/octree.ts))
builds an octree, computes each cell's centre of mass, and when a cell is "far
enough" (`size / distance < θ`) treats the whole cell as one point mass -
`O(n log n)`. The **`theta` slider** is the exactness↔speed dial: `θ = 0` forces
exact direct summation; higher θ lumps more aggressively.

We switch to the tree only when `θ > 0 && n > 64` (`LEAN_DIRECT_LIMIT`); below
that the direct sum wins and is exact (this is why the small locked scenes -
`figure8`, `threebody`, `solar` - run at θ = 0 / direct and get textbook forces).

Three findings the tree forced into the open (all already fixed in code):

1. **Hoist the pool arrays into locals.** The tree is a struct-of-typed-arrays
   node pool (`comX/Y/Z/M`, `half`, `child`, …). Reading them through the object
   (`t.comX[...]`) in the hot traversal loop was ~2x slower than copying the
   references to locals before the loop. Property access is not free in a
   million-iteration inner loop.
2. **Theta-test the body's own leaf, or eval count balloons ~2.5x.** A leaf cell
   containing the query body includes that body in its centre of mass. If you
   skip the opening test for leaves (a common shortcut), every body keeps
   self-interacting through its own leaf's COM. We store a per-body `leafOf` and
   keep the *own* leaf exact (skip its COM) while still θ-testing other leaves.
3. **Barnes-Hut legitimately breaks Newton's third law.** The force on *i* from a
   lumped cell is not equal-and-opposite to the force the cell's members feel
   from *i*, so total momentum drifts (~1e-3 over long runs at θ = 0.7). Only
   θ = 0 is exactly antisymmetric. This is a property of the approximation, **not
   a bug in merging** - worth knowing before you go hunting for a leak.

---

## 3. Time integration: leapfrog vs Euler, and step vs speed

### 3.1 The two integrators (the teaching contrast)

`substep()` in [`physics.ts`](../../src/experiments/n-body/physics.ts) implements both:

- **Leapfrog (kick-drift-kick), the default.** Symplectic: it conserves a
  *shadow* energy exactly, so the true energy oscillates within a bounded band
  forever - orbits do not spiral. We reuse the previous substep's closing
  acceleration for the next opening kick, so it costs one force pass per step.
- **Explicit Euler.** Advances position and velocity on stale data. It
  systematically *injects* energy: orbits visibly spiral outward and the drift
  stat climbs without bound. **We keep Euler on purpose** - the side-by-side
  with leapfrog, watching the drift readout, is the clearest possible argument
  for why symplectic integrators exist. (Flip the integrator on the `figure8`
  scene to watch a perfect braid tear itself apart.)

### 3.2 The finding: integration fidelity is not playback speed

The substep `h` (`SUBSTEP = 0.016` sim-s) is **physics fidelity**: how finely the
orbit is sampled. `timeScale` is **playback speed**: how much sim-time passes per
real second. We conflated them at first, and it bit twice:

- A naive accumulator runs `floor(dt·timeScale / h)` substeps per frame. At
  `timeScale < 1` that is often **zero** substeps most frames, so slow-motion
  looked like a 6-fps stutter, not smooth slow-mo.
- The first fix - "at `timeScale < 1`, take one substep of size `dt·timeScale`" -
  *accidentally coupled fidelity to speed*: slowing down secretly refined the
  integration. That hid the real problem until `timeScale` became a persisted
  user setting (§7) and scenes that had relied on a low default `timeScale` for
  their fine step suddenly exploded when it defaulted to 1.

The resolution (`advance()`): a single accumulator stepping at `h = p.substep ??
SUBSTEP`, where **`substep` is a per-scene physics property** independent of
`timeScale`. A higher `timeScale` just takes *more* substeps per frame (capped at
`MAX_SUBSTEPS_PER_FRAME = 6` so a stalled tab drops sim-time instead of
snowballing); a sub-step sliver still advances when a frame's sim-time is below
one `h`, keeping slow-mo fluid. Scenes that need a fine step now say so
explicitly (`solar` and `blackhole` set `substep: 0.008`), and `substep` resets
on every scene switch while `timeScale` persists. **Separating the two is what
made the look-settings persist safely.**

---

## 4. Collisions / merging (accretion)

With `merging` on, the force pass also collects pairs closer than the sum of
their radii; `applyMerges()` combines each pair into the lower index (conserving
mass and momentum, inelastic), compacts the structure-of-arrays prefix, and
remaps indices. Two non-obvious points:

- **Merging is inelastic, so it removes kinetic energy.** Left alone, that loss
  would show up in the drift stat as if the *integrator* were leaking. So a merge
  **recaptures the energy baseline `e0`** - the drift readout measures integrator
  error, not the (deliberate) accretion loss.
- **The followed body can be merged away.** The camera's follow index lives in a
  mutable `FollowBox` that `applyMerges()` remaps to the absorbing body, so
  "ride along" survives an accretion event instead of snapping to the origin.

---

## 5. The scenes as gravitational regimes (the core research)

The 12 presets are not decoration; each isolates a different gravitational
behaviour, and three of them are where the real findings live.

| Scene | Regime | θ | merge | notable |
|---|---|---|---|---|
| collision | two galaxies merging | 0.7 | - | tidal tails, ejected stars (chaotic by nature) |
| cluster | Plummer sphere | 0.7 | - | virial equilibrium |
| **solar** | Kepler orbits | 0 (direct) | - | **moons removed - see §5.2** |
| belt | star + dense asteroid ring | 0.6 | - | the old "solar" before the rename |
| trojans | restricted 3-body | 0.5 | - | L4/L5 tadpole libration |
| binary | binary star + disk | 0.6 | - | circumbinary orbits |
| figure8 | Chenciner-Montgomery | 0 | - | the *stable* periodic 3-body |
| **threebody** | bound hierarchical triple | 0 | - | **does not eject - see §5.1** |
| disk | accretion disk | 0.7 | ✓ | dust onto a heavy centre |
| stream | tidal disruption | 0.7 | - | a sheared stellar stream |
| **blackhole** | point sink | 0.7 | ✓ | **capped singularity - see §5.3** |
| cloud | cold collapse | 0.7 | ✓ | gravitational collapse to a disk |

### 5.1 Three-body: a bound system still ejects a body

The user's intuition - *"gravity only pulls, so three bodies should dance forever,
not shoot apart"* - is the single most common misconception about the three-body
problem, and disproving it took three attempts.

**The physics.** In a close triple encounter, energy is exchanged: one body is
slingshot outward (stealing kinetic energy) while the other two fall into a
*tighter* binary (releasing it). Total energy stays negative, the system is
"bound," **yet one body escapes to infinity.** This is the *generic* outcome of
the chaotic equal-mass three-body problem, not a rare one.

**What does and doesn't stay bound** (researched, then numerically verified):

- A perturbed-equilateral / "chaotic" equal-mass triple ejects within seconds-to-
  minutes. Tried it, it ejected, exactly as theory predicts.
- The **figure-8** (Chenciner-Montgomery) is the *only* well-known equal-mass
  periodic orbit proven **linearly stable** (and KAM / Nekhoroshev stable). It is
  its own scene.
- The Šuvakov-Dmitrašinović choreographies (butterfly, moth, yin-yang) are real
  closed loops but **linearly unstable** - in a numerical integrator they drift
  off the orbit and eject. (We attempted to pull their initial conditions via the
  sci-hub MCP server; its DOI lookup worked but did not have the relevant PRL /
  AJP / Li-Liao papers.)

**The solution that holds: a hierarchical triple.** A tight, fast inner binary
(two 0.4-mass stars, separation 0.2) plus a distant third body (0.5 mass) on a
**wide, eccentric** outer orbit (semi-major 1.0, e = 0.3, separation ratio ~5,
inner plane tilted 28° - below the 39° Kozai threshold). The inner pair whirls
~9 times per outer lap; the eccentric outer body swings in and back out, so it
genuinely *dances* without the close encounter that would eject it.

**Verified, not asserted.** A throwaway `tsx` harness (§6) integrated the real
ICs: e = 0.3 stays bound over **10 000 sim-seconds with 0 % energy drift**, even
under simulated frame-jank; e ≥ 0.5 ejects a body at ~150 s (drift +1610 %). The
margin is the deliverable.

### 5.2 The solar system, and why it has no moons

The request was "the Sun, the eight planets, and their moons." We built moons,
tested them exhaustively, and **removed them** - a hard-won negative result.

**Why moons cannot work here.** Two compounding problems at realistic mass
ratios:

1. **Hill spheres are tiny.** A moon is only bound within
   `R_H = a·(m / 3M)^(1/3)`. For Earth that is **≈ 0.0087** (we first
   *mis-estimated* it ~3.5x too large at 0.031, which is what put the initial
   moons outside their stable zone). A moon must sit well inside `R_H`, so its
   orbit is sub-pixel against a scene that spans ~2 units - invisible unless you
   follow the planet and zoom.
2. **The timescale spread is unintegrable with one global step.** A Jupiter-moon
   period is ~0.05 s; Neptune's year is ~6.5 s - a ratio over 100. A single
   global leapfrog step that resolves the moon would make the whole sim crawl,
   and *even then* the moons strip **seed-dependently**: at 0.1 R_H with
   `h = 0.001` one random seed stayed bound 600 s and another ejected at 68 s.
   That is §0 in its purest form.

Exaggerating planet masses to enlarge the Hill spheres (so moons could be visible
*and* deeper-in) was tried and rejected: a Jupiter heavy enough to host a visible
moon perturbs Saturn by ~30 %, wrecking the clean Keplerian look that makes it
read as a solar system.

**The honest result:** `solar` is the Sun + 8 planets, locked (`SOLAR_COUNT = 9`),
direct-summed (θ = 0, exact), `substep 0.008`, `softening 0.002` - verified stable
with 0 % drift. Stable, visible moons would need a *dedicated isolated*
planet+moons scene (one heavy planet, no others to perturb it), which is the
hierarchical case of §5.1 and would integrate fine.

### 5.3 The black hole: you cannot integrate a singularity

First attempt: a heavy point mass (4) with infalling plunge orbits. Bodies were
flung to **distance ~6900** with **+330 % energy** - a catastrophic failure that
is, again, §0. A `1/r²` point force is singular; a body diving at it gains
unbounded speed, and a discrete timestep simply *jumps across* the centre - at
pericentre such a body moves further in one substep than the entire core region -
conserving nothing and emerging as a slingshot.

**The fix is to remove the singularity, not to shrink the step.** The hole gets a
**large capture radius** (`b.radius[0] = 0.06`, overriding the mass-derived value)
together with a **matching softening** (`0.05`). Now the central force is *capped*
over the capture zone rather than singular: infalling matter is swallowed (merge)
at a finite speed instead of being slung back out. Mass is a moderate 2.5 (a
giant point mass needs absurd speeds nearby), the disk starts at r = 0.2 (clear of
the soft core), and 30 % of bodies are put on eccentric infall whose pericentre
dips into the capture radius. Verified: bounded (max distance ~1.9), ~half the
disk consumed over 200 s, no ejections.

Generalised: **to make matter fall into a point sink and *stay*, cap the force
(softening ≥ capture radius) so the integrator never sees infinity.**

---

## 6. The numerical-verification methodology

The decisive tool for every §5 finding was a **throwaway `tsx` harness** that
imports the real engine (`advance`, `captureBaseline`, `seed`), runs a scene for
thousands of sim-seconds at the actual settings, and reports the **maximum body
distance from the origin** and the **energy drift**. It converted a subjective
report - *"they shoot away"* - into a measurable boundary:

- It proved the hierarchical triple bound to 10 000 s and located the e ≥ 0.5
  ejection cliff (§5.1).
- It proved the solar moons strip **seed-dependently** across a full sweep of
  Hill-fractions and substeps - the evidence that they were unfixable, not just
  untuned (§5.2).
- It proved the black hole bounded after the capture-radius fix (§5.3).

The harnesses are never committed (they import from `src/` and are deleted after
use), but the methodology is the point: **for a physics sim, "looks wrong" is a
hypothesis; integrate it headless and measure energy + extent to get a verdict.**
This is the offline complement to the in-app **debug report** (the copyable
telemetry panel: params, energy, drift, evals, fps, GPU string), which bridges
*runtime* state back when the assistant cannot see the canvas.

---

## 7. Rendering & interaction findings

The renderer ([`renderer.ts`](../../src/experiments/n-body/renderer.ts)) is a
hand-rolled WebGL2 point pipeline (no dependencies). The findings worth keeping:

- **World-space trails, not screen-space accumulation.** The obvious trail trick
  (`preserveDrawingBuffer` + a translucent fade quad each frame) **smears when
  you orbit the camera** - the trail is painted in screen space and rotating the
  view drags it across the screen. The fix is to store trails as *geometry*: a
  ring of the last `TRAIL_K = 128` world positions per body in a float texture,
  sampled every `0.064` sim-seconds, drawn with a single vertex-pulling `LINES`
  call. The paths now re-project correctly under camera motion and freeze in
  place when paused. The trail slider is in **sim-seconds** (0-8), so a trail is a
  *span of motion*, not of wall-clock.
- **Use `RGBA16F`, not `RGBA32F`, for the history texture.** `RGBA32F` is not
  guaranteed color-renderable in WebGL2 without `EXT_color_buffer_float`; using it
  unguarded produced a silent dead-on-arrival texture and a still frame.
  `RGBA16F` is core-guaranteed, and a `Float32` upload auto-converts. Half-float
  has ample precision for positions in the ±30-unit starfield.
- **Two-term glow, theme-aware blending.** Each body is a bright Gaussian core
  inside a wide faint halo, additively blended on dark themes. On *light* themes
  additive blending washes out to nothing, so we switch to premultiplied-alpha,
  push alpha ~2.6x, halve the halo, and swap the mass colour ramp to ink-dark.
- **The dead-context fallback (Edge "enhanced security", VSCode Simple Browser).**
  `getContext("webgl2")` can return a context that is **lost on arrival** -
  every call silently no-ops and nothing renders, with no error. We check
  `gl.isContextLost()` *at creation and on every draw* and surface loss/restore
  through a callback to an overlay notice (the canvas stays mounted so a restored
  context resumes without a remount).
- **The dev-only still-frame.** React StrictMode double-invokes the renderer
  effect in development; the first loop's `requestAnimationFrame` must be
  cancelled in cleanup *before* the renderer is disposed, or the remounted
  renderer races a dangling loop and the canvas freezes. (Not visible in
  production, which is why it was confusing.)
- **The rAF loop parks itself** when nothing is animating (running / entry-fade /
  drag-inertia / follow-settle all quiet) and is re-woken on any param or pointer
  event - so a paused, settled scene costs zero frames.

---

## 8. Fidelity scorecard

| Aspect | Status |
|---|---|
| Newtonian `1/r²` pairwise gravity | ✅ |
| Plummer softening | ✅ (also load-bearing for stability, §1) |
| Barnes-Hut `O(n log n)` with θ opening angle | ✅ canonical |
| Exact direct summation at θ = 0 | ✅ |
| Symplectic leapfrog (KDK) | ✅ |
| Explicit Euler (for contrast) | ✅ deliberately energy-leaking |
| Energy / momentum diagnostics | ✅ (drift is the honesty meter) |
| Inelastic merging (mass + momentum conserved) | ✅ |
| Fixed **global** timestep | ✅* no individual/block timesteps (§0, §11) |
| Figure-8 stability | ✅ exact ICs, θ = 0 |
| Moons in the solar system | ❌ removed - unintegrable at this fidelity (§5.2) |
| Collision/Trojans ejecting bodies | ✅* physically real chaos, not a bug |

---

## 9. Where this is *not* a real N-body simulation (scope boundary)

- **No individual or block timesteps.** A single global step is the experiment's
  defining limitation (§0); it is what forbids moons and forces softening to do
  double duty.
- **No regularization** (KS / Burdet-Heggie) for close encounters - the standard
  way real codes integrate tight binaries and near-collisions without softening.
- **Softening replaces collisions.** Bodies are smooth mass blobs; there is no
  real contact physics. "Merging" is a crude accretion stand-in, not a collision
  model.
- **Newtonian only.** No general relativity - so the "black hole" is a capped
  Newtonian point sink with an event-horizon-shaped capture radius, not a
  Schwarzschild metric. No precession of Mercury, no ISCO, no light bending.
- **Single precision on the GPU, double on the CPU.** Dynamics run in `Float64`;
  only the render upload is `Float32`.
- **`MAX_COUNT = 16384`.** Comfortably interactive to a few thousand bodies;
  physics, not drawing, is the ceiling (~7 ms/substep at 4k, ~17 ms at 8k, θ 0.7).

---

## 10. Further real-world context

- **Tree codes & FMM.** Barnes-Hut (1986) is the `O(n log n)` workhorse we use;
  the Fast Multipole Method (Greengard-Rokhlin) reaches `O(n)` with multipole
  expansions and is standard in large cosmological runs (GADGET, etc.).
- **Individual / block timesteps** are how production collisional codes
  (NBODY6, REBOUND's IAS15, etc.) handle the §0 problem we cannot: each body (or
  each tightly-bound pair) advances on its own step, so a fast moon is integrated
  finely without slowing the outer planets. This is precisely the missing
  capability that doomed our moons.
- **Symplectic integrators in practice.** Solar-system integrations over billions
  of years use symplectic *maps* (Wisdom-Holman) that split the Keplerian and
  perturbation parts analytically - far better than our brute leapfrog for nearly-
  Keplerian systems, and another reason real planetary work doesn't use a single
  fixed leapfrog step.
- **Regularization** (Kustaanheimo-Stiefel) transforms the singular `1/r²` near a
  close pass into a smooth oscillator, letting codes integrate genuine near-
  collisions *without* softening - the principled version of our §5.3
  capture-radius hack.
- **The three-body problem** is genuinely unsolvable in closed form (Poincaré);
  its modern story is the *discovery* of periodic orbits (figure-8, 2000;
  hundreds of choreographies since) and the statistical theory of ejections,
  which is the physics of §5.1.

The pedagogical throughline: gravity's force law is simple and the many-body
*forces* are a solved engineering problem. The difficulty - and the reason this
experiment kept "shooting bodies away" - is **time**: integrating a system whose
parts evolve on wildly different clocks. That is the real subject of N-body
research, and the boundary this teaching model makes visible by running into it.

---

*Maintained alongside the code. If the integrator, the `substep`/`timeScale`
split, the merge/energy bookkeeping, or any of the §5 scene parameters change,
update §3-§5 and the §8 scorecard.*
