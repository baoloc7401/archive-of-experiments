# L-Systems - Textbook & Real-World Research

Reference code:
[`lsystem.ts`](../../src/experiments/l-system/lsystem.ts) (rewriting),
[`turtle.ts`](../../src/experiments/l-system/turtle.ts) (3D interpretation),
[`render.ts`](../../src/experiments/l-system/render.ts) (projection + depth cueing),
[`constants.ts`](../../src/experiments/l-system/constants.ts) (the preset grammars),
[`components/LCanvas.tsx`](../../src/experiments/l-system/components/LCanvas.tsx) (orbit/spin/grow loop),
[`components/DebugPanel.tsx`](../../src/experiments/l-system/components/DebugPanel.tsx) (the copyable report).

This is the research record for the 3D L-system experiment: the canonical grammar
model, how the 3D turtle interprets it, and - the part that cost the most time -
**what we learned trying to make grammars produce forms a person recognises.** A
lot of the work was not the math; it was discovering that an L-system's silhouette
is decided by something you *cannot* reach with the sliders. Findings accumulated
while building and debugging the visualization.

---

## 0. The single most important finding

> **In an L-system, what a form *looks like* is fixed by the *topology* of the
> productions, not by their numeric parameters - and the whole family can only
> ever produce self-similar branching and curves. So "make it look like X" is
> frequently a question about grammar structure (or an unanswerable one), never a
> matter of tuning the angle.**

This is the lesson the build kept teaching, three times, the hard way:

- The first preset set was rejected as **"they all look like trees."** They did -
  because every grammar shared one topology: *a single stalk that branches
  upward.* `bush`, `spiral`, `crystal`, `tower` were that same skeleton at
  different angles. Re-angling a trunk gives you a different tree, never a
  not-tree.
- The fix for `bush` was **not a parameter** - it was deleting the leading `FF`
  from the production. That `FF` *was* the trunk. With it gone and six branches
  radiating from the base, the bounding box flips from tall to **wider-than-tall
  (6 × 3.9 × 6)** and it finally reads as a shrub.
- The fix for `spiral` was to **throw the branching grammar away entirely** and
  use a pure curve (`A=F+/...`): constant bend + constant twist, which is the
  literal definition of a helix. A coil cannot look like a tree because it has no
  branch topology at all.

And the boundary case that no amount of grammar-craft can cross: a request for an
**Asian dragon with a head, four legs, and a flaming tail.** That is a *figure* -
distinct, non-repeating parts - and an L-system is a self-similarity engine. The
honest answer was "an L-system can't draw that," and the `serpent` preset is a
deliberately-labelled *stylised creature*, not a dragon (§5, §7). Naming it
honestly was part of the research output.

The generalisable point: **with a self-similar grammar, choose the topology
first; parameters only decorate it. The set of expressible silhouettes is small
and fixed, and a good visualization is honest about its edges.**

---

## 1. The model: rewriting + a 3D turtle

A (deterministic, context-free) **DOL-system** is an alphabet, an **axiom**
(start string), and a set of **productions** that rewrite single symbols. The
defining feature is that rewriting is **parallel**: every symbol is replaced
simultaneously, each generation. After *n* generations the string is walked by a
**turtle** that turns symbols into geometry.

### 1.1 Rewriting - [`lsystem.ts`](../../src/experiments/l-system/lsystem.ts)

`expand(axiom, rules, iterations)` applies the productions `iterations` times.
Any symbol without a rule is a **constant** and copies through unchanged. Two
deliberate properties:

- **Growth is parallel and exponential.** A rule like `F=FF` doubles every `F`
  each generation, so string length is roughly `branching^iterations`. This is
  why `MAX_ITER = 7` is plenty and why a hard cap exists.
- **`MAX_STRING_LEN = 250_000` is a safety valve.** When an expansion would
  overflow, `expand` stops and returns the last in-budget string, so a runaway
  grammar degrades instead of freezing the tab.

### 1.2 The 3D turtle - [`turtle.ts`](../../src/experiments/l-system/turtle.ts)

The turtle carries a position and an **orthonormal frame** of three unit vectors:
heading **H** (direction of travel), left **L**, and up **U**, forming a
right-handed basis (`H × L = U`). It starts at the origin with `H = +Y` (so
plants grow upward), `L = -X`, `U = +Z`.

Rotations turn the frame **in place** by rotating one pair of basis vectors in
their own plane:

```
spin(a, b, θ):   a' =  a·cosθ + b·sinθ
                 b' = -a·sinθ + b·cosθ
```

| Symbol(s) | Turtle action | Rotated pair |
|---|---|---|
| `F` `G` | draw forward one unit | - |
| `f` | move forward, no draw | - |
| `+` `-` | yaw left / right | `spin(H, L, ±θ)` |
| `&` `^` | pitch down / up | `spin(H, U, ∓θ)` |
| `\` `<` / `/` `>` | roll | `spin(L, U, ±θ)` |
| `\|` | turn around (180°) | `spin(H, L, π)` |
| `[` `]` | push / pop frame (branch) | stack |

Two design choices worth recording:

- **Pair-rotation instead of a rotation-matrix chain.** Rotating only the two
  basis vectors involved keeps the frame orthonormal without accumulating the
  drift a long chain of full 3×3 multiplies would, and it is cheaper.
- **One global angle θ for *all* rotations.** Yaw, pitch, and roll share the
  single `angle` slider. This is a real constraint (§4.2): a grammar that wants
  three branches 120° apart can't just say "120°"; it spreads them with *repeated*
  roll symbols (`/////` at 22° ≈ 110°). It keeps the UI to one angle knob at the
  cost of grammar contortions.

The interpreter also tracks the bounding box as it walks, returning `center`,
`size` (W×H×D), and a fit `radius` - consumed by the camera (§2) and the debug
report (§5).

---

## 2. Rendering: depth cueing, not occlusion

The render is a custom perspective projection onto a 2D canvas - no Three.js, in
keeping with the repo's framework-free canvas convention. The decision that
shaped everything:

> **There is no depth sort.** Segments are never ordered back-to-front. The 3D
> read comes entirely from perspective foreshorten, branch taper, **fog that
> fades far segments toward the background**, and the parallax of drag/auto-spin.

This is the analogue of ACO's "render contrast, not value" finding: for a
line-only fractal, painstaking occlusion is unnecessary and parallax + fog sell
the volume for a fraction of the cost. It also scales - a 4096-segment tree
re-projects every frame without a per-frame sort.

### 2.1 The projection - [`render.ts`](../../src/experiments/l-system/render.ts)

Each model point is centred, rotated by the orbit camera (**yaw about Y, then
pitch about X**), then perspective-divided:

```
zs    = z_rotated · s                      # s fits the model to FIT·min(w,h)
persp = focal / (focal − zs)               # focal = FOCAL · min(w,h)
screen = center ± (x_rotated, y_rotated) · s · persp
```

`FIT = 0.82` leaves a margin; `FOCAL = 2.4` sets a gentle perspective. Fog is a
per-segment blend toward the background, keyed on the midpoint depth relative to
the model's screen radius.

### 2.2 Bucketed batching

Per-segment styling (depth/order colour × taper width × fog) would mean thousands
of `stroke()` calls. Instead segments are grouped into **buckets keyed by
quantised colour + branch depth** (`QUANT = 10` grey levels); each bucket is one
`Path2D` stroked once. Even a large system paints in a few dozen draw calls. The
trade is mild colour banding, invisible at these line widths.

### 2.3 Colour modes

- **depth** - lerp accent→accent2 by branch-nesting depth (trunk→twig). Useless
  for curves with no branching (Hilbert, the classics): everything is depth 0, so
  it renders one flat colour. Hence those presets ship in **order** mode.
- **order** - lerp by draw order (0→1 along the string). The right default for a
  single continuous path.
- **mono** - one colour.

This is why `LPreset` carries an optional `color` (§4.1): a colour mode is part of
a grammar's identity, not a global default.

---

## 3. The preset gallery (and why each one is shaped that way)

The eleven presets in [`constants.ts`](../../src/experiments/l-system/constants.ts)
are chosen to be **topologically distinct** (per §0), not eleven trees. Each
exists to demonstrate a different structural trick. Bounds are model-space W×H×D
as measured during design.

| Preset | Structural idea | Bounds (W×H×D) | Why it isn't a tree |
|---|---|---|---|
| **tree** | classic branching plant; pitch (`&`/`^`) throws branches out of plane | 40×56×35 | it *is* the reference tree (the default) |
| **bush** | **no trunk** - 6 branches radiate from the base | 6×3.9×6 | wider than tall, mound not spire |
| **fern** | Barnsley fern + a roll (`/`) per recursion | 46×76×43 | the famous frond, now 3D not flat |
| **pine** | monopodial trunk + whorls of drooping branches; base whorls expand more → cone | 8×14×8 | taper makes a conifer, not a fan |
| **spiral** | **pure curve**: constant bend (`+`) + twist (`/`) = helix | 11×56×55 | no branches at all - a coil |
| **serpent** | maned head + undulating arc body (`P`/`Q`) corkscrewing in 3D, with legs | 5.5×41×8.5 | a creature, not a plant (see §7) |
| **snowflake** | 6 dendrite arms, feathering in-plane (`+`/`-`) **and** out (`&`/`^`) | 21×24×5.6 | hexagonal crystal with real depth |
| **hilbert** | 3D Hilbert space-filling curve | 13×18×21 | fills a cube; geometric, not organic |
| **sierpinski** | Sierpinski gasket (`G=GG` doubling) | 55×64×0 | flat triangle fractal (by definition) |
| **koch** | Koch island (the snowflake's square cousin) | 106×106×0 | flat closed curve |
| **levy** | Lévy C curve | 78×126×0 | flat self-similar C |

Findings embedded in the table:

1. **Killing the trunk is the single biggest "not-a-tree" lever.** `bush` and the
   radial dendrite of `snowflake` both work by branching from a *point*, not up a
   *stalk*.
2. **A curve beats a branch when the target is geometric.** `spiral`, `hilbert`,
   and the flat classics are pure paths; they read as coils/curves precisely
   because they have no branch topology to be mistaken for foliage.
3. **Taper that comes from the *grammar* makes a conifer.** `pine`'s cone shape is
   not a render trick: the bottom whorls are introduced earliest, so they expand
   more times and grow larger, producing the taper naturally (§4.4).

---

## 4. Bugs and craft (the hard-won details)

### 4.1 The Hilbert curve rendered *nothing* - a parser bug

`hilbert` shipped blank. The cause was in the **rule parser**, not the geometry.
The original `parseRules` chose its separator with
`line.includes("->") ? "->" : "="`. But the Hilbert body
`X=^<XF^<XFX-F^>>XFX&F+>>XFX-F>X->` contains the substring `->` (a `-` turn
immediately followed by a `>` roll). The parser split there, producing a
multi-character "key" it then rejected - so the rule silently never registered
and the axiom `X` expanded to itself.

**Fix:** anchor the separator to the single-character key:

```
/^(\S)\s*(?:->|=|:)\s*(.*)$/
```

The key is the first non-space character; the separator must follow it; the body
may then contain `->` freely. Lesson: **when a grammar's *data* shares characters
with your *syntax*, parse by position, not by substring search.**

### 4.2 One global angle forces grammar contortions

Because yaw/pitch/roll all share `angle` (§1.2), a grammar can't request an
arbitrary spread. Three branches 120° apart are written as *repeated rolls*
(`/////` ≈ 5 × 22°). This is a genuine fidelity tax paid for a one-knob UI, and it
is why several preset rule strings look like line noise. A parametric L-system
(§7) would let each symbol carry its own angle and remove the tax.

### 4.3 "Make it 3D" can destroy the thing you were drawing

The first `snowflake` attempt took the flat Koch snowflake (`F=F-F++F-F`) and
replaced its in-plane bumps with vertical ones (`F=F&F^^F&F`). It gained depth and
**stopped being a snowflake** - it read as a wrinkled triangle, correctly called
out as such. The lesson: *adding a Z component is not the same as making something
read as 3D-and-still-itself.* The working snowflake keeps the recognisable
**6-fold dendrite** silhouette in-plane and only *adds* out-of-plane branchlets,
so it is a snowflake **and** has depth (21×24×**5.6**). Some classics
(`sierpinski`, `koch`, `levy`) are 2D *by definition* and are left flat on
purpose - forcing them into 3D would make them not those fractals (§7).

### 4.4 Conical taper is a consequence of parallel rewriting

`pine` looks like a conifer because of *when* its branches are born, not any
explicit size control. In `T=FF[&&L]...[&&L]...[&&L]///T`, the trunk `T` adds one
whorl per generation. A whorl created at generation 1 is then rewritten 6 more
times (its `L`s grow bushy); a whorl created at generation 6 is barely expanded.
Early (lower) whorls are therefore larger → a cone. This is a small, pleasing
demonstration that **parallel rewriting encodes a notion of "age" for free.**

### 4.5 Small render-honesty fixes

- **Unbounded yaw in the report.** Auto-spin accumulates `yaw` without wrapping,
  so the debug report read `yaw 711deg`. The display now wraps to `0–359°`
  (the stored value is left untouched - only the readout is normalised).
- **HiDPI clears.** The canvas is cleared in device pixels
  (`setTransform(1,0,0,1,0,0)`), then drawing is done in CSS pixels under
  `setTransform(dpr,…)`, so a fractional `dpr` (e.g. 1.25) never leaves a smear.

---

## 5. Growth animation + the debug-bridge methodology

### 5.1 Progressive growth

Because segments are stored **in turtle (draw) order**, "watch it grow" is almost
free: the renderer draws only the first `reveal · N` segments, and `LCanvas`
animates `reveal` 0→1. Duration scales with size,
`min(GROW_MAX_MS 4200, GROW_MIN_MS 1400 + segments·0.4)`, so a small curve and a
4096-segment tree both feel deliberate. Growth is gated off for reduced-motion
users on load (decorative motion), but the **replay** button always re-runs it.

### 5.2 The debug bridge - and its blind spot

The assistant cannot see the canvas, so the experiment ships a **copyable debug
report** ([`DebugPanel.tsx`](../../src/experiments/l-system/components/DebugPanel.tsx)):
preset, axiom, rules, iterations, angle, geometry (symbols / segments / max depth
/ **bounds W×H×D**), camera (yaw / pitch / zoom / reveal), style, and runtime
(fps / theme / canvas @dpr). It is the same methodology ACO uses, and it worked:
pasting the report back is how the snowflake-is-a-triangle and spiral-is-grass
diagnoses happened.

But this experiment exposed the bridge's **limit**. The report carries *numbers*,
and numbers confirm "3D" (bounds `Z = 5.6 > 0`) - they **cannot confirm
"recognisable."** "Does this look like a bush?" is a perceptual question the text
channel can't answer, which is exactly why the tree-trap took several rounds: the
geometry was *measurably* fine each time (round, wide, 3D) and still *looked*
wrong. The honest takeaway: **a text debug bridge verifies quantities, not
gestalt; for "does it read as X," a human (or a screenshot) is in the loop, and
the design must plan for that latency.**

---

## 6. Fidelity scorecard

| Aspect | Status |
|---|---|
| Parallel rewriting of a context-free DOL-system | ✅ canonical |
| Constants pass through unchanged | ✅ canonical |
| 3D turtle with H/L/U frame, ABOP symbol set (`F f + - & ^ / \ \| [ ]`) | ✅ canonical |
| Bracketed branching via an explicit stack | ✅ canonical |
| Classic grammars (Hilbert, Sierpinski, Koch, Lévy, Barnsley fern) | ✅ faithful to the published rules |
| One global rotation angle for yaw/pitch/roll | ✅* ABOP uses one `δ` too, but real plant models vary it |
| Perspective projection with depth fog, **no occlusion sort** | ✅* intentional - parallax/fog substitute for hidden-line removal |
| Colour by branch depth / draw order | ✅ a visualization aid, not part of the grammar |

---

## 7. Where this is *not* a real L-system toolkit (scope boundary)

Deliberately out of scope - each omission would make it a *different* (and much
larger) system:

- **No parametric L-systems.** Symbols can't carry parameters (`F(2)`, `+(37)`),
  so segment length and angle are uniform and §4.2's roll-count trick is
  unavoidable. Parametric L-systems are what serious plant modelling uses.
- **No stochastic L-systems.** Productions are deterministic; there is no
  `p`-weighted choice, so every preset is identical every time. Real plants use
  stochastic rules for natural variation.
- **No context-sensitive (IL/2L) rules.** A symbol is rewritten regardless of its
  neighbours, so signalling/communication along the structure (e.g. an apex
  triggering flowering) is impossible.
- **No tropisms, no polygons/surfaces, no `{...}` filled regions, no line-width
  or colour symbols (`!` `'`).** Only line segments are drawn.
- **L-systems cannot draw figures.** This is the §0 boundary, stated plainly:
  there is no grammar for "a dragon with a head and four legs," because the parts
  are distinct and non-repeating. `serpent` is a *stylised, self-similar creature*
  (a maned head motif + a repeated body unit), explicitly labelled as not a
  dragon.
- **Flat classics stay flat.** Sierpinski / Koch / Lévy are planar fractals by
  definition; they are rendered in 3D *space* (you can orbit them) but are not
  forced to occupy 3 dimensions.

---

## 8. Further real-world context

- **Origin.** Lindenmayer (1968) introduced L-systems to model the growth of
  filamentous organisms (algae); the parallel rewriting mirrors cells dividing
  simultaneously. Prusinkiewicz & Lindenmayer's *The Algorithmic Beauty of Plants*
  (ABOP, 1990) is the canonical reference and the source of the turtle symbol set
  used here.
- **The families we don't implement** (§7) are the ones that make L-systems
  practically powerful: **parametric** (continuous control of lengths/angles),
  **stochastic** (variation), and **context-sensitive** (signalling). Production
  plant modellers combine all three.
- **Where it's actually used.** Procedural vegetation (SpeedTree and similar
  pipelines descend from L-system ideas), film/game foliage, architectural and
  generative-art tooling, and biological growth simulation. The space-filling
  members (Hilbert, Gosper, Peano) have a second life entirely - **spatial
  indexing and image-scan orders**, where a locality-preserving curve matters.
- **The pedagogical point this experiment makes:** a handful of one-line rules,
  rewritten a few times and walked by a turtle, unfold into a plant, a crystal, or
  a space-filling cube. The *form* is emergent from the *grammar* - and, per §0,
  the grammar's **topology** is what you are really choosing when you pick a
  preset.

---

*Maintained alongside the code. If the turtle symbol set or frame changes, update
§1; if the projection/fog/batching changes, update §2; if presets are added or
re-shaped, update §3 and the §6 scorecard. The §0 finding and the §7 boundary are
the stable spine - keep them honest.*
