# Performance Improvements

Action plan for the home page (`https://baoloc7401.github.io/archive-of-experiments/`),
driven by PageSpeed Insights / Lighthouse 13.3.0. Raw reports live in
[pagespeed-scannings/](../../pagespeed-scannings/).

Only the **Performance** category is run. Numbers are lab data under Lighthouse's
emulated throttling (mobile = slow 4G + 4x CPU slowdown, desktop = cable + no
slowdown), so mobile is the worst case and where every fix is measured.

- **Round 1** baseline: `*-1786217779` (mobile) / `*-1786218027` (desktop), 2026-06-08 03:36.
- **Round 2** after fixes: `*-1780893706` (mobile) / `*-1780893568` (desktop), 2026-06-08 04:40.

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

## Round 2 fixes - shipped (awaiting re-measure)

Targeting the main-thread / TBT bottleneck identified below. Build-time effects
confirmed; the TBT effect needs a fresh mobile PageSpeed run to verify.

| Improvement | What changed |
| ----------- | ------------ |
| ScrambleText no longer re-renders per frame | The ~60 scramble instances on the landing page now animate by writing `textContent` on a ref'd span instead of calling `setState` every rAF tick. This removes the thousands of React renders that ran in the FCP -> TTI window - the main TBT source. Also settles instantly under `prefers-reduced-motion`. (see #1) |
| Forced reflow removed | The hero and card `mousemove` handlers cached their rect (refreshed on scroll/resize) instead of calling `getBoundingClientRect()` every move. (see #2) |
| `vi` locale code-split | Only English is bundled eagerly; `vi` is a dynamic-import chunk loaded on toggle (or before mount when it's the saved language, so no flash). Landing JS dropped ~125 -> ~111 KiB gzip. (see #3) |

The items below are the original Round 2 findings, kept for the re-measure.

## Remaining issues (ranked, Round 2 data)

### 1. Main-thread blocking / TBT 690 ms (new top issue)

**Evidence (mobile):**

- `total-blocking-time`: **690 ms** (score 0.43); `max-potential-fid`: 320 ms (0.31).
- `mainthread-work-breakdown`: **4.2 s** total -
  Style & Layout **1.48 s**, Script Evaluation **1.06 s**, Other 0.83 s,
  Rendering 0.63 s, Parse/Compile 0.15 s.
- `bootup-time`: 1.2 s; the eager `assets/index-*.js` alone is **~1.0 s of
  scripting** + 0.14 s parse.
- `long-tasks`: 10 long tasks, longest 467 ms, then 319 / 182 / 154 ms - almost
  all attributed to `index-*.js`.

**Two distinct costs to attack:**

- **Script Evaluation (~1.06 s)** - the eager bundle runs React + ReactDOM +
  react-router + i18next/react-i18next + every shared UI primitive + ScrambleText
  on the landing page. Options: lazy-load the `vi` locale (ship only the active
  language eagerly, fetch the other on toggle); confirm no experiment-only helper
  is imported by the gateway; keep the eager surface to what `/` actually renders.
- **Style & Layout (~1.48 s, the single largest group)** - the home page is
  visually heavy: hero grid + spotlight radial gradients, the full-screen noise
  overlay, `color-mix` everywhere, view-transition keyframes, and ScrambleText
  mutating many cards on mount. On a 4x-throttled CPU this dominates. Options:
  reduce the number of simultaneously-animated cards / stagger less; gate more
  decorative layers behind `prefers-reduced-motion` (some already are); simplify
  or drop the noise overlay; avoid animating layout-affecting properties.

**Impact:** high - TBT is ~30% of the mobile score, so this is most of the gap
between 78 and the 90s. **Effort:** medium.

### 2. Forced reflow (~111 ms)

**Evidence.** `forced-reflow-insight` flags a synchronous layout read inside the
app bundle (`index-*.js`), ~111 ms of reflow time.

**Cause/fix.** Something reads layout (offset/scroll/getBoundingClientRect) and
then writes style in the same frame, forcing a re-layout. Likely candidates: the
scroll-progress bar, the hero spotlight `mousemove` handler, or ScrambleText
measuring nodes. Batch reads before writes, or move the read into a
`requestAnimationFrame` callback. Folds into #1.

**Impact:** medium (contributes to TBT). **Effort:** low once located.

### 3. Residual unused JavaScript (42 KiB)

**Evidence.** `unused-javascript`: the eager `index-*.js` is still **35% unused
(42 KiB)** on the landing page - down from 108 KiB pre-split, but not zero.

**Cause/fix.** The eager core ships code the gateway does not use on first render:
both i18n locales, router internals, UI primitives only used inside experiments.
Lazy-loading the inactive locale (see #1) is the biggest single trim. **Impact:**
medium. **Effort:** low-medium.

### 4. Render-blocking app CSS (~158 ms)

**Evidence.** `render-blocking-insight`: **450 ms** total, now just the gateway
`index-*.css` (158 ms). The 751 ms Google Fonts stylesheet is gone.

**Cause/fix.** The gateway's own stylesheet is legitimately critical, so this is
near the floor. Only worth chasing (inline critical CSS) after #1/#2. **Impact:**
low. **Effort:** medium.

### 5. Font byte weight (~3 x 32 KiB latin)

**Evidence.** `total-byte-weight`: the three latin weights are ~32 KiB each
(~96 KiB), the largest assets after the JS bundle. They load with
`font-display: swap`, so they do **not** block render, but they add bytes and
decode cost.

**Cause/fix.** Three weights (400/600/700) are self-hosted. If 600 is rarely used
on the landing page, dropping it removes ~32 KiB. Optional - measure usage first.
**Impact:** low. **Effort:** low.

### 6. Caching - 211 KiB at a 10-min TTL (unchanged)

**Evidence.** `cache-insight`: **211 KiB** (the JS, CSS, and now the self-hosted
fonts) served with `cacheLifetimeMs: 600000`.

**Constraint.** Unchanged from Round 1: GitHub Pages fixes a 10-min
`Cache-Control` and exposes no header control. Assets are content-hashed, so a CDN
(Cloudflare in front of Pages, or Netlify/Vercel/Cloudflare Pages) could set
`max-age=31536000, immutable`. Hosting change, not code. **Recommendation:**
accept unless return traffic justifies re-hosting.

---

## Suggested next round

1. **Cut eager script execution** (#1, #3) - lazy-load the inactive i18n locale
   and verify the gateway imports nothing experiment-only. This is the most direct
   lever on TBT.
2. **Lighten home-page style/layout** (#1) - reduce simultaneously-animated cards,
   gate more decorative layers behind `prefers-reduced-motion`, reconsider the
   noise overlay.
3. **Fix the forced reflow** (#2) - batch the layout read/write.
4. Re-run mobile PageSpeed and confirm **TBT drops**; the goal is to convert the
   already-good FCP/LCP into a 90s aggregate score by removing main-thread time.

Desktop is at 100 and needs nothing. The remaining work is entirely
**mobile main-thread cost**, not download - the opposite of Round 1, which was
entirely download cost.

## How to re-measure

Re-run PageSpeed Insights against the deployed home page and compare on the
**mobile** tab. After Round 2 the metric to watch is **Total Blocking Time** (plus
`mainthread-work-breakdown` and `bootup-time` in the full report). Lab numbers
vary run to run; look for a clear directional move.
