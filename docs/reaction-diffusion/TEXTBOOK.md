# Reaction-Diffusion (Gray-Scott) - Textbook & Real-World Research

Reference code:
[`simulation.ts`](../../src/experiments/reaction-diffusion/simulation.ts) (the GPU engine),
[`shaders.ts`](../../src/experiments/reaction-diffusion/shaders.ts) (GLSL passes),
[`constants.ts`](../../src/experiments/reaction-diffusion/constants.ts),
[`presets.ts`](../../src/experiments/reaction-diffusion/presets.ts),
[`components/RDCanvas.tsx`](../../src/experiments/reaction-diffusion/components/RDCanvas.tsx) (rAF loop, brush, sizing),
[`components/Preview.tsx`](../../src/experiments/reaction-diffusion/components/Preview.tsx) (f/k inset),
[`grayscott.test.ts`](../../src/experiments/reaction-diffusion/grayscott.test.ts) (CPU reference + smoke tests).
Browser-verification method: the [`verify-experiment`](../../.claude/skills/verify-experiment/SKILL.md) skill.

This is the research record for the Gray-Scott reaction-diffusion experiment: the
canonical model, how faithfully the GPU code reproduces it, and - the point -
**what we actually learned getting it to behave.** The headline turned out to be
that almost nothing that looked broken was the equation. The PDE was right from
the first commit; reaction-diffusion's real difficulty in practice is the *initial
condition*, the *numeric precision*, and the *sampling resolution*. Findings
accumulated while building and debugging the simulation (and verified in a real
browser with Playwright).

---

## 0. The single most important finding

> **Which Gray-Scott pattern you get is set as much by the seed as by the
> feed/kill pair - and the two regime families want *opposite* seeds, so there is
> no single initial condition that brings all of them to life. The Gray-Scott
> update itself was never the bug.**

Every "this experiment is broken" symptom in this project traced to something
*around* the equation, not the equation:

- The field looked **dead / sparse / frozen** → the seed nuclei were the wrong
  size and/or strength for the chosen regime (§4), and earlier a resize bug kept
  wiping the field (§4.4).
- The high-kill regimes **died outright** → `RG16F` (float16) rounded away the
  tiny per-step increments (§5.1).
- It looked **blurry** → the simulation grid was smaller than the canvas it was
  upscaled onto (§6).

The deepest, most genuinely surprising part is the seed asymmetry. **Low-feed
regimes** (mitosis, spots, maze) only ignite from nuclei about *one pattern
wavelength* across; hand them a big blob and they read it as a uniform patch that
decays to nothing. **High-feed regimes** (coral, worms, u-skate) *starve* from a
tiny nucleus and need a large one. A single uniform seed kills everything; pure
random placement makes a given regime fill on one reload and die on the next. The
seed that works for all eight presets is a **jittered grid of mixed-size,
hard-cored nuclei** - and we only found it by sweeping seeds against a CPU
reference and then confirming each one in the live GPU build (§4, §7).

The pedagogical inversion: people teach Gray-Scott as "two numbers, infinite
patterns." True - but in a real interactive build, the seed is a third number
that decides whether you see any pattern at all.

---

## 1. The model and its equations

Gray-Scott models two virtual chemicals, **U** and **V**, diffusing on a grid
while they react. V is autocatalytic: it consumes U to make more of itself, and
decays at a fixed rate. The continuous system:

```
∂U/∂t = Du ∇²U  −  U·V²  +  f·(1 − U)
∂V/∂t = Dv ∇²V  +  U·V²  −  (f + k)·V
```

- `U·V²` is the **reaction**: one U plus two V make three V (autocatalysis). It
  removes U and adds V.
- `f·(1 − U)` is the **feed**: U is replenished toward 1 at rate `f`.
- `(f + k)·V` is the **kill + outflow**: V is removed at rate `k` (plus the feed's
  outflow term).
- `Du`, `Dv` are diffusion rates; canonically `Du > Dv` (U spreads faster), which
  is what makes the Turing instability produce structure rather than a smooth blur.

We integrate with **explicit (forward) Euler** on a discrete grid, exactly as in
the shader [`SIM_FS`](../../src/experiments/reaction-diffusion/shaders.ts):

```
lap  = 9-tap Laplacian of the field at this cell
U' = clamp(U + (Du·lapU − U·V² + f·(1 − U))·dt, 0, 1)
V' = clamp(V + (Dv·lapV + U·V² − (k + f)·V)·dt, 0, 1)
```

The Laplacian is the standard **9-tap stencil**: orthogonal neighbours weighted
`0.2`, diagonals `0.05`, centre `−1` (`LAP_ORTHO` / `LAP_DIAG` in
[`constants.ts`](../../src/experiments/reaction-diffusion/constants.ts); these
weights sum to zero, as a Laplacian must).

Our defaults follow the most reproduced community convention (Karl Sims):
**`Du = 1.0`, `Dv = 0.5`, `dt = 1.0`**. The boundary is a **torus** - the
Laplacian wraps at the edges (`(p + size) % size` in the shader), so patterns have
no seam.

---

## 2. The GPU implementation

The whole simulation lives on the GPU as a stateful **ping-pong** between two
float textures; React never touches a pixel. See
[`simulation.ts`](../../src/experiments/reaction-diffusion/simulation.ts).

- **State** = the R,G channels of an `RG32F` texture (U in R, V in G). Two of
  them; each step reads the front and writes the back, then they swap.
- **Five fragment passes**, all drawn as a single full-screen triangle keyed off
  `gl_VertexID` (no vertex buffers): **sim** (one Euler step), **splat** (the
  brush / seed nucleus), **seed** (fills the U=1, V=0 substrate), **display**
  (maps V to colour through a palette ramp), **copy** (downsamples the field into
  a small RGBA8 buffer for the debug readback), and a **rescale** pass used on
  resize (§4.4).
- **The Laplacian uses `texelFetch`, not filtered sampling.** Exact integer texel
  reads with manual `% size` wrap make the stencil filter-independent and the
  torus correct. Filtering (`LINEAR`) exists only for the *display* upscale.
- **Steps per rendered frame** (`stepsPerFrame`, default 12, range 1-24) decouple
  simulation speed from frame rate: at ~165 fps that is ~2000 Euler steps/second,
  so patterns form within a second or two.

### Fidelity

This is a faithful, standard Gray-Scott solver. The only deviations are
deliberate engineering choices (float32 over float64, a clamp to `[0,1]`, a fixed
9-tap stencil) - none change the qualitative dynamics. See the scorecard in §8.

---

## 3. The parameter map and presets

Feed `f` and kill `k` are the two knobs (sliders span `f ∈ [0, 0.1]`,
`k ∈ [0.03, 0.075]`). Tiny moves cross regime boundaries - that sensitivity is the
pedagogical hook, and the small `0.0005` slider step exists to make it tractable.
The eight presets in
[`presets.ts`](../../src/experiments/reaction-diffusion/presets.ts), with the
coverage / motion we measured live (grid ≈ 480×270, after the seeding fix):

| Preset | f | k | Fills | Motion (Δ) | Character |
|---|---|---|---|---|---|
| spots | 0.018 | 0.051 | ~56% | **high (~0.10)** | drifting, dividing dots |
| solitons | 0.030 | 0.062 | ~52% | settles | isolated standing spots |
| maze | 0.029 | 0.057 | ~81% | low after fill | labyrinth / Turing stripes |
| mitosis | 0.0367 | 0.0649 | ~43% | moderate | spots that grow & split |
| fingerprint | 0.039 | 0.058 | ~98% | low | dense ridged labyrinth |
| **coral** (default) | 0.0545 | 0.062 | ~81% | moderate | branching growth |
| worms | 0.054 | 0.063 | ~74% | moderate | elongated worm segments |
| u-skate | 0.062 | 0.0609 | ~93% | moderate | gliders / "u-skate world" |

Two observed truths worth stating plainly:

1. **Most regimes converge to a (near-)static steady state.** Once a pattern fills
   the canvas, `delta` (mean V change between debug samples) falls toward zero
   while the step counter keeps climbing. "Frozen while running" is the
   *attractor*, not a stalled loop (§7). The dynamic show is the **transient** -
   watch it form from the seed (hit reset to replay) - plus the genuinely
   never-settling regimes (spots, and to a degree worms/u-skate).
2. **`worms` and `fingerprint` originally shipped with values that simply die**
   (`0.058/0.065` and `0.09/0.059`). They were retuned to `0.054/0.063` and
   `0.039/0.058` - points that survive in this discretization. Not every (f,k)
   pair in a published "map" reproduces under `Du=1, Dv=0.5, dt=1`; the map is
   convention-dependent.

The **default was changed from mitosis to coral.** Mitosis settles into a sparse
spot field that reads as "nothing is happening" on first load; coral fills the
canvas with lush branching structure and keeps evolving - a far better first
impression.

---

## 4. The seeding research (the core finding)

This is where most of the work went, and it is the experiment's real research
output. The progression of seeds we tried, each fixing the previous one's failure:

### 4.1 Flooding V → "the brush erases"

The first brush set V to 1 in a disc while leaving U at the substrate value 1.
With `U = V = 1`, the reaction term `U·V²` is maximal, so a single Euler step
annihilates U inside the disc (`du ≈ −U·V²·dt = −1`); with no U left, V then
decays to 0. At 12 steps/frame the collapse happens between rendered frames, so
instead of growth you see the brushed region (and any pattern under it) wiped to
substrate. It reads as an **eraser**.

**Fix:** seed the *canonical Gray-Scott nucleus* - blend the region toward
`U ≈ 0.5, V ≈ 0.25` (the `SPLAT_FS` `mix(c, vec2(0.5, 0.25), a)`), not a V flood.
That is a balanced perturbation that reliably nucleates instead of self-destructing.

### 4.2 The two families want opposite-sized seeds

With a sane nucleus, the next failure: a seed that filled coral killed mitosis,
and vice-versa. Sweeping seed strategies against the CPU reference (§7) on a
live-proportioned grid exposed the asymmetry:

- **Low-feed regimes** (mitosis, spots, maze, solitons) divide only from a nucleus
  about *one pattern wavelength* across (~6 cells). A large blob looks to them like
  a uniform patch, which decays.
- **High-feed regimes** (coral, worms, u-skate, fingerprint) need a *large* nucleus
  (~18 cells); a tiny one starves before it can spread.

A **dense uniform** seed (the obvious "cover the field" instinct) drove the whole
field to a uniform state that decays - it killed *every* regime.

### 4.3 The seed that works: jittered grid of mixed-size hard discs

The final `seed()` ([`simulation.ts`](../../src/experiments/reaction-diffusion/simulation.ts)):

- **Jittered grid**, not random points. Even coverage made every reset fill
  *reliably*; pure-random placement clumped by luck, so a regime filled 81% on one
  load and 9% on the next - a real variance bug, not success.
- **Mixed sizes:** every 4th nucleus is large (radius 18 cells), the rest small
  (radius 6). Each family finds a nucleus it can grow from in the same seed.
- **Hard core, not a soft dome.** The brush splat uses a smooth `smoothstep`
  falloff (`uInner = 0`); the *seed* uses a near-flat-top disc (`uInner = 0.8`).
  This was the last live/CPU discrepancy: a soft dome's effective strong core is
  only ~1/3 of its radius, so soft r6 nuclei were sub-critical and high-feed
  regimes still died in the browser even though the CPU model (hard discs) said
  they should live. Hardening the seed core closed the gap.

Result: all eight presets fill 33-98% and stay alive, reliably across reloads.

### 4.4 The resize bug that masqueraded as "always near-empty"

Before any of the above mattered, a separate bug made *every* preset look dead:
`resize()` **re-seeded** the grid on every canvas size change, and `ResizeObserver`
fires repeatedly while a page lays out (fonts, scrollbars, the `aspect-ratio` +
`max-height` interaction, especially on WebKit). Each fire threw away the
developing field, so you perpetually saw a handful of fresh specks. **Fix:**
`resize()` now *preserves* the field - it builds the new grid and `rescale`-blits
the old texture into it - and only seeds on first allocation or an explicit reset.

---

## 5. Numeric findings

### 5.1 Float16 is not enough - use float32

Gray-Scott accumulates tiny per-step increments (`dv` is often `~0.001-0.006`).
`RG16F` (half-float) has ~3 significant digits, so near `U ≈ 1` those increments
round away. The robust regimes survive; the delicate high-kill ones (mitosis,
worms, fingerprint) **die** that they keep alive in float64. Switching state
textures to **`RG32F`** revived them. This needs two extensions, both present on
the target machine: `EXT_color_buffer_float` (render to float) and
`OES_texture_float_linear` (LINEAR-sample a float32 texture, for the display
upscale). The engine falls back to `RG16F` if float32 isn't available, with the
active format reported in the debug panel (`float rg32f` / `rg16f`).

### 5.2 Explicit Euler is conditionally stable

Forward Euler is fast and GPU-friendly but blows up if the step is too aggressive.
Pushing `dt` or the diffusion rates well past the defaults destabilizes the
integration; the field saturates or goes to noise. The `[0,1]` clamp in the shader
keeps a blow-up bounded (not NaN), and a reset re-seeds a clean field - the
advanced-panel sliders (`du`, `dv`, `dt`) carry hints saying as much. The defaults
(`Du=1, Dv=0.5, dt=1`) sit comfortably inside the stable region for the 9-tap
stencil (whose normalized `|lap| ≤ 1`).

### 5.3 "Converged" is the steady state, not a dead loop

A persistent red herring: a filled pattern sitting still while `running` is true
looks broken. The debug panel settles it definitively - `steps` keeps climbing
(the loop is alive and integrating) while `delta ≈ 0` (the field has reached a
fixed point). The CPU smoke test reproduces this deterministically: mitosis runs
1500 steps, then 200 more, and the field is bit-identical. **Most reaction-diffusion
regimes converge.** The verdict line in the panel encodes this:
`patterned (static!)` = converged-but-stepping; an empty/decaying field is a
different verdict.

---

## 6. Resolution and the blur

The simulation grid and the canvas are separate sizes. The display pass upscales
the grid to the canvas with `LINEAR` filtering, so **if the grid is smaller than
the canvas backing store, the result is blurry** - we shipped a 480-wide grid onto
a ~748-wide backing and it looked soft.

The fix is a user-facing **resolution control** (chips in the Look panel):
`RDParams.resolution` is the grid size *as a multiple of the canvas backing store*,
not an absolute number - so "1×" is always a crisp 1:1 render regardless of window
size or DPR. Levels: low `0.5`, medium `0.75`, **high `1` (default, crisp)**, ultra
`1.5`, max `2` (supersampled). A hard clamp `SIM_MAX = 2048` on the longest edge is
the perf safety net.

Two facts that fall out of the cell-based nature of the model:

- **Feature size is a fixed number of cells**, so more cells = smaller, more
  numerous "particles." Raising resolution is the lever for finer patterns, not
  any change to `Du`/`Dv`.
- **fps is display-capped (~166 Hz here).** A flat 166 fps even at `ultra` means
  the GPU still had headroom - the cap, not the GPU, was the ceiling. To see real
  GPU stress you watch fps *drop below* the cap in the debug panel; that is why a
  `max` (2×, up to ~2.4M cells before the clamp) level was added.

---

## 7. Verification methodology (a finding in itself)

Three tools, and a lesson about which to trust.

1. **A CPU reference of the Gray-Scott step** ([`grayscott.test.ts`](../../src/experiments/reaction-diffusion/grayscott.test.ts))
   mirrors `SIM_FS` exactly and runs in Node. It powers the smoke tests (the field
   evolves, stays bounded, stays alive across all presets; converges for mitosis)
   *and* it was the fast, deterministic way to sweep seed strategies (§4).
2. **The live GPU build is the oracle.** The CPU model predicts *trends* but
   diverges on marginal cases - it stamps *hard* discs while the shader splat is
   *soft*; it is float64 while the GPU was float16. Every time the model and the
   browser disagreed, the browser was right and the model had to be reconciled to
   it (hardening the seed core in §4.3 was exactly this).
3. **A copyable debug panel + Playwright pixel reads.** Because the assistant
   can't see the canvas, the experiment exposes a debug report (a 96×96 GPU
   readback → `meanU/V`, `maxV`, `active%`, `delta`, `steps`, `fps`, `grid`,
   `float`, plus a one-word `verdict`). Driving the page with Playwright and
   reading `gl.readPixels` (frame-to-frame diff) and counting `requestAnimationFrame`
   ticks turned "is it actually animating / frozen / dead?" from a guess into a
   measurement. The reusable recipe is the
   [`verify-experiment`](../../.claude/skills/verify-experiment/SKILL.md) skill.

Generalised lesson: **for a GPU sim, expose the engine's aggregate state as text
and measure pixels - never conclude from a screenshot, and never trust an
offline model over the live device on a marginal case.**

---

## 8. Fidelity scorecard

| Aspect | Status |
|---|---|
| Two-chemical Gray-Scott reaction `U + 2V → 3V`, V decay | ✅ canonical |
| Feed `f(1−U)` / kill `(f+k)V` terms | ✅ canonical |
| 9-tap Laplacian (0.2 / 0.05 / −1), toroidal | ✅ standard stencil |
| `Du=1, Dv=0.5, dt=1` defaults | ✅ common convention (Karl Sims) |
| Explicit forward-Euler time stepping | ✅* faithful but conditionally stable (§5.2) |
| State precision | ✅* `RG32F` (float32), not float64; `RG16F` fallback (§5.1) |
| Values clamped to `[0,1]` | ✅* keeps blow-ups bounded; real chemistry isn't clamped |
| Initial condition | ✅* a designed seed (§4), not physically motivated |
| Display = V through a colour ramp | ✅ a visualization choice, not part of the model |

---

## 9. Where this is *not* real chemistry (scope boundary)

- **U and V are not molecules.** Gray-Scott is an idealized abstraction; the
  "concentrations" are dimensionless fields tuned for pattern formation, not a
  fit to any real reactant. Real autocatalytic systems (e.g. the
  Belousov-Zhabotinsky reaction) have many species and more complex kinetics.
- **No conservation, no thermodynamics.** The feed/kill terms are open-system
  source/sink hacks; there is no mass or energy balance.
- **The clamp to `[0,1]` is non-physical** - a numerical guard, not a chemical law.
- **The grid is a torus**, not a real bounded vessel; boundary conditions in a
  real experiment matter and are different.
- **Time and space are in arbitrary units.** "Steps" are not seconds; "cells" are
  not millimetres. Feature size is a property of the discretization, not a physical
  wavelength (§6).

It is a faithful model of *the Gray-Scott equations*, which are themselves a
teaching abstraction of reaction-diffusion - not a simulation of a specific
chemical system.

## 10. Further real-world context

- **Turing's morphogenesis (1952).** Reaction-diffusion is the mechanism behind
  Alan Turing's theory that two diffusing "morphogens" can spontaneously break
  symmetry into stable patterns - the standard explanation for leopard spots,
  zebra stripes, fish pigmentation, and fingerprint ridges. Gray-Scott is one
  concrete instance.
- **Pearson's classification (1993).** John Pearson mapped the Gray-Scott (f,k)
  plane into named regimes (the α-θ zoo); our presets are points in that map. The
  exact boundaries shift with the discretization, which is why some published
  pairs needed retuning (§3).
- **Karl Sims' tutorial** popularized the `Du=1, Dv=0.5`, 9-tap convention this
  build uses; mrob's *xmorphia* is the canonical deep survey of the parameter
  space.
- **In practice**, reaction-diffusion is used well beyond biology: procedural
  texture synthesis (coral, scales, skin), generative art, mesh growth, and as a
  test bed for studying pattern formation and excitable media. The GPU ping-pong
  technique here is the same one used for fluid sims and other cellular PDE solvers.

The point the experiment is built to make: **complex, life-like structure emerges
from two local rules and two numbers.** The work documented above is everything it
took to make that emergence reliably *visible* - which, as in the ACO experiment,
turned out to be a harder problem than the math.

---

*Maintained alongside the code. If the update equation or stencil changes, update
§1-§2 and the §8 scorecard; if the seed, presets, precision, or resolution model
change, update §3-§6.*
