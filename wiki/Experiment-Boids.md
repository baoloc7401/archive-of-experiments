# Experiment: Boids Flocking

**Status:** 🟢 live · **Tags:** AI, simulation, fun
**Open:** https://baoloc7401.github.io/archive-of-experiments/experiments/boids

Each boid steers by three local rules - separation, alignment, cohesion - inside
its neighbor radius. No leader and no plan: the flock is whatever emerges from
the sum. A faithful Craig Reynolds (1987) model, scaled to thousands of agents on
a canvas.

## What it is

- The **three rules** as weighted, force-clamped steers, integrated each frame.
- A **forward field of view** (default 300°, a rear blind spot) for lifelike,
  directional flocks.
- A live **Vicsek order parameter** (`φ`, 0 = chaos, 1 = one heading) on a fixed
  `[0,1]` sparkline, plus **heading colour** so an aligned flock collapses to a
  single hue - two views of the same emergence.
- A **rule-inspection overlay**: hover a boid to see its radius, neighbors, and
  the three steering arrows (drawn from the engine's own forces).
- A **world layer**: edge modes (wrap / bounce / avoid), drop-able **obstacles**,
  **goal** waypoints, autonomous **predators**, multiple **species**, a drifting
  **flow field**, and **light-painting trails** with PNG export.
- Eight one-tap **presets** (murmuration, vortex, stampede, huddle, …).

## Try this

- Hover a boid to watch its separation / alignment / cohesion arrows fight.
- Push **alignment** up and watch the order-parameter sparkline climb toward 1
  while the flock collapses to one colour.
- Pick the **goal** tool and click a path - the swarm migrates through it.
- Add a couple of **predators** and watch the flock tear open and re-form.
- Set **species** to 3 and watch factions sort into territories.
- Turn on **trails**, crank the **flow field**, and save a PNG of the ribbons.

## Key findings (the short version)

- **A wrapping stage breaks the model twice over.** Neighbor *distance* must wrap
  (or the flock shears at an invisible seam), and cohesion must be built from
  *relative* offsets, not absolute positions - average positions across the seam
  and the centroid lands on the wrong side of the torus. On a torus there is no
  global "position," only relative displacement.
- **Emergence is invisible until you measure it.** The order parameter and
  heading colour were built to corroborate each other, and do.
- **Scaling to thousands is three moves:** a uniform spatial grid (`O(n²)`→`O(n)`),
  structure-of-arrays storage, and a batched draw (one fill per hue bucket). A Web
  Worker and a quadtree were considered and deliberately skipped.
- **The component is glue; the work is modules.** A 1340-line canvas component was
  split into `simulation.ts` / `render.ts` / `flock.ts` / `palette.ts`; the lesson
  is now a rule in the repo's `CLAUDE.md`.

## Deep dive

📖 **[docs/boids/TEXTBOOK.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/boids/TEXTBOOK.md)**
- the full research record: the steering math, the toroidal-correctness headline,
seeing emergence, the scaling progression, the world layer, a fidelity scorecard,
and real-world context.

🛠 **[docs/boids/IMPROVEMENTS.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/boids/IMPROVEMENTS.md)**
- the tiered roadmap of shipped and skipped work.

## Code

- Engine: [`src/experiments/boids/simulation.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/boids/simulation.ts)
- Rendering: [`src/experiments/boids/render.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/boids/render.ts)
- Flock + formations: [`src/experiments/boids/flock.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/boids/flock.ts)
- React glue: [`src/experiments/boids/components/BoidsCanvas.tsx`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/experiments/boids/components/BoidsCanvas.tsx)

See also: [[Documentation Conventions]] · [[Experiments]]
