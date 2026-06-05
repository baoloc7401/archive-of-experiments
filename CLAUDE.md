# CLAUDE.md

Guidance for Claude Code working in this repo.

## Commands

```bash
npm run dev        # Vite dev server — NEVER run this; the user runs it themselves
npm run build      # tsc + vite build
npm run lint       # ESLint (lints .ts/.tsx/.js/.jsx)
npx tsc --noEmit   # type-check only
```

No tests. Run `npx tsc --noEmit && npm run build` before committing. **Never run `npm run dev`** — it's a long-running server the user manages, not yours to start.

## Git

Commit format: `type: short description` — lowercase, imperative, no period. Types: `feat`, `fix`, `refactor`, `chore`, `docs`. **Never run `git push`** — only the user pushes.

## Architecture

Single-page gateway listing experiments via [src/experiments.ts](src/experiments.ts). Statuses: `active` (full-card link), `wip`, `planned`.

**Theme:** CSS custom props in two `[data-theme]` blocks in [src/index.css](src/index.css). `data-theme` set on `<html>`; inline script in [index.html](index.html) applies it pre-mount. [useTheme](src/hooks/useTheme.ts) reads attribute as initial state, writes on toggle. No context/provider.

**Card link:** active cards use `position: absolute; inset: 0` anchor (`.card-link`) inside `<article>`. Hover on `.card-active:hover`, not the link.

## Adding an experiment

1. [src/experiments.ts](src/experiments.ts) — add `{id, tags, status: "active", path: "/experiments/{id}"}`.
2. [src/main.tsx](src/main.tsx) — import default from `./experiments/{id}` and add `<Route path="/experiments/{id}" element={<Component />} />`.
3. `src/experiments/{id}/index.tsx` — default-export page component.
4. `src/i18n/locales/{en,vi}.ts` — add `experiments.{id}.title` and `.description`.

Folder convention: `index.tsx` (entry), `{Name}.css`, `types.ts`, `constants.ts`, `components/`. Only `index.tsx` is mandatory.

## Shared imports (from inside an experiment)

- `../../components/ThemeToggle` — needs `theme` + `onToggle` from `useTheme`
- `../../components/LangToggle` — no props
- `../../components/ScrambleText` — see below
- `../../hooks/useTheme` — returns `{theme, toggle}`

## CSS

Plain CSS, no modules/Tailwind. Prefix classes per experiment (e.g. `chess-`, `pf-`). Tokens in [src/index.css](src/index.css): `--bg`, `--bg2`, `--border`, `--text`, `--text-dim`, `--text-hi`, `--accent` (green), `--accent2` (purple), `--wip` (yellow), `--planned`.

Topbar pattern: sticky bar with `← experiments` link (`href="/"`), title, `<ThemeToggle />` right.

## i18n

`src/i18n/locales/{en,vi}.ts` (must stay in sync). Use `useTranslation` + `t('key')`. Card text at `experiments.{id}.{title,description}`. **Translate everything** (en + vi) — no hardcoded user-facing strings.

**Exempt from translation** (stay as-is, not hardcoded violations):
- Debug-report / copy-back text meant to be pasted to Claude, and dev-only `console.log` / diagnostic strings — stay English.
- Proper nouns & brand names — algorithm names (A*, BFS), library names, people/place names, the experiment's own title.
- Code, math & symbols — snippets, formulas, variable names, units (not natural-language prose).
- Kaomoji / emoji — language-neutral; never translated (also excluded from ScrambleText).
- Anything the user explicitly says not to translate.

## ScrambleText

Wrap visible UI text from [src/components/ScrambleText.tsx](src/components/ScrambleText.tsx) when i18n-driven or mutating. Re-animates on `text` prop change. Default: `<ScrambleText text={...} duration={600} />`. For attribute values (e.g. `placeholder`), use the `useScrambledText` hook from [src/components/useScrambledText.ts](src/components/useScrambledText.ts).

**Wrap:** `t(...)` text nodes; toggling labels (play/pause, copy/copied); per-iteration text from runtime data (algorithm names).

**Don't wrap:** per-tick numeric values (thrashes UI); `aria-label`/`title`/non-visible attrs; kaomoji/emoticons (garbles shape); single-glyph icon labels (too short).

## Code rules

- **Never use `eslint-disable` (any form) to silence a warning.** Fix the underlying issue. ESLint runs the strict react-hooks v7 set (`refs`, `set-state-in-effect`, `purity`, `exhaustive-deps`) on all `.ts`/`.tsx`; treat its findings as real and resolve them in code. `npm run lint` must pass with zero warnings.
- TS strict, no `any`. No default-export for types — use `export type`.
- Static propless JSX → JSX constants, not function components.
- Headings: `<h1>` hero, `<h2>` cards.
- All interactives need `:focus-visible`. Global reset in `index.css`; overrides in `App.css`.
