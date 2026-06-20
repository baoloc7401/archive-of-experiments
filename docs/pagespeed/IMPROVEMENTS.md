# Home Page - Performance Improvements

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
- **Round 4** accessibility fixes: `*-1780900561` (mobile) / `*-1780900579` (desktop), 2026-06-08 06:36.
- **Round 4.1** last contrast node + toggle/dark-theme hardening: `*-1780902058` (mobile) / `*-1780902076` (desktop), 2026-06-08 07:01.
- **Round 5** mobile CLS (font-display: optional): `*-1780903358` (mobile) / `*-1780903374` (desktop), 2026-06-08 07:22.

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

## Round 4 fixes - shipped and measured

Targeting the two accessibility audits Round 3 surfaced (the only thing between
96 and 100). Exact failing nodes pulled from the mobile report; all were in the
**light** theme.

| Improvement | Status |
| ----------- | ------ |
| ~~#1 `color-contrast` - dim text on near-white~~ | **done** - every failure was the light-theme `--text-dim` (`#9ba3bf`, 2.1-2.5:1). Bumped to `#646c88` - **4.6:1** worst case (on `--bg` `#f0f2f8`), still visibly dimmer than `--text`. `--planned` (same token, used as badge text) bumped to match |
| ~~#1 `color-contrast` - hero accent word~~ | **done** - light-theme `--accent` `#00b899` on its tinted highlight was 2.15:1 (large bold needs 3:1). Darkened to `#00937a` - **3.3:1** |
| ~~#1 `label-content-name-mismatch` - lang toggle~~ | **done** - the visible `EN`/`VI` (decorative state, conveyed by the sliding knob) are now `aria-hidden`, so the button's accessible name is just its `aria-label` with no conflicting visible text |

**Result.** `label-content-name-mismatch` resolved on both strategies and
`color-contrast` dropped from **24 failing nodes to 1**, but Accessibility held
at **96** (not 100): one node still fails. Performance unchanged (97 / 100), so
the CSS swaps cost nothing.

### Round 4.1 - the last contrast node (shipped and measured)

The holdout is the language toggle's inactive `.lang-opt` ("EN") sitting over the
accent-tinted knob (`color-mix(--accent 18%, white)` = `#d1ece7`). The Round 4
`--text-dim` (`#646c88`) reaches only **4.17:1** there - just under 4.5:1 - because
the mint knob is darker than plain white. `aria-hidden` does **not** exempt it;
Lighthouse's `color-contrast` audit still checks visible text.

**Fix (shipped):** the inactive `.lang-opt` now uses `--text` (`#5c6480`),
giving **4.70:1** on the knob.

Two pre-emptive fixes shipped alongside, since both are the same class of latent
failure that a future scan could surface:

- **Active toggle label.** It was `--accent`, but accent green at 9.6px caps at
  ~3.85:1 on white (lower on the knob) - it can *never* meet AA as small text.
  Switched to `--text-hi`; the accent cue is now carried by the knob/pill behind
  it. All four label states (light/dark x active/inactive) now clear 4.5:1
  (4.7-13.4:1).
- **Dark theme.** Never scanned (every run rendered the default light theme), but
  its `--text-dim`/`--planned` (`#464f6a`) sat at ~2.4:1 on the dark surfaces -
  the same failure, unscanned. Bumped to `#7a82a1` (**5.0:1** on `--bg2`), still
  clearly dimmer than `--text`. This does not move the PSI score (light theme is
  what's measured) but fixes contrast for dark-theme users.

**Result (measured).** Accessibility reached **100 on both strategies** -
`color-contrast` is fully resolved; Best Practices and SEO held at 100. The
accessibility goal is met.

| Category      | Mobile (R4 -> R4.1) | Desktop (R4 -> R4.1) |
| ------------- | :-----------------: | :------------------: |
| Performance   | 97 -> 91            | 100 -> 99            |
| Accessibility | 96 -> **100**       | 96 -> **100**        |

The mobile Performance drop (97 -> 91) is **entirely a new CLS regression** (next
section): Speed Index actually improved (3.9 -> 2.7 s) and TBT fell (90 -> 20 ms),
but a single layout shift took CLS 0 -> 0.168. It is **unrelated to the v1.5.3
colour / `aria-hidden` changes** - neither affects layout - and CLS was 0 in all
four prior rounds.

---

## Round 5 fixes - shipped and measured

Targeting the mobile CLS (Remaining issue #1). The shift is font-swap reflow: the
latin 400/700 woff2 are already preloaded, but under slow-4G throttling they
still arrive after first paint, so `font-display: swap` repaints the hero title in
JetBrains Mono and the metric change shifts the grid block below it.

| Improvement | Status |
| ----------- | ------ |
| ~~#1 Mobile CLS 0.168 (font-swap reflow)~~ | **done** - every `@font-face` switched from `font-display: swap` to **`optional`**. The browser now renders the fallback for that load and never swaps mid-load, so there is no reflow. Preload is kept, so fast and repeat visits still paint JetBrains Mono on first render (and it's cached for later navigations). |

**Trade-off.** Under genuinely slow connections (including the Lighthouse mobile
lab), the font won't arrive inside `optional`'s ~100 ms block window, so that
first load renders in the fallback monospace (`ui-monospace, monospace`) instead
of swapping. That's the deliberate cost of CLS 0: no visible reflow, at the price
of the web font not showing on the slowest first loads. It does not affect
FCP/LCP (fallback paints immediately, same as `swap`).

The font-always-shows alternative (keep `swap`, add `@font-face` metric overrides
- `size-adjust` / `ascent-override` / `descent-override` - so the fallback
occupies the same box and the swap causes no reflow) needs the override values
generated from the font metrics (fontaine / capsize), not hand-picked. Worth
doing only if the fallback-on-slow-load trade proves undesirable.

**Result (measured).** The shift is gone: mobile **CLS 0.168 -> 0**
(`layout-shifts` and `cls-culprits-insight` both dropped off the failing list),
and **mobile Performance recovered 91 -> 96**. Desktop went **99 -> 100**
(perfect on every category). Accessibility held 100/100.

| Category    | Mobile (R4.1 -> R5) | Desktop (R4.1 -> R5) |
| ----------- | :-----------------: | :------------------: |
| Performance | 91 -> **96**        | 99 -> **100**        |

| Metric | R4.1 | R5 | Verdict |
| ------ | ---- | -- | ------- |
| Cumulative Layout Shift  | 0.168 | **0** | **fixed (0.71 -> 1.0)** |
| Speed Index              | 2.7 s | 4.2 s | flat (0.96 -> 0.77), run noise |
| Total Blocking Time      | 20 ms | 70 ms | still ~0 (score 0.99) |
| First Contentful Paint   | 1.6 s | 1.6 s | flat (0.95) |
| Largest Contentful Paint | 2.0 s | 2.0 s | flat (0.97) |

The residual mobile gap (96, not 100) is **Speed Index alone** (0.77), which
swung 2.7 -> 4.2 s between back-to-back runs - lab variance on the throttled
mobile profile, not a regression. Every other metric scores >= 0.95.

---

## Remaining issues (ranked, Round 5 data)

Accessibility is **100/100**, the main-thread cost is gone, and the CLS is fixed.
Mobile sits at 96 (desktop 100); everything below is at its practical floor - no
clear, low-risk lever remains.

### 1. Speed Index (the only sub-0.95 metric, mostly variance)

**Evidence.** `speed-index` is the lone soft metric on mobile (0.77 this run),
and it is noisy: 4.2 s (R3) -> 2.7 s (R4.1) -> 4.2 s (R5) on the same code. TBT
(70 ms), FCP, LCP, TTI, CLS all score >= 0.95.

**Cause/fix.** It measures how fast the viewport visually fills; the hero/card
scramble + gradient paint on a 4x CPU is the remaining cost. Staggering or gating
that decorative paint could help, but the payoff is small and the metric's run
noise makes it hard to measure. **Impact:** low. **Effort:** medium.

### 2. Render-blocking app CSS (~450 ms mobile / 80 ms desktop, unchanged)

**Evidence.** `render-blocking-insight`: the gateway `index-*.css` is critical
and still blocks. Same as Round 2 - near the floor; only worth inlining critical
CSS if chasing the last Speed-Index points. **Impact:** low. **Effort:** medium.

### 3. Residual unused JavaScript (41 KiB, unchanged)

**Evidence.** `unused-javascript`: ~41 KiB still unused on first render (was
42 KiB). The `vi` split already shipped; what remains is router internals and UI
primitives the gateway pulls in but doesn't paint. Diminishing returns now that
TBT is gone. **Impact:** low. **Effort:** medium.

### 4. Caching - 199 KiB at a 10-min TTL (unchanged constraint)

**Evidence.** `cache-insight`: **199 KiB** (was 211) served with a 10-min
`Cache-Control`. Still the GitHub Pages hosting limitation, not code - accept
unless a CDN is introduced.

---

## Final state

The action plan is complete. Final scores (Round 5):

| Category       | Mobile (R1 -> R5) | Desktop (R1 -> R5) |
| -------------- | :---------------: | :----------------: |
| Performance    | 85 -> **96**      | 99 -> **100**      |
| Accessibility  | n/a -> **100**    | n/a -> **100**     |
| Best Practices | n/a -> **100**    | n/a -> **100**     |
| SEO            | n/a -> **100**    | n/a -> **100**     |

Mobile Performance is 96 (Speed-Index variance is the only thing off 100);
desktop is a clean 100 across the board. The arc:

- **Rounds 1-2** - download cost: route code-splitting, self-hosted fonts, locale
  splitting, and killing the per-frame ScrambleText render storm + forced reflow.
  This moved first paint earlier and erased the TBT that the earlier paint exposed
  (mobile 85 -> 78 -> 97).
- **Rounds 3-4.1** - correctness: the faster paint surfaced accessibility audits;
  WCAG AA contrast across both themes and the toggle label-name mismatch were
  fixed (Accessibility -> 100/100).
- **Round 5** - stability: `font-display: optional` removed the font-swap CLS
  (mobile -> 0).

No clear, low-risk lever remains. The open items (Speed-Index noise, render-blocking
CSS, residual unused JS, the GitHub Pages cache TTL) are all at their practical
floor. See [TEXTBOOK.md](TEXTBOOK.md) for the durable lessons behind this arc.

## How to re-measure

Re-run PageSpeed Insights against the deployed home page (requesting **all four
categories**) and compare on the **mobile** tab with the **pagespeed-compare**
skill. With TBT, accessibility, and CLS all solved, the only metric that still
moves is **Speed Index**, and it is noisy - trust a clear directional move across
several runs, not a single decimal. Drop new reports in
[pagespeed-scannings/](../../pagespeed-scannings/); the analyze/compare scripts
auto-pick the newest by embedded timestamp.

---

*Maintained alongside each PageSpeed round. When a fix ships, record it here and
fold the durable lessons into [TEXTBOOK.md](TEXTBOOK.md); this file tracks the
optimization arc, the textbook records what was learned.*
