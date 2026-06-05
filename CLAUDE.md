# CLAUDE.md

Guidance for Claude Code working in this repo.

## Commands

```bash
npm run dev        # Vite dev server — NEVER run this; the user runs it themselves
npm run build      # tsc + vite build
npm run lint       # ESLint (lints .ts/.tsx/.js/.jsx)
npx tsc --noEmit   # type-check only
```

No tests. Run `npx tsc --noEmit && npm run build` before committing. The `dev` server is the user's to run — never start it yourself.

## Git

Commit format: `type: short description` — lowercase, imperative, no period. Types: `feat`, `fix`, `refactor`, `chore`, `docs`. **Never run `git push`** — only the user pushes.

## Architecture

Single-page gateway listing experiments via [src/experiments.ts](src/experiments.ts). Statuses: `active` (full-card link), `wip`, `planned`.

**Theme:** CSS custom props in two `[data-theme]` blocks in [src/index.css](src/index.css). `data-theme` set on `<html>`; inline script in [index.html](index.html) applies it pre-mount. [useTheme](src/hooks/useTheme.ts) reads attribute as initial state, writes on toggle. No context/provider.

**Card link:** active cards use `position: absolute; inset: 0` anchor (`.card-link`) inside `<article>`. Hover on `.card-active:hover`, not the link.

## Shared UI (design system)

Experiments share one UI language via primitives in [src/components/ui/](src/components/ui/) (import from the barrel `../../components/ui`). **Use these instead of re-rolling per-experiment CSS** — see [docs/ui-unification.md](docs/ui-unification.md) for the rationale.

- `ExperimentLayout` — page shell: background glow + shared topbar + optional intro strip + sticky stage/sidebar grid (collapses at 860px). Props: `crumbs`, `info?`, `sidebar?`, `centered?` (chess-style max-width shell), `glow?` (`"accent"|"accent2"`), `sidebarWidth?`. Replaces the old per-experiment `*-page`/topbar scaffolding.
- `Button` — `variant: "ghost"|"primary"|"accent"|"pause"`, `size: "sm"|"md"`, `tooltip?` (animated hint). The one control button; don't write bespoke button CSS.
- `Panel` — sidebar box; collapsible (native `<details>`) by default. Props: `title?`, `defaultOpen?`, `collapsible?`, `aside?` (non-interactive badge in the title row).
- `Slider` — labeled range (`<label htmlFor>` wired); `stacked?`, `hint?`, `display?`.
- `ControlBar` — play/pause→step→reset transport row; labels passed in for i18n; `children` for extra controls.
- `Stat` / `StatGrid` — label/value readout cards (`tabular-nums`; values not scrambled). `Stat` takes `highlight?` for an accent-bordered emphasis card; `StatGrid` takes `columns?` (default 2).
- `Tooltip` — hint bubble that fades in on hover/focus and **follows the cursor** (`label`, `block?` for full-width triggers). **Never use native `title` for hints.** Wrap a trigger in `<Tooltip>`; for primitives use `Button`'s `tooltip` / `Slider`'s `hint` (they host the bubble inline, staying one flex/grid item); for a list item or positioned element, host inline — `ui-tip-host` class + `onMouseMove={(e) => trackTip(e.currentTarget, e)}` + a `<span className="ui-tip" role="tooltip">…</span>` child.

**Structural tokens** (theme-independent, `:root` in [src/index.css](src/index.css)): easing `--ease-spring`/`--ease-glide`; durations `--dur-fast`/`--dur-base`/`--dur-move`; radius `--radius-sm/md/lg`. Prefer these over hardcoded literals.

**Reduced motion:** [useReducedMotion](src/hooks/useReducedMotion.ts) (reactive) + `prefersReducedMotion()` (imperative). Gate decorative animation; keep functional motion.

## Adding an experiment

1. [src/experiments.ts](src/experiments.ts) — add `{id, tags, status: "active", path: "/experiments/{id}"}`.
2. [src/main.tsx](src/main.tsx) — import default from `./experiments/{id}` and add `<Route path="/experiments/{id}" element={<Component />} />`.
3. `src/experiments/{id}/index.tsx` — default-export page component. Wrap it in `ExperimentLayout` and build the UI from the shared primitives above; only drop to bespoke CSS for genuinely experiment-specific visuals (boards, canvases, illustrations).
4. `src/i18n/locales/{en,vi}.ts` — add `experiments.{id}.title` and `.description` (and every other UI string — both locales).

Folder convention: `index.tsx` (entry), `{Name}.css`, `types.ts`, `constants.ts`, `components/`. Only `index.tsx` is mandatory.

**SEO is automatic** — no extra step. Any `active` experiment with an `en` `title`/`description` is picked up by [src/seo/site.ts](src/seo/site.ts): the [vite-seo plugin](scripts/vite-seo.ts) bakes a static `<head>` (title, description, canonical, Open Graph, Twitter, JSON-LD) into `dist/experiments/{id}/index.html` and adds it to `sitemap.xml` at build, while [RouteMeta](src/seo/RouteMeta.tsx) keeps tags in sync on SPA navigation. The home page's tags are injected into [index.html](index.html) between the `<!-- seo:start/end -->` markers. Edit site-wide copy (name, description, `og:image`) in `src/seo/site.ts`; regenerate the OG image with `node scripts/gen-og.mjs` after editing `public/og-image.svg`.

## Shared imports (from inside an experiment)

- `../../components/ui` — the design-system primitives (see "Shared UI" above); prefer these
- `../../components/ScrambleText` — see below
- `../../hooks/useReducedMotion` — `useReducedMotion()` / `prefersReducedMotion()`
- `../../components/{ThemeToggle,LangToggle}` + `../../hooks/useTheme` — only if not using `ExperimentLayout` (it wires the topbar toggles itself)

## CSS

Plain CSS, no modules/Tailwind. Prefix classes per experiment (e.g. `chess-`, `pf-`); shared-primitive classes use the `ui-` prefix. Color tokens in [src/index.css](src/index.css): `--bg`, `--bg2`, `--border`, `--text`, `--text-dim`, `--text-hi`, `--accent` (green), `--accent2` (purple), `--wip` (yellow), `--planned`. Plus the structural tokens listed under "Shared UI".

Topbar + page shell come from `ExperimentLayout` — don't hand-roll them. (The raw pattern: sticky bar with `← experiments` link, title, Lang+Theme toggles right.)

## i18n

`src/i18n/locales/{en,vi}.ts` must stay in sync — enforced at compile time: `en` exports `type Translation` (leaves widened) and `vi` ends with `} as const satisfies Translation`, so a missing/extra key in `vi` fails `tsc`. Use `useTranslation` + `t('key')`. Card text at `experiments.{id}.{title,description}`. **Translate everything** (en + vi) — no hardcoded user-facing strings (including `aria-label`s and tooltip labels).

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
