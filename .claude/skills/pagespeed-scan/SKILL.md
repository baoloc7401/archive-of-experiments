---
name: pagespeed-scan
description: >-
  Run a fresh PageSpeed Insights / Lighthouse scan of the deployed site and save
  the JSON into pagespeed-scannings/. Use when the user says "run a pagespeed
  scan", "re-measure performance", "scan mobile and desktop", "get a fresh
  Lighthouse report", or wants to confirm a perf change after deploying. First
  step of the scan -> analyze -> compare loop.
---

# PageSpeed scan

Fetches a fresh report from the public PageSpeed Insights v5 API and saves the
full response into [`pagespeed-scannings/`](../../../pagespeed-scannings/) using
the repo's naming scheme: `pagespeed-<strategy>-<unixSeconds>.json`. Files are
plain UTF-8 (no BOM), so they re-read cleanly.

## When to use

- "Run a PageSpeed/Lighthouse scan", "re-measure", "scan the live site."
- After a deploy, to confirm a performance change landed (then hand the result
  to **pagespeed-compare** against the prior round).

## Command

```bash
node .claude/skills/pagespeed-scan/scripts/scan.mjs                  # mobile + desktop
node .claude/skills/pagespeed-scan/scripts/scan.mjs --strategy mobile
node .claude/skills/pagespeed-scan/scripts/scan.mjs --url https://example.com/
node .claude/skills/pagespeed-scan/scripts/scan.mjs --category performance --category seo
```

Defaults: URL = the deployed home page
(`https://baoloc7401.github.io/archive-of-experiments/`), both strategies,
`performance` category only (matching how the existing reports were captured).

## Notes

- **It scans the deployed URL, not your local dev server.** PSI fetches the page
  from Google's servers, so a `localhost` URL will not work - deploy first, or
  pass a public URL.
- **Rate limits.** The anonymous API is fine for occasional runs. For heavier
  use set `PAGESPEED_API_KEY` in the environment (a free Google API key with the
  PageSpeed Insights API enabled).
- **Lab variance.** Two back-to-back scans differ slightly; look for a clear
  directional move, not a single decimal (see the re-measure note in
  [`docs/performance/IMPROVEMENTS.md`](../../../docs/performance/IMPROVEMENTS.md)).
- Strategies run sequentially on purpose - parallel anonymous calls get throttled.

## Next step

Both follow-up skills auto-pick the newest reports by the embedded timestamp, so
just run them with no arguments: **pagespeed-analyze** (latest of each strategy)
or **pagespeed-compare** (this round vs the previous, per strategy).
