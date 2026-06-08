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
- **Round 4** accessibility fixes: `*-1780900561` (mobile) / `*-1780900579` (desktop), 2026-06-08 06:36.
- **Round 4.1** last contrast node + toggle/dark-theme hardening: `*-1780902058` (mobile) / `*-1780902076` (desktop), 2026-06-08 07:01.
- **Round 5** mobile CLS (font-display: optional): shipped 2026-06-08, awaiting re-measure.

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

## Round 5 fixes - shipped (awaiting re-measure)

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

Expected: mobile **CLS -> 0** and Performance back to ~97; desktop unchanged.

---

## Remaining issues (ranked, Round 4.1 data)

Accessibility is now **100/100** on both strategies and the main-thread cost is
gone. The only open performance item that moved is a **new, intermittent mobile
CLS** seen for the first time in the Round 4.1 run; everything else is at its
practical floor.

### 1. Mobile CLS 0.168 (new this run) - addressed in Round 5

**Evidence (mobile only).** `cumulative-layout-shift`: **0.168** (score 0.71),
with `layout-shifts` / `cls-culprits-insight` attributing the whole shift to one
element: `<main class="grid-section">` (the experiments grid + sidebar block).
Desktop CLS stayed 0.002. CLS was **0 in all four prior rounds**.

**Not caused by v1.5.3.** The release changed only colour tokens and added
`aria-hidden` - neither affects layout. The cause is **font-swap reflow**:
JetBrains Mono is self-hosted, so when it loads after first paint the
fallback-vs-web-font metric difference reflows the tall `grid-section`, shifting
it. Earlier runs didn't catch it (font cached or loaded before the shift window),
which is why CLS is so timing-dependent.

**Fix.** Shipped in **Round 5 above** - `font-display: optional` so the font
never swaps mid-load. **Status:** done, awaiting re-measure. (One 0.168 against
four clean rounds could have been variance, but `optional` is a strict
improvement either way, so it was worth shipping without waiting for a confirming
re-scan.)
**Impact:** medium (it's ~6 mobile points). **Effort:** low-medium.

### 2. Speed Index (improved - now near-passing)

**Evidence.** `speed-index` improved to **2.7 s** on mobile (score 0.96) this
run, up from 4.1-4.2 s in Rounds 2-3. It is no longer a standout; TBT (20 ms) and
the other metrics all score >= 0.95.

**Cause/fix.** Still the hero/card scramble + gradient paint on a 4x CPU, but the
gap is now small. Only worth touching if pushing for a perfect 100. **Impact:**
low. **Effort:** medium.

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

Accessibility is **100/100**, the Round 4.1 contrast work is verified, and the
Round 5 CLS fix is shipped. Nothing else is worth chasing:

1. **Re-scan mobile to confirm Round 5** - verify `font-display: optional` took
   CLS back to 0 and Performance back to ~97, and sanity-check that first paint
   under throttling now shows the fallback monospace (the deliberate trade). This
   is the immediate next step.
2. **(Optional) Speed Index** (#2) - now 2.7 s / 0.96, no longer a priority.
3. Leave caching (#5) and render-blocking CSS (#3) alone - both are at their
   practical floor given GitHub Pages.

Desktop is at 99-100 on every category (the desktop dip to 99 is TBT/Speed-Index
run noise, CLS stayed clean). The remaining work is the **mobile CLS only**.

## How to re-measure

Re-run PageSpeed Insights against the deployed home page (requesting **all four
categories**) and compare on the **mobile** tab. With TBT and accessibility
solved, the metric to watch is now **CLS** (`cumulative-layout-shift` /
`layout-shifts`) - confirm the Round 5 `font-display: optional` fix took it back
to 0 (and didn't reintroduce any other shift). Lab numbers vary run to run; look
for a clear directional move, not a single decimal.
