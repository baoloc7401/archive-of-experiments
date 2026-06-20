# archive-of-experiments

A personal sandbox for testing algorithms, exploring ideas, and learning through code.

Built with **React + Vite + TypeScript**.

[![Performance 96](https://img.shields.io/badge/Performance-96-brightgreen?style=flat-square&logo=lighthouse&logoColor=white)](docs/pagespeed/IMPROVEMENTS.md)
[![Accessibility 100](https://img.shields.io/badge/Accessibility-100-brightgreen?style=flat-square&logo=lighthouse&logoColor=white)](docs/pagespeed/IMPROVEMENTS.md)
[![Best Practices 100](https://img.shields.io/badge/Best%20Practices-100-brightgreen?style=flat-square&logo=lighthouse&logoColor=white)](docs/pagespeed/IMPROVEMENTS.md)
[![SEO 100](https://img.shields.io/badge/SEO-100-brightgreen?style=flat-square&logo=lighthouse&logoColor=white)](docs/pagespeed/IMPROVEMENTS.md)

<sub>Lighthouse 13.3.0, mobile (slow-4G + 4x CPU), [live home page](https://baoloc7401.github.io/archive-of-experiments/), 2026-06-08.</sub>

## Performance

The home page is tuned against PageSpeed Insights and the results are tracked
round by round in [docs/pagespeed/IMPROVEMENTS.md](docs/pagespeed/IMPROVEMENTS.md)
(with the durable lessons in [TEXTBOOK.md](docs/pagespeed/TEXTBOOK.md)). Latest
scan:

| Category       | 📱 Mobile | 🖥️ Desktop |
| -------------- | :-------: | :--------: |
| Performance    | **96**    | **100**    |
| Accessibility  | **100**   | **100**    |
| Best Practices | **100**   | **100**    |
| SEO            | **100**   | **100**    |

**Core Web Vitals** (mobile, the throttled worst case):

| FCP | LCP | TBT | CLS | Speed Index |
| :-: | :-: | :-: | :-: | :---------: |
| 1.6 s | 2.0 s | 70 ms | **0** | 4.2 s |

Curious how it got there? The About page has a live `pagespeed` terminal command
that renders these same scores as bars - try it at
[/about](https://baoloc7401.github.io/archive-of-experiments/about).

## Run locally

```bash
npm install
npm run dev
```

## Structure

```
src/
  experiments.ts          # experiment registry
  components/
    ExperimentCard.tsx    # card component
  App.tsx                 # gateway index
```

Each experiment lives under `src/experiments/<id>/`. Add a new entry to `experiments.ts` to surface it on the index.

## Status tags

| Badge    | Meaning                       |
|----------|-------------------------------|
| LIVE     | Finished and interactive      |
| WIP      | In progress                   |
| PLANNED  | On the list                   |

## Philosophy

> The best way to learn is to build something, break it, and understand why.

## License & notices

Original code and artwork are licensed under
[CC BY-NC 4.0](LICENSE) (non-commercial, with attribution). Some experiments are
educational homages to existing games and reference third-party trademarks
nominatively; see [NOTICE.md](NOTICE.md) for the attributions and
non-affiliation disclaimers (e.g. the Pac-Man and Minesweeper studies).
