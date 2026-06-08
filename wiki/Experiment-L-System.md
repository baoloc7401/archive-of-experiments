# Experiment: L-Systems

**Status:** 🟢 live · **Tags:** math, visualization, fun
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/l-system

A handful of one-line rewrite rules, applied a few times and walked by a **3D
turtle**, unfold into a plant, a snow crystal, or a space-filling cube. Edit the
grammar live, orbit the result, and watch it draw itself. A custom perspective
renderer (no Three.js) carries the whole thing on a 2D canvas.

## What it is

- A **DOL-system rewriter**: an axiom + productions, rewritten in parallel each
  iteration (capped so a runaway grammar can't freeze the tab).
- A **3D turtle** with a heading/left/up frame and the standard ABOP symbol set -
  `F` draw, `+ -` yaw, `& ^` pitch, `/ \` roll, `|` turn around, `[ ]` branch.
- A **custom 3D renderer**: perspective projection with **depth fog** and branch
  taper instead of an occlusion sort - parallax from drag/auto-spin does the rest.
- A live **grammar editor** (axiom + rules), **iterations** and **angle** sliders,
  **colour modes** (depth / order / mono), thickness / taper / fog, and a
  **progressive-growth** reveal you can replay.
- **Eleven presets**, chosen to be *topologically* different rather than
  re-angled trees: tree, bush, fern, pine, spiral, serpent, snowflake, hilbert,
  sierpinski, koch, lévy.
- A copyable **debug report** for relaying exact state back for diagnosis.

## Try this

- Pick **hilbert** and orbit it - a curve that fills a cube.
- Pick **spiral** and watch a pure coil grow (no branches at all).
- Open **snowflake** and spin it: a 6-fold dendrite with real depth.
- Edit a rule live - change `tree`'s angle, or add a `/` roll - and watch it
  rebuild and re-grow.
- Drag the **iterations** slider up one notch at a time to see the grammar
  recurse.

## Key findings (the short version)

- **Topology is destiny.** What an L-system *looks like* is set by the structure
  of its productions, not their angles. The first preset set "all looked like
  trees" because they shared one skeleton (a stalk that branches upward); the fix
  for `bush` was *deleting the trunk* from the rule, not tuning a slider.
- **Some requests are unanswerable, not under-tuned.** An L-system is a
  self-similarity engine and cannot draw a *figure* (an Asian dragon with a head
  and legs). `serpent` is an honestly-labelled stylised creature, not a dragon.
- **A blank Hilbert curve was a parser bug**: the rule body contains `->` (a turn
  then a roll), which the separator splitter mistook for the `key -> value`
  arrow. Parsing by *position* (key = first character) fixed it.
- **"Make it 3D" can destroy the thing.** A snowflake with its bumps folded out of
  plane stopped reading as a snowflake; the fix keeps the 6-fold silhouette and
  only *adds* out-of-plane branchlets.
- **A text debug bridge verifies quantities, not gestalt.** The report could prove
  "this is 3D" (bounds Z > 0) but never "this looks like a bush" - which is why
  the recognisability fixes needed a human in the loop.

## Deep dive

📖 **[docs/l-system/TEXTBOOK.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/l-system/TEXTBOOK.md)**
- the full research record: the rewriting + 3D-turtle model, the depth-cue
renderer, the preset gallery and why each is shaped that way, the parser/3D/taper
findings, the debug-bridge limit, a fidelity scorecard, and the scope boundary
(what L-systems can and can't represent).

## Code

- Rewriting: [`src/experiments/l-system/lsystem.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/l-system/lsystem.ts)
- 3D turtle: [`src/experiments/l-system/turtle.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/l-system/turtle.ts)
- Rendering: [`src/experiments/l-system/render.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/l-system/render.ts)
- Preset grammars: [`src/experiments/l-system/constants.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/l-system/constants.ts)
- React glue: [`src/experiments/l-system/components/LCanvas.tsx`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/l-system/components/LCanvas.tsx)

See also: [[Documentation Conventions]] · [[Experiments]]
