# Ant Colony Optimization — Textbook & Real-World Research

Reference code:
[`aco.ts`](../../src/experiments/aco/aco.ts) (the `Colony` engine),
[`layouts.ts`](../../src/experiments/aco/layouts.ts),
[`constants.ts`](../../src/experiments/aco/constants.ts),
[`components/ColonyCanvas.tsx`](../../src/experiments/aco/components/ColonyCanvas.tsx) (rendering + animation).

This is the research record for the ACO-on-TSP experiment: the canonical
algorithm, how faithfully we model it, and — importantly — **what we learned
trying to *see* it.** A large part of ACO's difficulty is not the math; it is
that the interesting thing (emergence) is nearly invisible if you render it the
obvious way. Findings accumulated while building and debugging the
visualization.

---

## 0. The single most important finding

> **In ACO the signal is the *deviation from uniformity*, not the pheromone
> level itself. If you render trail strength relative to the maximum, you see
> nothing useful — you get an n² hairball early and a bare skeleton late. The
> emergent map only appears when you render each edge *relative to the field
> around it*.**

Every standard "draw the pheromone" instinct fails:

- **Opacity ∝ τ / τ_max.** Early on every edge sits at the initial level τ₀, so
  τ/τ_max ≈ 1 for *all* `n(n−1)/2` edges → a solid hairball that hides the
  cities. (§4.1)
- **Opacity ∝ (τ − τ₀), excess over baseline.** Fixes the hairball, but the
  pheromone distribution is **bimodal** (a few winning edges far above τ₀, the
  rest decayed at/below it), so a *visibility slider* built on this cutoff is
  perceptually inert — almost nothing lives in the middle for it to reveal.
  (§4.2)
- **Opacity ∝ normalize(τ, min, max) ^ γ.** This is what works. Normalize each
  edge across the *current* min→max range, then shape with a gamma the user
  controls. There's a continuous range at every phase of the run, so the slider
  has something to do — and at convergence it can even lift the faint "ghosts"
  of decayed edges back into view. (§4.3)

This is the genuine research output of the experiment: **ACO visualization is a
contrast-normalization problem, not a drawing problem.**

---

## 1. The algorithm: Ant System on the TSP

We implement **Ant System (AS)** — Dorigo's original 1992 formulation — with
**elitist reinforcement**, on the symmetric Euclidean Traveling Salesman
Problem.

### 1.1 Setup

- `n` cities with positions; a symmetric distance matrix `d_ij`.
- **Visibility** (a static greedy heuristic): `η_ij = 1 / d_ij`.
- **Pheromone** `τ_ij` on every edge — the colony's shared, mutable memory.
  Initialised to `τ₀` (see §2.2).

### 1.2 Tour construction (one ant)

Starting from a city, an ant repeatedly moves to an unvisited city `j`, chosen
from the allowed set `N_i` with the **random-proportional rule**:

```
            [τ_ij]^α · [η_ij]^β
p_ij  =  ───────────────────────────         (j ∈ N_i)
          Σ_{l∈N_i} [τ_il]^α · [η_il]^β
```

- **α** weights *learned* information (pheromone — follow the crowd).
- **β** weights *prior* information (visibility — prefer short edges).
- When `α = 0` it is pure greedy/stochastic nearest-neighbour; when `β = 0` it
  ignores distance and follows pheromone only (fast stagnation).

The ant visits all `n` cities, then closes the loop back to its start. Its tour
length `L_k` is the sum of the `n` edge lengths.

### 1.3 Pheromone update (once per generation, after *all* ants finish)

```
τ_ij  ←  (1 − ρ) · τ_ij   +   Σ_k Δτ_ij^k        (+ elitist term)

           ⎧ Q / L_k   if edge (i,j) is in ant k's tour
Δτ_ij^k =  ⎨
           ⎩ 0         otherwise
```

- **(1 − ρ)·τ** is **evaporation**: every edge loses a fraction `ρ` each
  generation. This is what lets the colony *forget* bad early commitments.
- Each ant **deposits** `Q / L_k` on its edges: shorter tours deposit more, so
  good edges accumulate faster than they evaporate.
- **Elitist term** (Dorigo's "elitist AS"): the *best-so-far* tour gets an extra
  `e · Q / L_best` on its edges every generation, sharpening convergence. We use
  `e = m` (the colony size) so the elite deposit is comparable to the whole
  generation's collective deposit.

The crucial structural point: **pheromone is updated once per generation, not
during tour construction.** No ant sees another ant's deposits until the next
generation. (Contrast ACS, §9, which adds a *local* update during the walk — we
deliberately omit it.)

---

## 2. Implementation choices

See [`aco.ts`](../../src/experiments/aco/aco.ts).

### 2.1 `buildGeneration()` / `commit()` split

The engine separates **deciding** a generation of tours from **applying** their
pheromone:

- `buildGeneration()` constructs all `m` ant tours against the *current* (frozen)
  pheromone and returns them — it does not mutate `τ`.
- `commit(tours)` runs evaporation + deposits + elitist + best/history
  bookkeeping.

This split is what makes the animation faithful (§5): the ants' decisions for
the generation are fixed up front, we *walk* them visibly, and only when the
walk completes do we apply the pheromone update — exactly AS's "after all ants
finish" semantics. A naïve implementation that deposited mid-walk would silently
become a different (and incorrect-for-AS) algorithm.

### 2.2 Initial pheromone τ₀ = m / L_nn

τ₀ is set to `ants / L_nn`, where `L_nn` is a nearest-neighbour tour length — the
standard AS recommendation. **This value matters more than it looks:**

- **τ₀ too high** → deposits are tiny relative to the baseline, so edges stay
  near-uniform for many generations. The colony *looks dead* (and, per §0,
  renders as nothing).
- **τ₀ too low** → the first few tours dominate immediately and the colony
  **locks in** (stagnation) before exploring.

`m / L_nn` lands deposits and evaporation at the same order of magnitude, so
differentiation begins within a few generations — visible *and* healthy.

### 2.3 Scaled coordinate space

Cities are stored normalized in `[0,1]²` (so rendering is canvas-size
independent), but distances are computed in a virtual `SCALE = 1000` space so
tour lengths are human-friendly numbers (hundreds–thousands) in the stats and
the debug report, instead of tiny fractions.

### 2.4 Convergence detection

We flag "converged" when the best-so-far length is unchanged for
`CONVERGE_PATIENCE` (40) generations. This is a *UI* signal (a badge + a log
event), not an algorithmic stop — the colony keeps running, which is itself
instructive: you can watch a converged colony *stay* converged (or, with high ρ
and low elitism, occasionally drift).

---

## 3. Parameter intuition (observed behaviour)

Exposed sliders: **ants (m), α, β, ρ**, plus an **elitist** toggle. What each one
actually does on screen:

| Param | Low | High | Failure mode |
|---|---|---|---|
| **m** (ants) | jittery, slow to average out | smooth, fast, expensive/frame | — |
| **α** (pheromone) | ignores trails, stays exploratory | follows crowd hard | **too high → premature convergence / stagnation** on a mediocre loop |
| **β** (distance) | wanders, ignores geometry | sharp, greedy, good tours fast | too high → behaves like nearest-neighbour, skips better non-greedy tours |
| **ρ** (evaporation) | long memory; early mistakes persist | forgets fast, escapes local optima | **too high → never settles** (the best tour flickers, trails never solidify) |

Three findings worth stating plainly:

1. **β does the early work, α does the late work.** With default `β = 4`, the
   first generations already produce decent tours from greed alone; pheromone
   (α) then refines them. Set `β = 0` and the colony is nearly blind until
   pheromone accidentally builds — slow and unreliable.
2. **The α/ρ tension is the whole game.** High α exploits; high ρ keeps options
   open. ACO works in the band where they roughly balance. Push α up *and* ρ
   down and you get fast stagnation; the opposite gives a colony that never
   commits.
3. **Elitist reinforcement is a convergence accelerant with a cost.** It reliably
   shaves generations off the time-to-good-tour, but it also makes premature
   convergence easier — it is concentrated positive feedback on a tour that may
   not be optimal yet.

ACO on random Euclidean instances typically beats the nearest-neighbour baseline
by a meaningful margin; the experiment surfaces this directly as
`gain_vs_greedy` (best tour vs `L_nn`).

---

## 4. Visualization findings (the core research)

### 4.1 The hairball — rendering relative to τ_max fails at the start

First attempt: `alpha, width ∝ τ_ij / τ_max`, skipping edges below ~4% of max.
At generation 0 every edge is τ₀, so `τ/τ_max ≈ 1` for all of them and the skip
threshold removes nothing → the canvas is a dense web of all `n(n−1)/2` edges,
obscuring the cities. **A uniform field has no max-relative structure.**

### 4.2 Baseline-excess — fixes the hairball, breaks the slider

Second attempt: render `e = (τ_ij − τ₀) / (τ_max − τ₀)`, skip `e ≤ 0.06`. Now a
uniform field draws *nothing* (good), and trails emerge as they rise above τ₀.
The hairball is gone.

But when we added a **"trails" visibility slider** (a tunable cutoff on `e`), it
appeared to do nothing. The reason is a real property of ACO dynamics:

> **Pheromone converges to a bimodal distribution.** A handful of best-tour edges
> spike far above τ₀; every other edge evaporates to at/below τ₀ (so `e ≤ 0`).
> Almost no edges occupy the middle, so sliding a cutoff through the middle
> reveals/hides almost nothing.

The cutoff was technically wired correctly — the *metric* gave it nothing to act
on.

### 4.3 Min→max + gamma — a continuum the slider can shape

Final model (current code): per frame, find the actual `min`/`max` pheromone over
all edges, normalize each edge to `[0,1]`, then apply a **slider-controlled
gamma** and cutoff:

```
spread = max − min
if spread > 0.02·max:                 # skip the near-uniform early field
    vis    = trail / 100              # 0..1 from the slider
    gamma  = 2.6 − 2.2·vis            # low vis → 2.6 (only the loop); high → 0.4
    cutoff = 0.16·(1 − vis)
    t = ((τ_ij − min) / spread) ^ gamma
    draw edge iff t > cutoff,  alpha & width ∝ t
```

Why this works where the others didn't:

- **Min→max normalization** gives a full `[0,1]` range *at every phase*, even
  when the distribution is bimodal — the decayed edges land near 0, the winners
  near 1, and gamma can stretch either end.
- **Gamma is the right control.** `γ > 1` crushes faint edges (shows only the
  dominant loop); `γ < 1` lifts them (reveals the faint search web, including
  post-convergence ghosts). The slider sweeps `γ` from 2.6 → 0.4.
- **The `spread > 2%·max` guard** reproduces the §4.2 win — the uniform early
  field is skipped entirely, so no hairball — without depending on τ₀.

Lesson, generalised: **for any "field that self-organises from uniform to
structured," render local contrast (normalized + gamma), not absolute value.**

### 4.4 Other rendering choices that earn their keep

- **Best-so-far tour** drawn as a separate bright closed loop (secondary accent +
  glow), so the *answer* is always legible over the noisy pheromone field.
- **Ants** drawn with a short comet trail along their current edge — additive
  (`lighter`) blending on dark themes so overlapping ants glow rather than
  muddy.
- **Theme-reactive palette:** canvas colours are read from the same CSS custom
  properties the rest of the app uses (`--accent`, `--accent2`, …) and
  re-read on theme flip, so the visualization matches light/dark without a
  second palette.

---

## 5. The animation model

ACO is a generational batch algorithm, but a batch is boring to watch. We make
it continuous and physical:

- A generation's tours are built up front (§2.1). All ants share a single
  `progress ∈ [0, n]` measured in **tour edges walked**; an ant's on-screen
  position is the interpolation along the edge at `floor(progress)`.
- Each animation frame advances `progress` by an **edges-per-frame** value
  derived from the speed slider: a gentle crawl at the low end
  (`≈0.08 edges/frame` — you can follow one ant), up to a few full generations
  per frame at the top.
- When `progress` passes `n`, we `commit()` the generation, build the next, and
  carry the remainder — looping up to a few generations per frame in "turbo" so
  high speed actually means *more iterations*, not just faster ants.

This keeps the visible motion honest (ants really do trace the tours that
produced the pheromone update) while letting the user dial from
"inspect one ant" to "run to convergence."

---

## 6. Engineering findings (the canvas/layout bug)

A non-ACO finding the build forced into the open, recorded because it cost real
time and is broadly applicable.

**Symptom.** The convergence sparkline (and potentially the main canvas) **grew
without bound** when the window was narrowed — only in the single-column
(≤860px) layout.

**Root cause — HiDPI backing buffers inflate `1fr` grid tracks.** A `<canvas>`
with CSS `width: 100%` but no constraint on its *intrinsic* size contributes its
**backing-store width** (`cssWidth × devicePixelRatio`, ≈2×) as min-content. In
a `1fr` grid/flex track with default `min-width: auto`, that 2× min-content
forces the track to 2× → the next redraw measures the bigger element → sets the
buffer to 4× → **the width doubles every frame.** The desktop layout hid it
because the sidebar was a fixed `320px` track, which clamps min-content.

**Fixes (all three applied):**

1. **Take canvases out of flow.** Position both canvases `absolute; inset: 0`
   inside a sized wrapper. An out-of-flow element contributes nothing to its
   parent's min-content, so the backing buffer can never feed back into layout.
   *This is the actual fix.*
2. **Measure the box, never the canvas.** Size the backing buffer from the
   wrapper's `clientWidth/Height`, not the canvas's own rect (which you are
   mutating).
3. **Defer ResizeObserver work to `requestAnimationFrame` + skip no-op resizes.**
   Doing layout reads and canvas writes synchronously inside an observer
   callback is what triggers the `ResizeObserver loop completed with undelivered
   notifications` error and lets two observers cascade. Coalescing to one update
   per frame, and bailing when the size is unchanged, removes both.

Generalised lesson: **a canvas's backing-store size is layout-affecting unless
the element is given an explicit, non-intrinsic size or removed from flow.** On
HiDPI displays the feedback gain is the device pixel ratio, so it diverges
instead of settling.

---

## 7. The debug-bridge methodology

Because the assistant can't see the rendered canvas, the experiment ships a
**copyable debug report** (the DebugLog panel) so the human can bridge runtime
state back. The report bundles what a screenshot can't: parameters, colony
metrics, the **pheromone distribution** (`min/max/mean/aboveHalf`), the actual
best-tour path + city coordinates, **canvas size + DPR**, animation progress, the
best-length history tail, and a rolling event log.

This turned out to be the fastest way to diagnose §0 and §6: the
`[pheromone] min max mean` line reveals the bimodal distribution numerically, and
the `[anim] canvas=WxH@DPRx` line would immediately show a ballooning buffer. The
methodology generalises to any visual experiment: **expose the engine's internal
state as text, not just pixels.**

---

## 8. Fidelity scorecard & scope boundary

What we implement, faithfully:

| Aspect | Status |
|---|---|
| Random-proportional transition rule (α, β) | ✅ canonical |
| Generation-level pheromone update (evaporate + Σ deposits) | ✅ canonical AS |
| Elitist best-so-far reinforcement | ✅ (elitist AS, `e = m`) |
| τ₀ = m / L_nn initialisation | ✅ recommended AS value |
| Symmetric Euclidean TSP, 2-opt-free | ✅ (no local search) |

Deliberately **out of scope** (these would make it a *different* ACO variant):

- **No local pheromone update / pseudo-random-proportional rule** → it is AS, not
  **Ant Colony System** (§9).
- **No τ bounds or trail re-initialisation** → not **Max–Min Ant System**.
- **No local search (2-opt / 3-opt / Lin–Kernighan)** hybridisation, which every
  competitive ACO-for-TSP implementation uses in practice.
- **No candidate lists / neighbour lists** — every unvisited city is considered
  each step (fine for the `≤60`-city instances here; the standard scaling trick
  for large `n`).

These omissions keep the experiment showing the *original* mechanism cleanly.

---

## 9. Further real-world context

- **Ant System (1992)** — the original; what we implement. Elegant, but
  outperformed on its own by its descendants.
- **Ant Colony System (ACS, 1996)** — adds a *local* pheromone update (ants
  *remove* a little pheromone as they traverse an edge, encouraging exploration
  within a generation) and a pseudo-random-proportional rule (a tunable
  greedy-vs-probabilistic knob `q₀`). Faster, but a meaningfully different
  dynamic — and incompatible with our "freeze the generation, then walk it"
  animation model, which is one reason we stayed with AS.
- **Max–Min Ant System (MMAS)** — clamps τ to `[τ_min, τ_max]` to prevent the
  stagnation we describe in §3, and only the best ant deposits. The most robust
  classical variant for TSP.
- **In practice**, ACO is rarely used raw for TSP (specialised solvers like
  Lin–Kernighan dominate). Its real niche is **dynamic / stochastic** routing —
  network packet routing (AntNet), vehicle routing with changing demands,
  scheduling — where the continuously-evaporating shared memory adapts to a
  moving target, which a one-shot solver can't.

The pedagogical point the visualization is built to make: **no individual ant is
smart.** Each one runs the same myopic τ^α·η^β rule. The short tour is a property
of the *colony* and its evaporating shared memory — stigmergy — not of any ant.
The whole job of the rendering work in §4 is to make that collective object
visible.

---

*Maintained alongside the code. If the engine's update rule, parameters, or the
pheromone-rendering normalization change, update §1–§4 and the §8 scorecard.*
