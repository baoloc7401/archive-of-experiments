# CLAUDE.md

Guidance for Claude Code working in this repo.

## Knowledge graph (query before reading)

A prebuilt graphify knowledge graph lives in `graphify-out/` (gitignored): `graph.json` (~1584 nodes, 65 communities, scoped to `src` + `docs`) and a human digest `GRAPH_REPORT.md`. For "how does X work / what connects to Y / where is Z" questions, run `/graphify query "<question>"` (it answers from `graph.json` and returns `source_location`s, so only the 1-2 relevant files need opening) **before** falling back to Grep/Read across many files. For a fast architecture overview, read `GRAPH_REPORT.md` rather than the tree. The graph is a point-in-time snapshot - after substantial code changes, refresh it with `/graphify . --update`.

## Critical rules

Hard constraints - each is detailed in its section below, collected here so they're never missed:

- **Never run `npm run dev`** - the user runs the dev server themselves.
- **Never run `git push`** - only the user pushes.
- **Never use `eslint-disable`** (any form) - fix the underlying issue; `npm run lint` must pass with zero warnings.
- **Never use the em dash (U+2014)** anywhere - prose, code, comments, i18n, docs, commits. Use ` - `, a comma, colon, or parentheses.
- **Translate every user-facing string** in both `en` and `vi` - no hardcoded English (see i18n exemptions below).
- **Prefer the shared UI primitives** in `src/components/ui/` over bespoke per-experiment CSS.
- **Run `npx tsc --noEmit && npm run lint && npm run build` as one chained command before committing** (single verify step, not three separate calls).

## Commands

```bash
npm run dev        # Vite dev server - NEVER run this; the user runs it themselves
npm run build      # tsc + vite build
npm run lint       # ESLint (lints .ts/.tsx/.js/.jsx)
npx tsc --noEmit   # type-check only
```

No tests. Verify with a single chained command - `npx tsc --noEmit && npm run lint && npm run build` - before committing, rather than three separate tool calls (saves the verify-step tokens). The `dev` server is the user's to run - never start it yourself.

## Git

Commit format: `type: short description` - lowercase, imperative, no period. Types: `feat`, `fix`, `refactor`, `chore`, `docs`. **Never run `git push`** - only the user pushes.

## Architecture

Single-page gateway listing experiments via [src/experiments.ts](src/experiments.ts). Statuses: `active` (full-card link), `wip`, `planned`.

**Theme:** CSS custom props in two `[data-theme]` blocks in [src/index.css](src/index.css). `data-theme` set on `<html>`; inline script in [index.html](index.html) applies it pre-mount. [useTheme](src/hooks/useTheme.ts) reads attribute as initial state, writes on toggle. No context/provider.

**Card link:** active cards use `position: absolute; inset: 0` anchor (`.card-link`) inside `<article>`. Hover on `.card-active:hover`, not the link.

## Shared UI (design system)

Experiments share one UI language via primitives in [src/components/ui/](src/components/ui/) (import from the barrel `../../components/ui`). **Use these instead of re-rolling per-experiment CSS** - see [docs/ui-unification.md](docs/ui-unification.md) for the rationale.

- `ExperimentLayout` - page shell: background glow + shared topbar + optional intro strip + sticky stage/sidebar grid (collapses at 860px). Props: `crumbs`, `info?`, `sidebar?`, `centered?` (chess-style max-width shell), `glow?` (`"accent"|"accent2"`), `sidebarWidth?`. Replaces the old per-experiment `*-page`/topbar scaffolding.
- `Button` - `variant: "ghost"|"primary"|"accent"|"pause"`, `size: "sm"|"md"`, `tooltip?` (animated hint). The one control button; don't write bespoke button CSS.
- `Panel` - sidebar box; collapsible (native `<details>`) by default. Props: `title?`, `defaultOpen?`, `collapsible?`, `aside?` (non-interactive badge in the title row).
- `Slider` - labeled range (`<label htmlFor>` wired); `stacked?`, `hint?`, `display?`.
- `ControlBar` - play/pause→step→reset transport row; labels passed in for i18n; `children` for extra controls.
- `Stat` / `StatGrid` - label/value readout cards (`tabular-nums`; values not scrambled). `Stat` takes `highlight?` for an accent-bordered emphasis card; `StatGrid` takes `columns?` (default 2).
- `Tooltip` - hint bubble that fades in on hover/focus and **follows the cursor** (`label`, `block?` for full-width triggers). **Never use native `title` for hints.** Wrap a trigger in `<Tooltip>`; for primitives use `Button`'s `tooltip` / `Slider`'s `hint` (they host the bubble inline, staying one flex/grid item); for a list item or positioned element, host inline - `ui-tip-host` class + `onMouseMove={(e) => trackTip(e.currentTarget, e)}` + a `<span className="ui-tip" role="tooltip">…</span>` child.

**Structural tokens** (theme-independent, `:root` in [src/index.css](src/index.css)): easing `--ease-spring`/`--ease-glide`; durations `--dur-fast`/`--dur-base`/`--dur-move`; radius `--radius-sm/md/lg`. Prefer these over hardcoded literals.

**Reduced motion:** [useReducedMotion](src/hooks/useReducedMotion.ts) (reactive) + `prefersReducedMotion()` (imperative). Gate decorative animation; keep functional motion.

## Adding an experiment

1. [src/experiments.ts](src/experiments.ts) - add `{id, tags, status: "active", path: "/experiments/{id}"}`.
2. [src/AppRoutes.tsx](src/AppRoutes.tsx) - add a `lazy(() => import("./experiments/{id}"))` and a `<Route path="/experiments/{id}" element={<Component />} />`.
3. `src/experiments/{id}/index.tsx` - default-export page component. Wrap it in `ExperimentLayout` and build the UI from the shared primitives above; only drop to bespoke CSS for genuinely experiment-specific visuals (boards, canvases, illustrations).
4. `src/i18n/locales/{en,vi}.ts` - add `experiments.{id}.title` and `.description` (and every other UI string - both locales).

Folder convention: `index.tsx` (entry), `{Name}.css`, `types.ts`, `constants.ts`, `components/`. Only `index.tsx` is mandatory.

**Keep simulation/render logic out of the React component.** The component is glue (refs, effects, rAF loop, handlers); put the per-tick engine in a framework-free `simulation.ts` and canvas drawing in `render.ts` (`drawScene(state)`), with `flock.ts`/`palette.ts` etc. as needed. Split when a component passes ~300 lines, a function runs longer than a screen, a helper touches no refs/props, or a block gets pasted twice.

**SEO is automatic** - no extra step. Any `active` experiment with an `en` `title`/`description` is picked up by [src/seo/site.ts](src/seo/site.ts): the [vite-seo plugin](scripts/vite-seo.ts) bakes a static `<head>` (title, description, canonical, Open Graph, Twitter, JSON-LD) into `dist/experiments/{id}/index.html` and adds it to `sitemap.xml` at build, while [RouteMeta](src/seo/RouteMeta.tsx) keeps tags in sync on SPA navigation. The home page's tags are injected into [index.html](index.html) between the `<!-- seo:start/end -->` markers. Edit site-wide copy (name, description, `og:image`) in `src/seo/site.ts`; regenerate the OG image with `node scripts/gen-og.mjs` after editing `public/og-image.svg`.

## Shared imports (from inside an experiment)

- `../../components/ui` - the design-system primitives (see "Shared UI" above); prefer these
- `../../components/ScrambleText` - see below
- `../../hooks/useReducedMotion` - `useReducedMotion()` / `prefersReducedMotion()`
- `../../components/{ThemeToggle,LangToggle}` + `../../hooks/useTheme` - only if not using `ExperimentLayout` (it wires the topbar toggles itself)

## CSS

Plain CSS, no modules/Tailwind. Prefix classes per experiment (e.g. `chess-`, `pf-`); shared-primitive classes use the `ui-` prefix. Color tokens in [src/index.css](src/index.css): `--bg`, `--bg2`, `--border`, `--text`, `--text-dim`, `--text-hi`, `--accent` (green), `--accent2` (purple), `--wip` (yellow), `--planned`. Plus the structural tokens listed under "Shared UI".

Topbar + page shell come from `ExperimentLayout` - don't hand-roll them. (The raw pattern: sticky bar with `← experiments` link, title, Lang+Theme toggles right.)

## i18n

`src/i18n/locales/{en,vi}.ts` must stay in sync - enforced at compile time: `en` exports `type Translation` (leaves widened) and `vi` ends with `} as const satisfies Translation`, so a missing/extra key in `vi` fails `tsc`. Use `useTranslation` + `t('key')`. Card text at `experiments.{id}.{title,description}`. **Translate everything** (en + vi) - no hardcoded user-facing strings (including `aria-label`s and tooltip labels).

**Exempt from translation** (stay as-is, not hardcoded violations):
- Debug-report / copy-back text meant to be pasted to Claude, and dev-only `console.log` / diagnostic strings - stay English.
- Proper nouns & brand names - algorithm names (A*, BFS), library names, people/place names, the experiment's own title.
- Code, math & symbols - snippets, formulas, variable names, units (not natural-language prose).
- Kaomoji / emoji - language-neutral; never translated (also excluded from ScrambleText).
- Anything the user explicitly says not to translate.

## ScrambleText

Wrap visible UI text from [src/components/ScrambleText.tsx](src/components/ScrambleText.tsx) when i18n-driven or mutating. Re-animates on `text` prop change. Default: `<ScrambleText text={...} duration={600} />`. For attribute values (e.g. `placeholder`), use the `useScrambledText` hook from [src/components/useScrambledText.ts](src/components/useScrambledText.ts).

**Wrap:** `t(...)` text nodes; toggling labels (play/pause, copy/copied); per-iteration text from runtime data (algorithm names).

**Don't wrap:** per-tick numeric values (thrashes UI); `aria-label`/`title`/non-visible attrs; kaomoji/emoticons (garbles shape); single-glyph icon labels (too short).

## Code rules

- **Never use the em dash (U+2014) anywhere in the repo**: not in prose, code, comments, i18n strings, docs, or commit messages. Use a spaced hyphen (` - `), comma, colon, or parentheses instead. This applies to everything you write or edit.
- **Never use `eslint-disable` (any form) to silence a warning.** Fix the underlying issue. ESLint runs the strict react-hooks v7 set (`refs`, `set-state-in-effect`, `purity`, `exhaustive-deps`) on all `.ts`/`.tsx`; treat its findings as real and resolve them in code. `npm run lint` must pass with zero warnings.
- TS strict, no `any`. No default-export for types - use `export type`.
- Static propless JSX → JSX constants, not function components.
- Headings: `<h1>` hero, `<h2>` cards.
- All interactives need `:focus-visible`. Global reset in `index.css`; overrides in `App.css`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
