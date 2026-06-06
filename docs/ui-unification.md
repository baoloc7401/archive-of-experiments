# UI/UX Unification Plan

Status: **in progress** - Phase 1, 2, 4 done; Phase 3 migration underway (aco done bar 2 deferred items; pathfinding i18n done - primitive adoption pending; elevator, river-crossing, minesweeper, chess remaining).

Goal: unify the UI/UX across all experiments on a single, maintainable house
style with first-class animation support, best-practice accessibility/i18n, and
no "AI-slop" drift (phantom classes, half-translated screens, copy-pasted CSS).

## Approach

We do **not** invent a new look. Four experiments - elevator, aco,
river-crossing, minesweeper - already converged on a good, consistent style.
The plan is to **codify that house style into shared primitives + tokens**, then
migrate the two outliers (chess, pathfinding) into the canon.

### Decisions (locked)

| Decision | Choice |
|---|---|
| Chess layout | **Keep centered** max-width board as a *sanctioned variant* (game, not dashboard). Align its tokens/buttons/prefixes only. |
| Extraction scope | **Full primitive library** - Layout, Button, Slider, Panel, StatRow, ControlBar. |
| i18n | **Full sync** - pathfinding + aco translated en+vi, all hardcoded aria-labels moved into i18n. |
| Execution | This doc only for now; implement phase-by-phase after review. |

## The canonical house style

Any new or migrated experiment should match this:

- **Shell:** full-bleed `<ExperimentLayout>` with `radial-gradient(accent2) + var(--bg)` background and the shared `ExperimentHeader` topbar. (Chess: centered `max-width` content is an allowed override of the shell only.)
- **Layout:** 2-column grid `minmax(0,1fr) <sidebar>` (sidebar 320–340px), collapsing to a single column at one shared breakpoint. **Sidebar is `position: sticky; top: 1rem`** on desktop everywhere.
- **Sidebar content:** `<Panel>` boxes (native `<details>`/`<summary>` base), small uppercase letter-spaced labels, `<StatRow>` for key/value readouts with `tabular-nums`.
- **Controls:** `<Button variant>`, `<Slider>`, `<ControlBar>` for play/pause/step/reset/speed. No bespoke per-experiment button CSS.
- **Type:** inherited monospace stack; no local font overrides; hierarchy via size/weight/letter-spacing.
- **Motion:** transform/opacity (or canvas) only - never layout-thrashing props. Shared easing/duration tokens. `useReducedMotion()` + `prefers-reduced-motion` carve-outs on every animated experiment.
- **Text:** every visible string and aria-label via `t()` (en+vi), wrapped in `ScrambleText` per the existing house rules.
- **Color:** shared tokens for all UI chrome; experiment-local `--<prefix>-*` tokens (theme-aware) only for domain illustration colors. No baked hex/rgba accents.
- **Prefix discipline:** every class prefixed; every interactive has `:focus-visible`.

## Phase 1 - Foundation tokens & hooks

Near-zero risk, unblocks everything.

In [src/index.css](../src/index.css), add beyond the existing color tokens:

- Motion: `--ease-spring: cubic-bezier(0.22,1,0.36,1)`, `--ease-glide: cubic-bezier(0.45,0.05,0.3,1)`, `--dur-fast: 0.18s`, `--dur-base: 0.28s`, `--dur-move: 0.45s` (these exact literals are already copy-pasted across ~9 files).
- Radius: `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`.
- Spacing (optional): `--space-1..6`.

Add `src/hooks/useReducedMotion.ts` - single hook replacing scattered CSS media
queries and the lone raw `matchMedia` call in `useMinesweeper.ts`.

## Phase 2 - Shared primitive library

New files under `src/components/`. Each replaces N copy-pasted implementations.

| Primitive | Replaces | Notes |
|---|---|---|
| `<ExperimentLayout crumbs>` | 6 copy-pasted `*-page` shells + manual `ExperimentHeader` wiring | Owns background gradient, header, and the 2-col grid scaffolding. Chess opts into a `centered` prop. |
| `<Button variant="ghost\|primary\|accent\|pause">` | `aco-btn*`, `ms-btn*`, `elev-*`, `rc-btn*`, `pf-btn*`, `chess-btn` | **Eliminates the phantom `*-btn-ghost` bugs** in aco & minesweeper by making `ghost` real. |
| `<Slider label value min max step onChange>` | aco/elevator/minesweeper custom range thumbs | Label (`htmlFor`-wired) + value display; `stacked?`, `hint?`. |
| `<Panel title defaultOpen>` | `pf-panel`, `rc-panel`, `aco-panel`, generalizes minesweeper `Section.tsx` | `<details>`/`<summary>` base = keyboard-accessible for free. `title?`, `collapsible?`, `aside?`. |
| `<Stat>` / `<StatGrid>` | `pf-panel-stats`, `aco-stats`, elevator/minesweeper stat readouts | Label/value cards, `tabular-nums`; `Stat` has `highlight?`, `StatGrid` has `columns?`. (Implemented as `Stat`/`StatGrid`, not a single `StatRow`.) |
| `<ControlBar>` | play/pause/step/reset/speed in 5 experiments | Props: `playing`, `onPlayPause`, `onStep?`, `onReset?`, labels + `stepHint?`/`resetHint?`; `children` for extra controls (sliders). |

## Phase 3 - Per-experiment sync

| Experiment | Work |
|---|---|
| **pathfinding** | ✅ **Full i18n (en+vi) done** - was the only experiment with zero `t()`; all 3 screens + constants now translated (algorithm proper-noun names kept English per the exemption). **Pending:** primitive adoption (`ExperimentLayout`/`Panel`/`Button`/`Slider`) + responsive breakpoint - kept its `pf-` shell for now to avoid visual churn. |
| **aco** | ✅ done EXCEPT: i18n (all strings + `"traveling salesman"` crumb) ✅, phantom `aco-btn-ghost` ✅, primitives ✅. **Deferred:** `prefers-reduced-motion` on the rAF loop (the ant-crawl *is* the visualization - needs a deliberate step-only fallback, not a blanket gate) and canvas fallback-color tokenization (canvas already reads live tokens via `getComputedStyle`; low value). |
| **minesweeper** | Fix phantom `ms-btn-ghost`; move board aria-labels into i18n; remove dead classes (`ms-flagmode`, `ms-section-title`); review heatmap HSL for light theme. |
| **river-crossing** | Sidebar → sticky; add `:focus-visible` to `.rc-btn` family; move person/bank aria-labels (`"board missionary"`, `"empty"`) into i18n; drop dead `rc-person--static`. |
| **elevator** | Replace baked `rgba(124,108,250,…)` accent literals with token derivations; adopt primitives. |
| **chess** | Keep centered shell. Align to tokens; fix prefix leaks (`move-dot`, `move-ring`, `piece-sliding` → `chess-*`; `grade-*` palette → tokens or `chess-grade-*`). Already the i18n/a11y reference. |

## Phase 4 - Guardrails ✅

- **i18n type safety** - done. `en.ts` exports `type Translation` (a `Widen<typeof en>` that widens literal leaves to base types); `vi.ts` ends with `} as const satisfies Translation`, so a missing/extra Vietnamese key fails `tsc --noEmit`. en/vi were already in sync.
- **CLAUDE.md** - done. Added a "Shared UI (design system)" section; "Adding an experiment" now mandates `ExperimentLayout` + primitives; CSS/i18n/shared-imports sections updated; sanctioned chess `centered` variant documented.

## Suggested order

1. Phase 1 (tokens + hook) - small, safe, lands first.
2. Phase 2 primitives one at a time, each migrated into the 4 already-conformant
   experiments first to prove the API before touching outliers.
3. Phase 3 outliers (pathfinding i18n is the largest single task - can run as its
   own focused pass).
4. Phase 4 guardrails last, once the shape is stable.

Run `npx tsc --noEmit && npm run lint && npm run build` after each phase.
