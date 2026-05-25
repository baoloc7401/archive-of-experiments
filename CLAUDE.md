# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start Vite dev server
npm run build      # production build (runs tsc + vite build)
npm run lint       # ESLint
npx tsc --noEmit   # type-check only, no emit
```

There are no tests yet. Always run `npx tsc --noEmit && npm run build` before committing to confirm zero errors.

## Git

Commit format: `type: short description` — lowercase, imperative, no period.  
Types used in this repo: `feat`, `fix`, `refactor`, `chore`, `docs`.

**Only the user pushes.** Never run `git push`.

## Architecture

The app is a single-page gateway that lists experiments. There is no router — each experiment card links out to its own path when ready.

**Adding an experiment:** add one entry to [src/experiments.ts](src/experiments.ts). The card renders automatically. Statuses: `active` (renders a full-card link), `wip`, `planned`.

**Theme system:** theme tokens live as CSS custom properties in two `[data-theme]` blocks in [src/index.css](src/index.css). The active theme is set as a `data-theme` attribute on `<html>`. An inline script in [index.html](index.html) applies the stored theme before React mounts to prevent flash. `useTheme` in [src/hooks/useTheme.ts](src/hooks/useTheme.ts) reads the already-set attribute as initial state and writes back on toggle — no React context, no provider.

**Card link pattern:** active cards render a `position: absolute; inset: 0` anchor (`.card-link`) inside the `<article>`. This makes the whole card clickable without wrapping the card in `<a>` or using `:has()`. Hover styles are triggered on `.card-active:hover` (the article), not the link.

## Code rules

- TypeScript strict mode, no `any`.
- No default `export` for types — use `export type`.
- Icons and other static JSX with no props are JSX constants, not function components.
- Heading hierarchy: `<h1>` in the hero, `<h2>` in cards.
- All interactive elements need a `:focus-visible` style. The global reset in `index.css` covers most; component-level overrides live in `App.css`.
