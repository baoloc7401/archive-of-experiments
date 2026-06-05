# Architecture

A single-page React app: a **gateway** that lists experiments, each rendered at
its own route. Plain CSS, strict TypeScript, no global state library.

## Stack

| Concern | Choice |
|---|---|
| Build | Vite |
| UI | React + TypeScript (strict, no `any`) |
| Routing | React Router (`BrowserRouter`, `basename = import.meta.env.BASE_URL`) |
| i18n | i18next + react-i18next (EN/VI) |
| Styling | Plain CSS, per-experiment class prefixes, CSS custom properties |
| Deploy | GitHub Pages (`base: "/archive-of-experiments/"`) |

## Layout

```
src/
├─ experiments.ts        registry: {id, tags, status, path}
├─ main.tsx              routes — one <Route> per experiment
├─ App.tsx               the gateway (filterable card grid)
├─ index.css             theme tokens + global reset
├─ components/           shared: ThemeToggle, LangToggle, ScrambleText, header, cards
├─ hooks/useTheme.ts     theme attribute <-> state
├─ i18n/locales/{en,vi}.ts
└─ experiments/<id>/     one folder per experiment (index.tsx is the entry)
```

## Theming

- Tokens are CSS custom properties defined in two `[data-theme]` blocks in
  [`src/index.css`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/index.css):
  `--bg`, `--bg2`, `--border`, `--text`, `--text-dim`, `--text-hi`, `--accent`
  (green), `--accent2` (purple), `--wip`, `--planned`.
- `data-theme` is set on `<html>`; an inline script in `index.html` applies it
  pre-mount (no flash). `useTheme` reads the attribute as initial state and
  writes on toggle. No context/provider.
- **Canvas experiments read these same tokens** via `getComputedStyle` so they
  match the theme (see ACO's `ColonyCanvas`).

## i18n

- `src/i18n/locales/{en,vi}.ts` must stay in sync. Card text lives at
  `experiments.<id>.{title,description}`.
- **Translate everything** (en + vi) — no hardcoded user-facing strings.
  Exempt: debug-report / copy-back text and dev-only `console.log` (stay
  English); proper nouns & brand names (algorithm names like A*/BFS, libraries,
  the experiment's own title); code, math, symbols & units; kaomoji / emoji
  (language-neutral); and anything the user explicitly says not to translate.
- [`ScrambleText`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/components/ScrambleText.tsx)
  wraps i18n-driven and mutating UI text for the signature decode animation.

## Conventions

- Per-experiment folder: `index.tsx` (entry, mandatory), `{Name}.css`,
  `types.ts`, `constants.ts`, `components/`.
- Class names are prefixed per experiment (`aco-`, `elev-`, `pf-`, `chess-`).
- All interactive elements need a `:focus-visible` style.

The authoritative short version for contributors (and for Claude Code) is
[`CLAUDE.md`](https://github.com/baoloc7401/archive-of-experiments/blob/main/CLAUDE.md).

See also: [[Adding an Experiment]]
