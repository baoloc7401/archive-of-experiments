# Performance Improvements

Action plan for the home page (`https://baoloc7401.github.io/archive-of-experiments/`),
driven by PageSpeed Insights / Lighthouse 13.3.0. Raw reports live in
[pagespeed-scannings/](../../pagespeed-scannings/).

Numbers are lab data under Lighthouse's emulated throttling (mobile = slow 4G +
4x CPU slowdown, desktop = cable + no slowdown), so mobile is the worst case and
where every fix is measured. Rounds 1-2 ran only the **Performance** category;
from Round 3 on all four categories (Performance, Accessibility, Best Practices,
SEO) are captured.

- **Round 1** baseline: `*-1786217779` (mobile) / `*-1786218027` (desktop), 2026-06-08 03:36.
- **Round 2** after fixes: `*-1780893706` (mobile) / `*-1780893568` (desktop), 2026-06-08 04:40.
- **Round 3** re-measure: `*-1780898120` (mobile) / `*-1780898046` (desktop), 2026-06-08 05:54.
- **Round 4** accessibility fixes: shipped 2026-06-08, awaiting re-measure.

## Round 1 fixes - shipped and measured

| Improvement | Status |
| ----------- | ------ |
| ~~#1 Route-based code splitting (`React.lazy` + `Suspense`)~~ | **done** - experiments are now per-route chunks; landing JS 190 -> 125 KiB, unused JS 108 -> 42 KiB |
| ~~#2 Self-host JetBrains Mono (kill the Google Fonts round-trip)~~ | **done** - render-blocking 1,470 -> 450 ms; the 751 ms cross-origin font stylesheet is gone |
| ~~#4 Drop the now-unused `preconnect` hints~~ | **done** - removed with the Google Fonts link |
| #3 Long-cache headers | **won't fix** - GitHub Pages forces a 10-min TTL; hosting limitation, not code |

**Result.** First paint got dramatically faster, **desktop reached 100**, but the
**mobile score went 85 -> 78**. This is expected and is explained below: the fixes
worked, and in doing so they exposed the next bottleneck.

### Scores

| Category    | Mobile (R1 -> R2) | Desktop (R1 -> R2) |
| ----------- | :---------------: | :----------------: |
| Performance | 85 -> **78**      | 99 -> **100**      |

### Core metrics (mobile)

| Metric | R1 | R2 | Verdict |
| ------ | -- | -- | ------- |
| First Contentful Paint   | 3.1 s | **1.8 s** | improved (0.46 -> 0.88) |
| Largest Contentful Paint | 3.1 s | **2.3 s** | improved (0.74 -> 0.93) |
| Speed Index              | 4.8 s | **4.1 s** | improved (0.67 -> 0.79) |
| Time to Interactive      | 3.2 s | 3.2 s     | flat |
| **Total Blocking Time**  | 0 ms  | **690 ms** | **regressed (1.0 -> 0.43)** |
| Cumulative Layout Shift  | 0     | 0.012     | still ~0 (score 1) |

**Why TBT appeared.** TBT is the blocking time *between FCP and TTI*. In Round 1,
FCP was so late (3.1 s) that React + i18n + router booted *before* the first paint,
outside the TBT window, so it scored 0. Round 2 moved FCP to 1.8 s, so that same
~1 s of script execution now lands *after* FCP, inside the window. The split did
not create main-thread work - it uncovered work that was always there. That work
is now the #1 remaining issue.

---

## Round 2 fixes - shipped and measured

Targeting the main-thread / TBT bottleneck Round 1 exposed. Each fix was
verified in the code and confirmed by the Round 3 re-measure below.

| Improvement | Status |
| ----------- | ------ |
| ~~#1 ScrambleText no longer re-renders per frame~~ | **done** - the rAF loop writes `textContent` on a ref'd span instead of `setState` each tick (settles instantly under reduced motion); the per-frame render storm is gone, TBT 690 -> 60 ms |
| ~~#2 Forced reflow removed~~ | **done** - hero + card `mousemove` handlers cache the rect (refreshed on scroll/resize) instead of reading layout each move; `forced-reflow-insight` cleared |
| ~~#3 `vi` locale code-split~~ | **done** - only `en` is eager; `vi` is a dynamic-import chunk loaded on toggle (no flash); landing JS 125 -> 111 KiB gzip |

---

## Round 3 - re-measure

**Result.** The Round 2 fixes worked: the main-thread bottleneck is erased.
**Mobile jumped 78 -> 97**, desktop held **100**, and every mobile metric
improved. This round also captured all four categories for the first time,
surfacing two accessibility audits - now the top remaining issue (below).

### Scores

| Category       | Mobile (R2 -> R3) | Desktop (R2 -> R3) |
| -------------- | :---------------: | :----------------: |
| Performance    | 78 -> **97**      | 100 -> **100**     |
| Accessibility  | n/a -> **96**     | n/a -> **96**      |
| Best Practices | n/a -> **100**    | n/a -> **100**     |
| SEO            | n/a -> **100**    | n/a -> **100**     |

### Core metrics (mobile)

| Metric | R2 | R3 | Verdict |
| ------ | -- | -- | ------- |
| First Contentful Paint   | 1.8 s  | **1.5 s** | improved (0.88 -> 0.95) |
| Largest Contentful Paint | 2.3 s  | **2.0 s** | improved (0.93 -> 0.97) |
| Speed Index              | 4.1 s  | 4.2 s     | flat (0.79 -> 0.78) |
| Time to Interactive      | 3.2 s  | **2.0 s** | improved (score 0.99) |
| **Total Blocking Time**  | 690 ms | **60 ms** | **fixed (0.43 -> 1.0)** |
| Cumulative Layout Shift  | 0.012  | **0**     | still ~0 (score 1) |

**Why TBT dropped.** Round 1 split the work but left ~1 s of script + style/layout
running in the FCP -> TTI window. Round 2 removed that work at its source: no
per-frame React renders from ScrambleText, no synchronous layout reads in the
`mousemove` handlers, and a smaller eager bundle (no `vi`). `forced-reflow-insight`
and `mainthread-work-breakdown` (4.2 s) also dropped off the failing list. The
bottleneck is gone, not relocated.

---

## Round 4 fixes - shipped (awaiting re-measure)

Targeting the two accessibility audits Round 3 surfaced (the only thing between
96 and 100). Exact failing nodes pulled from the mobile report; all were in the
**light** theme.

| Improvement | Status |
| ----------- | ------ |
| ~~#1 `color-contrast` - dim text on near-white~~ | **done** - every failure was the light-theme `--text-dim` (`#9ba3bf`, 2.1-2.5:1). Bumped to `#646c88` - **4.6:1** worst case (on `--bg` `#f0f2f8`), still visibly dimmer than `--text`. `--planned` (same token, used as badge text) bumped to match |
| ~~#1 `color-contrast` - hero accent word~~ | **done** - light-theme `--accent` `#00b899` on its tinted highlight was 2.15:1 (large bold needs 3:1). Darkened to `#00937a` - **3.3:1** |
| ~~#1 `label-content-name-mismatch` - lang toggle~~ | **done** - the visible `EN`/`VI` (decorative state, conveyed by the sliding knob) are now `aria-hidden`, so the button's accessible name is just its `aria-label` with no conflicting visible text |

Expected effect: Accessibility **96 -> 100** on both strategies; Performance
unchanged. Re-run to confirm.

---

## Remaining issues (ranked, Round 3 data)

The performance gap is essentially closed - mobile 97 is bounded by Speed Index
and the GitHub Pages cache TTL, both near their floor. The newly-visible work is
**accessibility**, not performance.

### 1. Accessibility - contrast + label mismatch (96) - addressed in Round 4

**Evidence (both strategies).**

- `color-contrast` (score 0): the light-theme `--text-dim` (`#9ba3bf`) sat at
  2.1-2.5:1 on near-white backgrounds across the dim labels, filter tags, footer
  and segment controls; the hero accent word (`--accent` `#00b899`) was 2.15:1.
- `label-content-name-mismatch` (score 0): the language toggle's `aria-label`
  ("Switch language") did not contain its visible `EN`/`VI` text.

**Fix.** Shipped in **Round 4 above** - darkened `--text-dim`/`--planned` to
`#646c88` and `--accent` to `#00937a`, and `aria-hidden` the toggle's decorative
`EN`/`VI`. **Impact:** high (only thing between 96 and 100, and it's correctness,
not just score). **Effort:** low. **Status:** done, awaiting re-measure.

### 2. Speed Index 4.2 s (the remaining soft performance metric)

**Evidence.** `speed-index` is the only sub-1 performance metric on mobile
(score 0.78); it nudged 4.1 -> 4.2 s (run-to-run noise). Everything else - FCP,
LCP, TBT, TTI, CLS - now scores >= 0.95.

**Cause/fix.** Speed Index measures how fast the viewport visually fills. With
TBT solved, the lever is paint progression: the hero/cards still mount with
scramble + gradient layers that delay visual completeness on a 4x CPU. Staggering
or gating more of that decorative paint would help, but the payoff is small
(~3 points). **Impact:** low. **Effort:** medium.

### 3. Render-blocking app CSS (~450 ms mobile / 80 ms desktop, unchanged)

**Evidence.** `render-blocking-insight`: the gateway `index-*.css` is critical
and still blocks. Same as Round 2 - near the floor; only worth inlining critical
CSS if chasing the last Speed-Index points. **Impact:** low. **Effort:** medium.

### 4. Residual unused JavaScript (41 KiB, unchanged)

**Evidence.** `unused-javascript`: ~41 KiB still unused on first render (was
42 KiB). The `vi` split already shipped; what remains is router internals and UI
primitives the gateway pulls in but doesn't paint. Diminishing returns now that
TBT is gone. **Impact:** low. **Effort:** medium.

### 5. Caching - 199 KiB at a 10-min TTL (unchanged constraint)

**Evidence.** `cache-insight`: **199 KiB** (was 211) served with a 10-min
`Cache-Control`. Still the GitHub Pages hosting limitation, not code - accept
unless a CDN is introduced.

---

## Suggested next round

Performance is effectively done (mobile 97, desktop 100) and the accessibility
fixes shipped in Round 4:

1. **Re-measure** - confirm Round 4 took Accessibility **96 -> 100** on both
   strategies with no performance regression. This is the immediate next step.
2. **(Optional) Speed Index** (Round 3 #2) - stagger/gate the hero + card
   decorative paint to fill the viewport sooner. ~3 points, medium effort.
3. Leave caching (#5) and render-blocking CSS (#3) alone - both are at their
   practical floor given GitHub Pages.

Desktop is at 100 on every category. The remaining work is **mobile Speed Index
and accessibility on both strategies** - the main-thread cost that dominated
Round 2 is gone.

## How to re-measure

Re-run PageSpeed Insights against the deployed home page (requesting **all four
categories**) and compare on the **mobile** tab. With TBT solved, the metrics to
watch are now **Speed Index** and the **Accessibility** audits (`color-contrast`,
`label-content-name-mismatch`). Lab numbers vary run to run; look for a clear
directional move.
