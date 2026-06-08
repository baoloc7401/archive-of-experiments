# Web Performance (PageSpeed / Lighthouse) - Textbook & Real-World Research

Reference code: [`src/index.css`](../../src/index.css) (@font-face + colour
tokens), [`src/components/ScrambleText.tsx`](../../src/components/ScrambleText.tsx),
[`src/components/LangToggle.tsx`](../../src/components/LangToggle.tsx) +
[`LangToggle.css`](../../src/components/LangToggle.css),
[`src/i18n/index.ts`](../../src/i18n/index.ts),
[`index.html`](../../index.html) (font preload),
[`src/App.tsx`](../../src/App.tsx) +
[`src/components/ExperimentCard.tsx`](../../src/components/ExperimentCard.tsx)
(cursor handlers).
Action log: [`IMPROVEMENTS.md`](./IMPROVEMENTS.md) (the round-by-round
measure-fix-remeasure record). Tooling: the `pagespeed-analyze` /
`pagespeed-compare` skills under [`.claude/skills/`](../../.claude/skills/).

This is the research record behind tuning the home page of *Archive of
Experiments* from a mobile Lighthouse Performance of **85 to 96** and
Accessibility to **100/100**, across five rounds of PageSpeed Insights scans on
the deployed GitHub Pages site. It covers how Lighthouse actually scores a page,
where the lab number parts ways with real-world experience, and the specific
traps that only became visible by measuring. Findings accumulated while building
and debugging.

---

## 0. The single most important finding

> **Lighthouse metrics measure overlapping time windows, so fixing one thing
> routinely *exposes* another - and a genuine improvement can lower the score.
> Read the trade, never the headline number.**

The canonical instance happened between Round 1 and Round 2. Self-hosting the
font and code-splitting moved First Contentful Paint from 3.1 s to 1.8 s - an
unambiguous win. Yet the **mobile score dropped 85 -> 78**. Why: Total Blocking
Time is defined as main-thread blocking *between FCP and Time to Interactive*. In
Round 1, FCP was so late (3.1 s) that React + i18n + router booted *before* first
paint, **outside** the TBT window, so TBT scored a perfect 0. Pulling FCP earlier
slid that same ~1 s of script execution *inside* the window, and TBT went 0 ->
690 ms. The work was always there; making the page faster is what revealed it.

The discipline this forces: every re-measure is a diff, not a grade. The
`pagespeed-compare` skill exists precisely to surface "FCP better, TBT worse in
the same run" so you explain the trade instead of panicking at the aggregate.

---

## 1. How Lighthouse scores Performance (the model)

The Performance score is a weighted average of five **lab** metrics under
emulated throttling. Lighthouse 10+ (this project ran 13.3.0) weights them:

| Metric | Weight | What it measures |
| ------ | :----: | ---------------- |
| Total Blocking Time (TBT)      | **30%** | main-thread blocking between FCP and TTI |
| Largest Contentful Paint (LCP) | **25%** | when the biggest above-fold element paints |
| Cumulative Layout Shift (CLS)  | **25%** | unexpected movement of visible content |
| First Contentful Paint (FCP)   | 10% | first text/image painted |
| Speed Index (SI)               | 10% | how quickly the viewport *visually fills* |

Two consequences drove every decision here:

- **TBT + LCP + CLS are 80% of the score.** Time-to-Interactive and
  max-potential-FID still appear in the report but are **not** scored in v10+;
  chasing them is wasted effort. (This doc and `IMPROVEMENTS.md` mention TTI for
  context only.)
- **The throttle is the point.** Mobile = slow-4G + 4x CPU slowdown; desktop =
  cable + no slowdown. Desktop hit 100 early and stayed there - it is not where
  bugs hide. **Mobile is the worst case and the only meaningful gauge.** Every
  number in `IMPROVEMENTS.md` is the mobile tab unless stated.

Each raw metric is mapped to a 0-1 score through a log-normal curve against real
device distributions, so a metric near a curve's knee (e.g. SI around 4 s here)
swings its sub-score a lot for a small time change - which is why SI looked
"noisy" (§7).

## 2. The measurement loop: the report is ground truth

The repo never guesses at audits. The user runs the scans (they hold the PSI API
key) and drops the JSON into [`pagespeed-scannings/`](../../pagespeed-scannings/);
the skills parse it. Two non-obvious things make this reliable:

- **The report names the exact failing node.** Accessibility audits carry the
  CSS selector, the computed foreground/background colours, the font size, and
  the required ratio. Round 4 turned "24 contrast failures" into "all `#9ba3bf`
  on near-white" by reading those nodes - one token fix, not 24 guesses (§4).
  Always pull the nodes before theorising.
- **PSI's downloaded JSON is UTF-16 LE with a BOM.** A naive
  `JSON.parse(readFileSync(p, "utf8"))` throws on the leading bytes. The skills'
  `loadReport()` sniffs the BOM, decodes `utf16le`, strips the leading `﻿`,
  and unwraps `lighthouseResult`. Reuse it rather than re-rolling extraction.

Reports are named `pagespeed-<strategy>-<unixSeconds>.json`; "latest" is the
**embedded timestamp**, not file mtime, so pairing survives a `git checkout` that
resets mtimes.

## 3. Download cost vs main-thread cost (Rounds 1-2)

The first two rounds split cleanly into the two halves of front-end performance.

**Download cost (Round 1).** Route-based code splitting (`React.lazy` +
`Suspense`) made each experiment its own chunk (landing JS 190 -> 125 KiB);
self-hosting JetBrains Mono killed a 751 ms render-blocking cross-origin Google
Fonts stylesheet; the now-pointless `preconnect` hints went with it. Result:
first paint dropped sharply, desktop reached 100.

**Main-thread cost (Round 2),** uncovered by §0. Three changes, all verified in
code and confirmed by the Round 3 re-measure:

- **The render storm.** [`ScrambleText`](../../src/components/ScrambleText.tsx)
  animates ~60 instances on the landing page. It used to `setState` every
  `requestAnimationFrame` tick - thousands of React renders inside the FCP -> TTI
  window. It now writes `node.textContent` on a ref'd span inside a
  `useLayoutEffect`, with **zero** React state in the rAF loop, and settles
  instantly under `prefers-reduced-motion`. This was the dominant TBT source.
- **Forced reflow.** The hero and card cursor-glow handlers read
  `getBoundingClientRect()` on every `mousemove` (a synchronous layout read in
  the same frame as a style write). They now cache the rect and refresh it only
  on scroll/resize; the handler writes `--mx`/`--my` and never reads layout.
- **Eager bundle.** [`i18n/index.ts`](../../src/i18n/index.ts) bundles only `en`
  eagerly and dynamic-imports `vi` on toggle (awaited so there's no flash),
  trimming the landing bundle 125 -> 111 KiB gzip.

Outcome: **TBT 690 -> 60 ms, mobile 78 -> 97**, with `forced-reflow-insight` and
the 4.2 s `mainthread-work-breakdown` dropping off the failing list. The lesson:
the split in Round 1 did not *create* main-thread work, it relocated *when* it
counted; Round 2 removed it at the source.

## 4. Accessibility is contrast math, not taste (Rounds 3-4.1)

Capturing all four categories for the first time in Round 3 surfaced two
`color-contrast`-class audits and a `label-content-name-mismatch`. The findings
here are sharper than the performance ones because contrast is arithmetic.

**WCAG AA thresholds.** Normal text needs **4.5:1**; large text (>= 18.66 px bold
or >= 24 px) only **3:1**. The relative-luminance formula is unforgiving, and two
results fell out of it:

- **Worst case is the *darkest* background a token touches, not white.** The
  light-theme `--text-dim` (`#9ba3bf`) failed at 2.1-2.5:1 across dim labels,
  filter tags, footer and segments. Bumping to `#646c88` cleared 23 of 24 nodes
  at 4.6:1 on `--bg` `#f0f2f8` - but **one** held out: the language toggle's
  label sits over the accent-tinted knob (`color-mix(--accent 18%, white)` =
  `#d1ece7`), darker than plain white, where `#646c88` reached only 4.17:1. The
  fix had to be computed against the knob, not the page background. Lesson: a
  single token can sit on several surfaces; clear the worst one.
- **Some colours cannot pass at all as small text.** The active toggle label was
  `--accent` green. Accent green's own luminance caps its contrast at **~3.85:1
  on pure white** - it can *never* meet 4.5:1 as 9.6 px text, on any background.
  The fix was to stop using it for small text (switch to `--text-hi`) and let the
  accent-tinted *pill* carry the colour cue. Recognising a mathematical ceiling
  saved a round of futile tweaking.

**Two traps worth remembering:**

- **`aria-hidden` does not exempt text from `color-contrast`.** The decorative
  `EN`/`VI` labels are `aria-hidden` (resolving the name-mismatch audit, where an
  `aria-label` must contain the visible text), yet Lighthouse still flagged their
  contrast - the audit checks anything *visually* rendered.
- **The lab only scans one theme.** Every run rendered the default **light**
  theme, so dark theme was never measured. Its `--text-dim` (`#464f6a`) sat at
  ~2.4:1 - the identical failure, invisible to the score. It was fixed for
  correctness (`#7a82a1`, 5.0:1) even though it moves no number. A green lab
  score is not a clean audit; it is a clean audit *of what was rendered*.

## 5. CLS and the font-swap reflow (Round 5)

Round 4.1's re-measure hit Accessibility 100/100 but threw a **new mobile CLS of
0.168** (Performance 97 -> 91). The culprit node was `<main class="grid-section">`
- the entire grid + sidebar block shifting once. Crucially, the v1.5.3 release had
changed only colour tokens and `aria-hidden`, **neither of which affects layout**,
and CLS had been 0 for four straight rounds. The cause was font-swap reflow.

**The mechanism.** JetBrains Mono is self-hosted with the latin 400/700 subsets
preloaded. But under slow-4G throttling even a preloaded 32 KB woff2 arrives
*after* first paint. With `font-display: swap`, the browser paints the fallback
monospace, then **swaps** to JetBrains Mono when it loads; the metric difference
re-lays-out the hero title, and everything below it - the tall grid block - shifts
down. CLS is the integral of such shifts, and it is acutely **timing-dependent**:
earlier rounds simply didn't catch the swap inside the shift window.

**The fix and its honest trade.** Switching every `@font-face` to
`font-display: optional` tells the browser to use the fallback for that load and
**never swap mid-load** - no reflow, CLS 0. The cost: on genuinely slow first
loads (including the Lighthouse mobile lab) the font misses `optional`'s ~100 ms
block window, so that load renders in the fallback monospace and the web font only
appears on a later cached navigation. FCP/LCP are untouched (fallback paints
immediately, exactly as `swap` did). Round 5 confirmed **CLS 0.168 -> 0, mobile
91 -> 96, desktop 99 -> 100.**

The alternative that keeps the web font on *every* load is `swap` plus
`@font-face` metric overrides (`size-adjust` / `ascent-override` /
`descent-override`) so the fallback occupies the same box and the swap causes no
reflow. It was deliberately **not** hand-rolled: wrong override values *worsen*
CLS, and correct ones must be generated from the actual font metrics (fontaine /
capsize). Choosing the guaranteed-correct fix over a guessed "better" one is the
call.

## 6. Lab vs field: what the score faithfully captures

| Aspect | Lab (Lighthouse) faithfully measures | Where it diverges from reality |
| ------ | ------------------------------------ | ------------------------------ |
| Main-thread work (TBT) | ✅ deterministic on fixed CPU throttle | real CPUs vary wildly |
| Layout stability (CLS) | ✅* one cold load | misses post-interaction shifts; timing-sensitive (§5) |
| Paint timing (FCP/LCP) | ✅ under the fixed network throttle | real networks + warm cache differ |
| Speed Index | ✅* visual fill | log-curve knee makes it noisy run-to-run (§7) |
| Accessibility audits | ✅ of the **rendered** theme/state | other themes/states unscanned (§4) |
| Caching | ✅ reports the header | cannot fix it from code (GitHub Pages, §7) |

`✅*` = measured, but with a caveat that bit us at least once.

## 7. Where the Lighthouse score is *not* real performance (scope boundary)

- **Run-to-run variance is real.** Mobile Speed Index swung 4.2 -> 2.7 -> 4.2 s on
  *identical code* across rounds. A single decimal is noise; only a directional
  move across several runs is signal. We never shipped a fix to chase one SI
  reading.
- **One cold, throttled load is not a user.** The lab is a fixed slow-4G/4x-CPU
  cold load with an empty cache. It ignores repeat visits, the field CrUX
  distribution, and faster real devices - the population that actually sees
  JetBrains Mono on first paint despite §5's trade.
- **Some "failures" are not code.** `cache-insight` flags 199 KiB at a 10-minute
  TTL, immutable on GitHub Pages (no header control). Content-hashed assets would
  happily take `max-age=31536000, immutable` behind a CDN. It is a hosting choice,
  permanently "red" in the audit, and correctly left alone.
- **96 is a plateau, not a defect.** With TBT, accessibility and CLS solved, the
  last four mobile points are Speed-Index noise plus render-blocking CSS and
  residual unused JS that are at their practical floor. Pushing them risks more
  than it gains.

## 8. Further real-world context

- **Field data > lab data for decisions.** Lighthouse is a lab tool; Core Web
  Vitals as Google ranks them come from **CrUX** (real Chrome users). The lab is
  for *finding* regressions; the field is for *judging* them.
- **The font-CLS problem is industry-standard.** `size-adjust` and the
  `*-override` descriptors exist specifically for it; tools like **fontaine** and
  **@capsizecss/metrics** automate the override math this doc declined to guess.
- **`optional` vs `swap` vs `block` is a UX policy, not a perf trick.** `optional`
  trades first-load web-font fidelity for zero CLS; that is the right default for
  a CLS-sensitive page but should be a conscious product decision (here it was).
- **TBT is a proxy for INP.** Lab TBT approximates the field's Interaction to Next
  Paint. The Round 2 main-thread work that fixed TBT also makes real interactions
  snappier - the rare case where the lab metric and the felt experience move
  together cleanly.

---

*Maintained alongside the code and [`IMPROVEMENTS.md`](./IMPROVEMENTS.md). If the
font strategy changes, update §5; if the colour tokens in
[`src/index.css`](../../src/index.css) change, re-check §4's ratios; if Lighthouse
changes its metric weights, update §1.*
