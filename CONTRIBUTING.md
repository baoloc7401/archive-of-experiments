# Contributing

So you want to add a thing to the Archive. Excellent. This is a junk drawer of small interactive experiments: algorithm visualizers, simulations, the occasional game, the occasional "I wonder what this looks like if it moves." Each one lives behind its own card on the front page and pretends it is a serious project.

There are rules here, but they exist for a reason: every experiment should feel like it came from the same hand. Same buttons, same sliders, same glow in the corner. Read on and you will fit right in.

## Get it running

You need Node 20 or newer and npm. That is the whole shopping list.

```bash
npm install
npm run dev
```

Vite prints a local URL. Open it. Save a file, watch it reload before your finger leaves the keyboard. One thing though: `npm run dev` is the maintainer's to run. If you are working with Claude Code in here, it will not start the dev server for you, and that is on purpose, not laziness.

## The scripts you will actually type

```bash
npm run dev        # the live server (yours to run)
npm run build      # tsc + vite, spits out dist/
npm run lint       # ESLint, and it is not in a forgiving mood
npm run preview    # serve the built dist/ to double-check
npx tsc --noEmit   # types only, no output
```

Before you open a pull request, run the holy trinity:

```bash
npx tsc --noEmit && npm run build && npm run lint
```

All three pass or it does not ship. And when we say lint passes, we mean **zero warnings**, not "zero errors and a comfortable pile of warnings." The linter is part of the team. Do not disable it to win an argument (more on that below).

## What it is built from

- React 19 and TypeScript in strict mode, on Vite 8.
- React Router, one route per experiment.
- i18next for translations, because everything ships in English and Vietnamese.
- Plain CSS. No modules, no Tailwind, no build-a-class-name machine.

## Where things live

```
src/
  experiments.ts        # the registry: every experiment's id, tags, status, path
  main.tsx              # the route table
  index.css             # theme tokens + structural tokens (the source of truth for color and motion)
  components/ui/        # the shared design system. your new best friend
  components/           # ScrambleText, the toggles, the odds and ends
  hooks/                # useTheme, useReducedMotion, friends
  i18n/locales/{en,vi}.ts
  seo/                  # the SEO that happens whether you think about it or not
  experiments/{id}/     # your experiment goes here
scripts/                # the vite-seo plugin, the OG image generator
docs/                   # notes-to-self about how each thing actually works
```

## Adding an experiment

Four steps. None of them are hard. All of them are load-bearing.

1. **Put it in the registry.** [src/experiments.ts](src/experiments.ts):
   ```ts
   { id: "my-thing", tags: ["algorithms"], status: "active", path: "/experiments/my-thing" }
   ```
   `active` means a real, clickable card. `wip` means "visible but no link, come back later." `planned` is a polite IOU.

2. **Wire the route.** In [src/main.tsx](src/main.tsx), import the default export from `./experiments/my-thing` and add `<Route path="/experiments/my-thing" element={<MyThing />} />`. Forget this and your experiment exists in spirit only.

3. **Build the page.** `src/experiments/my-thing/index.tsx`, default-exported component, wrapped in `ExperimentLayout`. The only mandatory file is `index.tsx`; the rest of the convention (`{Name}.css`, `types.ts`, `constants.ts`, `components/`) is there when you grow into it.

4. **Speak both languages.** Add your strings to [src/i18n/locales/en.ts](src/i18n/locales/en.ts) and [src/i18n/locales/vi.ts](src/i18n/locales/vi.ts). At the very least `experiments.my-thing.title` and `.description`, plus every other word a human will read.

The SEO takes care of itself. Any `active` experiment with an English title and description gets a baked `<head>` and a spot in `sitemap.xml` at build time. You do not need to touch it. You are welcome.

## Use the shared UI. Seriously.

This is the part people are tempted to skip, and it is the part that keeps the Archive from looking like a ransom note. Everything visual is already built and waiting in [src/components/ui/](src/components/ui/). Import from the barrel (`../../components/ui`) and reach for these before you write a single line of your own button CSS:

- `ExperimentLayout` - the whole page shell: the glow, the topbar, the sticky stage-and-sidebar grid.
- `Button` - the one true button. It has variants. It does not need a sibling.
- `Panel` - a collapsible sidebar box.
- `Slider` - a labeled range with hints baked in.
- `ControlBar` - the play / pause / step / reset row you were about to reinvent.
- `Stat` and `StatGrid` - tidy little label-and-value readouts.
- `Tooltip` - a hint bubble that follows the cursor. Use it. The native `title` attribute is banned for hints, and yes we will notice.

Drop down to custom CSS only for the genuinely bespoke stuff: a chess board, a canvas, an illustration that could not possibly be a `Panel`. When you do, pull your colors, easings, durations and radii from the tokens in [src/index.css](src/index.css). Hardcoded `#3a3a3a` and `0.2s` are how the drift starts.

And if your experiment moves: gate the decorative motion behind `useReducedMotion()` or `prefersReducedMotion()`. Some people get motion sick from your beautiful particle field. Keep the motion that does a job; lose the motion that is just showing off.

## Translations, the non-negotiable kind

Every string a user can see exists in both `en` and `vi`. That includes `aria-label`s and tooltip text, the bits nobody photographs. This is not on the honor system: `en` defines the type, `vi` has to satisfy it, and `tsc` fails the build if either side has a key the other does not. The compiler is the bouncer.

Some things stay in English and that is correct, not laziness:

- Debug and copy-back text, the stuff meant to be pasted back to a developer.
- Dev-only `console.log` noise.
- Proper nouns and algorithm names. A* is A* in every language. So is BFS.
- Code, math, symbols, units.
- Kaomoji and emoji, which are already universal and which `ScrambleText` will happily mangle if you let it.

Speaking of which: wrap visible text that is translated or changes at runtime in `ScrambleText` for the nice settling animation. Do not wrap numbers that tick every frame (it thrashes), invisible attributes, or single glyphs.

## House style, briefly

- TypeScript strict. No `any`. We did not come this far to type `any`.
- **No em dashes. Anywhere.** Not in prose, code, comments, strings, docs, or commit messages. Use a spaced hyphen, a comma, a colon, or parentheses. This is the one stylistic hill we will actually die on.
- **No `eslint-disable`, in any flavor.** If the linter is complaining, the linter is usually right. Fix the code, do not silence the smoke alarm.
- Static JSX with no props belongs in a constant, not a component.
- `<h1>` is the hero. `<h2>` is a card. Pick the right one.
- Everything you can click or tab to needs a `:focus-visible` style. Keyboards are people too.
- Plain CSS, prefixed per experiment (`chess-`, `pf-`, you get it). Shared primitives wear the `ui-` prefix.

## Commits and pull requests

Commit messages look like `type: short thing it does`. Lowercase, imperative, no period at the end, like you are giving the codebase a gentle order. The types are `feat`, `fix`, `refactor`, `chore`, `docs`. That is the whole alphabet.

Keep a pull request about one idea. A PR that fixes a bug, renames a folder, and "also tidies some imports" is three PRs in a trench coat. And run the holy trinity before you ask for review so the robots and the humans are reading the same code.

Releases (version bump, tag, the GitHub release) are a maintainer move. Only maintainers push and publish, so do not worry about it.

## When something is broken

A good bug report is one we can act on without playing twenty questions. Give us:

- What went wrong, in plain words.
- How to make it go wrong again.
- What you expected versus what you got.
- The boring details: OS, Node version, browser, and which experiment.

If it is a visual bug, a screenshot or a five-second clip is worth a thousand "it looks weird"s.

## Stuck?

Skim the open issues and the notes in [docs/](docs/) first, because past-you (or past-someone) may have already left an answer there. If not, open an issue and tell us what you were trying to do. "It does not work" is a feeling, not a report.

## The legal bit

By contributing, you agree your work goes out under the same license as everything else here: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). The full, gloriously long text is in [LICENSE](LICENSE). Here is what it actually means for you.

What you, and anyone, are free to do:

- **Share it.** Copy the code, fork the repo, mirror it wherever you like.
- **Remix it.** Modify it, build on it, rip one experiment out and frankenstein it into your own thing.

The two strings attached:

- **Attribution.** Keep the credit. If you share or adapt this, say where it came from and link back. Do not file the serial numbers off and call it yours.
- **NonCommercial.** This is the big one. You cannot use this, or anything derived from it, primarily to make money. No selling it, no paywall, no bundling it into a product you charge for, no "it is free but the ads pay me." It is a playground, not inventory.

A few things worth being clear about, because licenses are slippery:

- "NonCommercial" is about primary purpose, not whether a single dollar ever changes hands. Dropping an experiment into a paid course, a client deliverable, or a monetized app is commercial. Showing it in a school project, a blog post, a talk, or your portfolio is not.
- This license covers **the code and experiments in this repo**. It does not relicense the third-party stuff in `node_modules`; those dependencies keep their own (mostly MIT) licenses, which is normal and fine.
- It comes with **no warranty**. If an experiment eats your afternoon or spins your GPU fan up like a jet engine, that is between you and physics. Sections 5 and 6 of the [LICENSE](LICENSE) are the formal way of saying "you are on your own."
- If you actually need a commercial use, the move is not "ignore the license," it is "ask." Licenses can be granted. Mind-reading cannot.

If any of that is fuzzy, the plain-language summary lives at [creativecommons.org/licenses/by-nc/4.0](https://creativecommons.org/licenses/by-nc/4.0/), and the real legal text is right there in [LICENSE](LICENSE).

Now go build something weird. Happy experimenting, weirdos.
