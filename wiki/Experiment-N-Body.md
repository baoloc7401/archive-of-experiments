# Experiment: N-Body Gravity

**Status:** 🟢 live · **Tags:** simulation, math, visualization
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/n-body

Thousands of bodies fall through each other's gravity in 3D. A Barnes-Hut octree
lumps far-away crowds into single point masses (the **theta** dial trades
exactness for speed), and a symplectic **leapfrog** integrator keeps orbits from
decaying. Drag to orbit, scroll to zoom, click a body to ride along.

## What it is

A hand-rolled **WebGL2** point renderer (no dependencies) over a framework-free
physics engine:

- **Barnes-Hut octree**, `O(n log n)`, exact direct summation at θ = 0.
- **Leapfrog vs explicit Euler** integrators - flip between them and watch the
  energy-drift readout to see why symplectic integrators exist.
- **Collision merging** (inelastic accretion) and **click-to-follow** camera.
- **12 scenes**, each a different gravitational regime (galaxy collision, star
  cluster, solar system, Trojans, figure-8, three-body, accretion disk, tidal
  stream, black hole, cold collapse, …).
- **World-space comet trails**, two-term glow sprites, a parallax starfield, and
  a copyable debug/telemetry report.

## Try this

- Switch the **integrator** to **euler** on the **figure-8** scene and watch the
  braid tear itself apart as energy leaks in.
- Open **three-body**: a hierarchical triple that *dances forever* - then recall
  that a generic chaotic triple would slingshot a body to infinity instead.
- Open **black hole** with trails on: matter spirals in and is consumed.
- Drag **theta** to 0 (exact) on a big scene and watch the force-eval count - and
  the frame rate - jump.
- Set the **time scale** to slow-mo and **follow** a planet in the solar system.

## Key findings (the short version)

- **The hard limit is timescale spread, not body count.** Barnes-Hut makes the
  forces cheap; the difficulty is *time integration*. Every "a body shot off into
  space" bug - the three-body ejection, the solar moons, the black-hole plunge -
  is one disease: a fast/close subsystem below the global timestep.
- **A bound three-body system still ejects a body.** Gravity only pulls, yet a
  close encounter slingshots one body out while the other two tighten into a
  binary. The stable "dance" had to be built as a *hierarchical* triple.
- **The solar system has no moons - on purpose.** At realistic mass ratios a
  moon's period is ~100x shorter than the outer planets', and a single global
  timestep strips them *seed-dependently*. Verified unfixable, then removed.
- **You cannot integrate a singularity.** A naive point-mass black hole flung
  bodies to 6900x the scene radius; capping the central force with a large
  capture radius + matching softening makes infall get *swallowed* instead.
- **Integration fidelity ≠ playback speed.** Separating the per-scene `substep`
  from the persisted `timeScale` is what let the look-settings persist safely.
- **Trails must be world-space geometry**, not screen-space accumulation, or they
  smear when you orbit the camera.

## Deep dive

📖 **[docs/n-body/TEXTBOOK.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/n-body/TEXTBOOK.md)**
- the full research record: the softened Newtonian model, the Barnes-Hut octree
and its performance gotchas, leapfrog vs Euler and the substep/timeScale split,
the three scene findings (three-body ejection, solar moons, black-hole
singularity), the headless numerical-verification methodology, the rendering
findings, a fidelity scorecard, and real-world context (FMM, individual
timesteps, regularization, symplectic maps).

## Code

- Physics: [`src/experiments/n-body/physics.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/n-body/physics.ts)
- Octree: [`src/experiments/n-body/octree.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/n-body/octree.ts)
- Scenes / initial conditions: [`src/experiments/n-body/presets.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/n-body/presets.ts)
- Renderer: [`src/experiments/n-body/renderer.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/n-body/renderer.ts)
- Canvas / loop / camera: [`src/experiments/n-body/components/NBodyCanvas.tsx`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/n-body/components/NBodyCanvas.tsx)

See also: [[Documentation Conventions]] · [[Experiments]]
