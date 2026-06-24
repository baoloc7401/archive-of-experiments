# Experiment: Reaction-Diffusion (Gray-Scott)

**Status:** 🟢 live · **Tags:** simulation, math, visualization
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/reaction-diffusion

Two virtual chemicals, **U** and **V**, diffuse across the canvas while V feeds on
U and decays. Tuning just two numbers - feed rate **f** and kill rate **k** - tips
the field between spots, stripes, coral, worms, and mazes: the same **Turing**
mechanism behind leopard spots and fingerprints. Click and drag to seed V and
watch growth spread.

## What it is

A full-canvas **Gray-Scott** reaction-diffusion simulation running entirely on the
GPU - a stateful fragment-shader **ping-pong** between two float textures, with
React as glue only:

- **`RG32F` (float32) state** (U,V in R,G), advanced by an explicit-Euler
  fragment shader with a 9-tap toroidal Laplacian (`texelFetch`, no filtered
  sampling). `Du=1, Dv=0.5, dt=1`.
- **8 named presets** spanning the parameter map (spots, solitons, maze, mitosis,
  fingerprint, coral, worms, u-skate); selecting one re-seeds so it reliably shows
  its own pattern.
- **A brush** that seeds the canonical Gray-Scott nucleus (U≈0.5, V≈0.25) - click
  and drag to grow structure.
- **A live f/k preview inset**, five colour palettes, and a **resolution** control
  (grid size as a multiple of the canvas - 1× is a crisp 1:1 render, up to 2×
  supersampled).
- A copyable **debug panel** with a 96×96 GPU field readback (mean/peak V, active
  %, frame-to-frame Δ, step count, fps, grid, precision).

## Try this

- Nudge **feed** or **kill** by a single notch and watch the whole regime flip -
  the small **f/k preview inset** previews the new regime without disturbing the
  main canvas.
- Open **spots** for a field that never settles, then **coral** (the default) for
  lush branching growth.
- **Click and drag** on the canvas to paint V and watch growth spread from your
  stroke.
- Set **resolution** to **max** for much finer, more numerous features - then open
  the debug panel and watch the fps.
- Hit **reset** to replay the formation transient (most regimes are dynamic while
  forming, then converge to a near-static steady state).

## Key findings (the short version)

- **The seed matters as much as (f,k) - and the two regime families want opposite
  seeds.** Low-feed regimes (mitosis/spots/maze) only ignite from ~one-wavelength
  nuclei; high-feed regimes (coral/worms/u-skate) starve from tiny nuclei and need
  large ones. No single initial condition suits all eight - the working seed is a
  **jittered grid of mixed-size, hard-cored nuclei**.
- **Nothing that looked broken was the equation.** "Dead", "frozen", and "blurry"
  were all *around* the PDE: the seed, the numeric precision, and the sampling
  resolution. The Gray-Scott update was correct from the first commit.
- **Float16 kills the delicate regimes.** Gray-Scott's tiny per-step increments
  round away in `RG16F`; **float32** revived mitosis/worms/fingerprint.
- **"Converged" is not "frozen".** Most regimes reach a static steady state while
  the loop keeps stepping - the debug panel proves it (`steps` climbing, `delta`→0).
- **Blur was a resolution mismatch**, not the shader: the sim grid was smaller than
  the canvas it was upscaled onto. The resolution control ties the grid to the
  canvas (1× = crisp).
- **Flooding V "erases".** Setting V→1 leaves U high, so the reaction annihilates U
  and the disc collapses to substrate. The brush seeds a balanced nucleus instead.

## Deep dive

📖 **[docs/reaction-diffusion/TEXTBOOK.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/reaction-diffusion/TEXTBOOK.md)**
- the full research record: the Gray-Scott model and equations, the GPU ping-pong
implementation, the parameter map and presets, the seeding research (the core
finding), the numeric findings (float16 vs float32, Euler stability, convergence),
the resolution/blur work, the CPU-reference-vs-live-GPU verification methodology, a
fidelity scorecard, the scope boundary, and real-world context (Turing
morphogenesis, Pearson's map, applications).

## Code

- GPU engine: [`src/experiments/reaction-diffusion/simulation.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/reaction-diffusion/simulation.ts)
- Shaders: [`src/experiments/reaction-diffusion/shaders.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/reaction-diffusion/shaders.ts)
- Presets / parameter map: [`src/experiments/reaction-diffusion/presets.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/reaction-diffusion/presets.ts)
- Canvas / loop / brush: [`src/experiments/reaction-diffusion/components/RDCanvas.tsx`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/reaction-diffusion/components/RDCanvas.tsx)
- CPU reference + smoke tests: [`src/experiments/reaction-diffusion/grayscott.test.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/reaction-diffusion/grayscott.test.ts)

See also: [[Documentation Conventions]] · [[Experiments]]
