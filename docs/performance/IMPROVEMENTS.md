# Performance Improvements

Action plan derived from two PageSpeed Insights / Lighthouse 13.3.0 runs of the
home page (`https://baoloc7401.github.io/archive-of-experiments/`), captured
2026-06-08. Raw reports live in [pagespeed-scannings/](../../pagespeed-scannings/).

Only the **Performance** category was run. Numbers below are lab data under
Lighthouse's emulated throttling (mobile = slow 4G + 4x CPU slowdown, desktop =
cable + no slowdown), so mobile is the worst case and where every fix should be
measured.

> **Status (2026-06-08):** improvements #1 (route code splitting), #2 (self-host
> the font) and #4 (drop the now-unused preconnects) are **implemented**. #3
> (long-cache headers) is left as-is - a GitHub Pages hosting limitation. Re-run
> PageSpeed against the next deploy to confirm the mobile gains.

## Scores at a glance

| Category    | Mobile | Desktop |
| ----------- | :----: | :-----: |
| Performance |   85   |   99    |

### Core metrics

| Metric                         | Mobile          | Desktop   | Mobile verdict |
| ------------------------------ | --------------- | --------- | -------------- |
| First Contentful Paint (FCP)   | **3.1 s**       | 0.7 s     | poor (0.46)    |
| Largest Contentful Paint (LCP) | **3.1 s**       | 0.7 s     | needs work (0.74) |
| Speed Index                    | **4.8 s**       | 0.8 s     | needs work (0.67) |
| Time to Interactive            | 3.2 s           | 0.7 s     | ok (0.95)      |
| Total Blocking Time (TBT)      | 0 ms            | 0 ms      | perfect        |
| Cumulative Layout Shift (CLS)  | 0               | 0         | perfect        |
| Server response time           | ~0 ms           | ~0 ms     | perfect        |

**Read:** the page is not CPU-bound (TBT 0, CLS 0, server instant). The whole
mobile gap is **how long until the first pixel paints**, which is gated by
downloading and parsing one big JS bundle plus two render-blocking requests
(app CSS and the Google Fonts stylesheet). Desktop hides all of this because the
download is fast and the CPU is not throttled.

## The page weight

From `resource-summary` (mobile, 8 requests, 270 KiB total transferred):

| Type       | Requests | Transfer  |
| ---------- | :------: | --------- |
| Script     |    1     | 190 KiB   |
| Font       |    4     | 56 KiB    |
| Stylesheet |    2     | 28 KiB    |
| Document   |    1     | 2.2 KiB   |

One 190 KiB script and 56 KiB of fonts dominate. Both are addressable.

---

## Improvements, ranked by impact

### 1. Split the bundle by route (biggest win)

**Evidence.** `unused-javascript` reports the single
`assets/index-*.js` is 187 KiB and **59% unused (108 KiB wasted, est. 550 ms)**
on the landing page. `unused-css-rules` reports the single `assets/index-*.css`
is **88% unused (22 KiB wasted)**.

**Cause.** [src/main.tsx](../../src/main.tsx) statically imports all eight
experiment components (chess, pathfinding, elevator, aco, river-crossing,
minesweeper, boids, l-system) plus About/Contact at the top of the file:

```ts
import ChessGame from "./experiments/chess";
import Pathfinding from "./experiments/pathfinding";
// ...six more
```

So visiting `/` downloads and parses the chess engine, the boids simulation,
every canvas renderer, and every experiment's CSS, none of which the home page
renders. Vite has nothing to split because everything is in one import graph.

**Fix.** Lazy-load the routes with `React.lazy` + `Suspense`. Keep `App`
(the gateway) eager, defer the rest:

```ts
import { lazy, Suspense } from "react";

const ChessGame = lazy(() => import("./experiments/chess"));
const Pathfinding = lazy(() => import("./experiments/pathfinding"));
// ...etc

// wrap <Routes> in <Suspense fallback={...}>
```

Vite then emits one chunk per experiment, and `/` ships only the gateway plus
the router. Expect the landing bundle to drop by roughly the 108 KiB flagged as
unused, and the per-experiment CSS to leave the critical path too (the 22 KiB
unused CSS is the other experiments' styles riding in the one stylesheet).

**Impact:** high (directly improves FCP/LCP/Speed Index on mobile).
**Effort:** low. **Risk:** low - add a `Suspense` fallback so the first paint of
a deep-linked experiment shows a placeholder instead of blank.

### 2. Unblock the critical render path

**Evidence.** `render-blocking-insight` flags **~1,470 ms** of render-blocking
on mobile, from two resources:

| Resource                                   | Blocking |
| ------------------------------------------ | -------- |
| `fonts.googleapis.com/css2?...JetBrains+Mono` | 751 ms |
| `assets/index-*.css`                       | 561 ms   |

The font stylesheet is the worse offender, and it sits on a request chain
(`document -> Google Fonts CSS -> woff2 files`), with a longest chain of ~1 s in
`network-dependency-tree-insight`.

**Fixes (pick based on appetite):**

- **Self-host the font.** Download the JetBrains Mono `woff2` files used (4
  weights, 56 KiB total), drop them in `public/`, and replace the Google Fonts
  `<link>` in [index.html](../../index.html) with an `@font-face` + a
  `<link rel="preload" as="font" crossorigin>`. This removes the 751 ms
  cross-origin stylesheet round-trip entirely and the
  `preconnect` hints to `fonts.googleapis.com` / `fonts.gstatic.com` become
  unnecessary. Best single fix for FCP.
- **Trim weights.** The app loads 400/600/700. If 700 (or 600) is rarely used,
  dropping a weight removes a font file from the critical chain.
- **Keep `display=swap`** (already present) so text is never invisible while the
  font loads - this is why CLS is 0; do not regress it.

For the 561 ms app CSS: most of it disappears once route splitting (#1) moves
per-experiment CSS into per-route chunks. What remains is the gateway's own CSS,
which is legitimately critical and small.

**Impact:** high (FCP). **Effort:** medium (self-hosting fonts is the bulk).

### 3. Long-cache the hashed assets (repeat visits)

**Evidence.** `cache-insight` flags **194 KiB** served with only a 10-minute TTL
(`cacheLifetimeMs: 600000`) - the JS and CSS bundles.

**Cause / constraint.** The site is hosted on **GitHub Pages**, which sets a
fixed 10-minute `Cache-Control` and does not let you configure response headers.
Vite already content-hashes filenames (`index-C4BEygTb.js`), so they are safe to
cache for a year - GitHub Pages just will not honor it.

**Options:**

- Accept it (zero work) - this only affects repeat visitors, and the hashing
  means correctness is fine.
- If repeat-visit speed matters, front the site with a CDN that lets you set
  `Cache-Control: public, max-age=31536000, immutable` on `/assets/*`
  (Cloudflare in front of Pages, or move hosting to Netlify/Vercel/Cloudflare
  Pages). This is a hosting change, not a code change.

**Impact:** medium, repeat visits only. **Effort:** low (accept) or high
(re-host). Recommend **accept for now**, revisit only if analytics show heavy
return traffic.

### 4. Smaller follow-ups

- **Preconnect is already in place** for the font origins
  ([index.html](../../index.html) lines 29-30); Lighthouse confirms no
  additional preconnect candidates. If you self-host fonts (#2), remove these
  two `preconnect` hints since they would point at unused origins.
- **No images, no third-party JS, no legacy-JS transforms flagged** - the
  surface is already lean. Don't add analytics/embeds without re-measuring.

---

## Suggested order of work

1. **Route-based code splitting** (#1) - one file, biggest mobile win, low risk.
2. **Self-host JetBrains Mono + preload** (#2) - removes the worst
   render-blocking request.
3. Re-run PageSpeed on mobile and confirm FCP/Speed Index moved before deciding
   whether the caching/CDN work (#3) is worth it.

Desktop is already at 99 and needs nothing. The goal is to pull **mobile
Performance from 85 toward the mid-90s**, which #1 and #2 together should reach
since the entire deficit is first-paint download cost, not runtime work
(TBT and CLS are already perfect).

## How to re-measure

Re-run PageSpeed Insights against the deployed home page after each change and
compare FCP, LCP, and Speed Index on the **mobile** tab. Lab numbers vary run to
run; look for a clear directional move, not a single decimal.
