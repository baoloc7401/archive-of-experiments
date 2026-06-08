# Site Performance & Accessibility

**Scope:** the gateway home page (and the shared shell every experiment inherits),
not any single experiment.
**Measured on:** https://baoloc7401.github.io/archive-of-experiments/ via PageSpeed
Insights / Lighthouse 13.3.0.

This is the one piece of research that spans the **whole site** rather than a
single experiment: five rounds of measure-fix-remeasure that took the mobile
Lighthouse Performance from **85 to 96** and every other category to **100**, on
both mobile and desktop. The lessons - how Lighthouse actually scores a page, and
where the lab number stops matching real-world experience - apply to every page
the shell renders, so the research record is as substantial as any experiment's.

## Where it landed

| Category | Mobile | Desktop |
|---|:---:|:---:|
| Performance | **96** | **100** |
| Accessibility | **100** | **100** |
| Best Practices | **100** | **100** |
| SEO | **100** | **100** |

Mobile's last four points are Speed-Index run-noise; everything else scores
>= 0.95. Desktop is a clean 100 across the board.

## Key findings (the short version)

- **Metrics measure overlapping windows, so a fix can *lower* the score.**
  Self-hosting the font moved First Contentful Paint earlier, which slid ~1 s of
  pre-existing script execution *into* the Total-Blocking-Time window - mobile
  dropped 85 → 78 even though the page got faster. Every re-measure is a diff to
  explain, never a grade.
- **The work is download cost *then* main-thread cost.** Rounds 1-2: route
  code-splitting + self-hosted fonts + locale splitting moved first paint earlier;
  killing the per-frame `ScrambleText` render storm and a `mousemove` forced
  reflow erased the TBT that earlier paint exposed (78 → 97).
- **Accessibility is arithmetic, not taste.** Contrast failures all traced to one
  dim-text token; the worst-case background was an accent-tinted toggle knob (not
  white); accent green simply *cannot* meet AA as small text (caps ~3.85:1); and
  `aria-hidden` does **not** exempt text from the contrast audit. → 100/100.
- **CLS is timing-dependent font-swap reflow.** Under throttling the web font
  loads after first paint and `font-display: swap` reflows the page; switching to
  `optional` removed the shift (CLS 0.168 → 0) at the deliberate cost of the
  fallback font on the slowest first loads.
- **A green lab score is not a clean audit - it's a clean audit of what was
  rendered.** The scan only ever rendered the light theme; dark theme had the same
  contrast failures, invisible to the score, fixed for correctness anyway.

## Deep dive

📖 **[docs/pagespeed/TEXTBOOK.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/pagespeed/TEXTBOOK.md)**
- the full research record: the Lighthouse scoring model and metric weights, the
metric-interaction headline, download-vs-main-thread cost, the accessibility
contrast math, the CLS / font-swap mechanism and the `optional` trade, a lab-vs-field
honesty table, and where the score is *not* real-world performance.

🛠 **[docs/pagespeed/IMPROVEMENTS.md](https://github.com/baoloc7401/archive-of-experiments/blob/main/docs/pagespeed/IMPROVEMENTS.md)**
- the round-by-round action log (R1 through R5), with the before/after scores and
core metrics for each round.

## Tooling

Two Claude Code skills under
[`.claude/skills/`](https://github.com/baoloc7401/archive-of-experiments/tree/main/.claude/skills)
parse the saved PSI JSON (which is UTF-16 + BOM):
[`pagespeed-analyze`](https://github.com/baoloc7401/archive-of-experiments/blob/main/.claude/skills/pagespeed-analyze/SKILL.md)
(scores + ranked audits) and
[`pagespeed-compare`](https://github.com/baoloc7401/archive-of-experiments/blob/main/.claude/skills/pagespeed-compare/SKILL.md)
(round-over-round delta). Raw reports live in
[`pagespeed-scannings/`](https://github.com/baoloc7401/archive-of-experiments/tree/main/pagespeed-scannings).

## Code touched by this work

- Fonts + colour tokens: [`src/index.css`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/index.css)
- Scramble animation: [`src/components/ScrambleText.tsx`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/components/ScrambleText.tsx)
- Language toggle: [`src/components/LangToggle.tsx`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/components/LangToggle.tsx)
- Locale code-split: [`src/i18n/index.ts`](https://github.com/baoloc7401/archive-of-experiments/blob/main/src/i18n/index.ts)
- Font preload: [`index.html`](https://github.com/baoloc7401/archive-of-experiments/blob/main/index.html)

See also: [[Documentation Conventions]] · [[Architecture]] · [[Home]]
