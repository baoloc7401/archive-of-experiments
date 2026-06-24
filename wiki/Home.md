# archive-of-experiments

> A sandbox for algorithms, curiosity, and deliberate learning.
> Half-baked ideas. Fully-baked bugs.

A single-page gateway to a growing set of interactive algorithm & simulation
experiments - each a self-contained, themed, bilingual (EN/VI) visualization.

- **Live site:** https://baoloc7401.github.io/archive-of-experiments/
- **Repository:** https://github.com/baoloc7401/archive-of-experiments
- **Stack:** Vite + React + TypeScript (strict), React Router, i18next, plain CSS.

---

## Start here

- 🧪 **[[Experiments]]** - the full catalogue with status and deep-dives.
- 🏛 **[[Architecture]]** - how the gateway, theming, routing, and i18n fit together.
- ➕ **[[Adding an Experiment]]** - the step-by-step to ship a new one.
- 📚 **[[Documentation Conventions]]** - what TEXTBOOK / ISSUES / IMPROVEMENT docs are for.
- ⚡ **[[Site Performance]]** - the site-wide PageSpeed & accessibility research (mobile 85 → 96, all categories 100 on desktop).

---

## Experiment status

| Experiment | Status | Wiki | Research docs |
|---|---|---|---|
| [[Experiment Chess]] | 🟢 live | [[Experiment Chess]] | TEXTBOOK · IMPROVEMENT · ISSUES |
| [[Experiment Pathfinding]] | 🟢 live | [[Experiment Pathfinding]] | TEXTBOOK |
| [[Experiment Elevator]] | 🟢 live | [[Experiment Elevator]] | TEXTBOOK · ISSUES |
| [[Experiment ACO]] | 🟢 live | [[Experiment ACO]] | TEXTBOOK |
| [[Experiment River Crossing]] | 🟢 live | [[Experiment River Crossing]] | TEXTBOOK |
| [[Experiment Minesweeper]] | 🟢 live | [[Experiment Minesweeper]] | TEXTBOOK |
| [[Experiment Boids]] | 🟢 live | [[Experiment Boids]] | TEXTBOOK · IMPROVEMENT |
| [[Experiment L-System]] | 🟢 live | [[Experiment L-System]] | TEXTBOOK |
| [[Experiment N-Body]] | 🟢 live | [[Experiment N-Body]] | TEXTBOOK |
| [[Experiment Reaction-Diffusion]] | 🟢 live | [[Experiment Reaction-Diffusion]] | TEXTBOOK |
| Sorting Visualizer | 🟡 wip | - | - |
| Binary Tree Explorer | ⚪ planned | - | - |
| Bloom Filter | ⚪ planned | - | - |
| Cellular Automata | ⚪ planned | - | - |
| Fourier Drawing | ⚪ planned | - | - |

🟢 live = full interactive experiment · 🟡 wip = in progress · ⚪ planned = stub.

---

## Site-level research

Not every research record is about one experiment. The shared shell - the home
page, theme, fonts, and animation that every experiment inherits - carries its
own deep-dive:

- ⚡ **[[Site Performance]]** - five rounds of PageSpeed / Lighthouse tuning and a
  full accessibility pass on the gateway. Mobile Performance **85 → 96**,
  Accessibility / Best Practices / SEO **100** on both strategies, with the
  durable lessons written up the same way an experiment's are
  ([TEXTBOOK](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/pagespeed/TEXTBOOK.md)
  · [IMPROVEMENTS](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/pagespeed/IMPROVEMENTS.md)).

---

## What makes this repo unusual

- **Every experiment is faithful to its algorithm.** The visualizations aren't
  decorative - they model the real mechanism (see [[Documentation Conventions]]).
- **Findings are written down.** Each substantial experiment carries a
  research-grade `TEXTBOOK.md` (theory + fidelity + what we learned) and, where
  the build was hard-won, an `ISSUES.md` craft log.
- **One cohesive shell.** Shared theme tokens (dark/light), a scramble-text
  animation, language toggle, and a consistent topbar across every experiment.

---

*This wiki is the human-facing portal. The canonical, code-adjacent docs live in
[`docs/`](https://github.com/baoloc7401/archive-of-experiments/tree/main/docs)
in the repository and are linked from each experiment page.*
