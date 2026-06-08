---
name: pagespeed-analyze
description: >-
  Parse a saved PageSpeed Insights / Lighthouse JSON report and print scores,
  core metrics, and ranked actionable audits with their savings. Use when the
  user drops a pagespeed-*.json file, says "analyze this report", "what are the
  PageSpeed issues", "summarize the Lighthouse results", or asks which audits to
  fix. With no file argument it auto-picks the newest report per strategy by the
  embedded timestamp. Handles the UTF-16+BOM encoding PSI downloads use.
---

# PageSpeed analyze

Turns one Lighthouse/PSI report into a readable summary: category scores, the
core Web Vitals, and every non-passing audit sorted worst-first with its
`displayValue` and estimated savings. The bundled script
[`scripts/analyze.mjs`](scripts/analyze.mjs) is the source of truth - prefer it
over re-deriving extraction logic inline.

## When to use

- The user provides (or points at) a `pagespeed-*.json` report and wants to know
  what it says or what to fix.
- You need numbers for [`docs/performance/IMPROVEMENTS.md`](../../../docs/performance/IMPROVEMENTS.md).

## Command

```bash
node .claude/skills/pagespeed-analyze/scripts/analyze.mjs                 # latest of EACH strategy
node .claude/skills/pagespeed-analyze/scripts/analyze.mjs --latest mobile # latest mobile only
node .claude/skills/pagespeed-analyze/scripts/analyze.mjs <report.json>   # a specific file
node .claude/skills/pagespeed-analyze/scripts/analyze.mjs --json
```

**No file argument needed.** Reports are named
`pagespeed-<strategy>-<unixSeconds>.json`; the script reads that embedded
timestamp to find the newest, so you never tag or pick files by hand:

- **no args** - newest mobile + newest desktop (one summary each).
- `--latest <strategy>` - newest of just that strategy.
- `<report.json>` - that exact file.
- `--json` - structured output instead of the text report.

"Latest" is the embedded filename timestamp (the scan's own time), not file
mtime - so it stays correct after a `git checkout` or copy that resets mtimes.
Files not matching the scheme fall back to mtime.

## The encoding gotcha (why a script exists)

PSI's "download report" writes **UTF-16 LE with a BOM**. A naive
`JSON.parse(readFileSync(...,"utf8"))` throws on the leading bytes. The loader in
`analyze.mjs` sniffs the BOM (`0xFF 0xFE` / `0xFE 0xFF`), decodes `utf16le`,
strips a leading `﻿`, and unwraps `lighthouseResult`. Reuse `loadReport()`
and `summarize()` from it (the **pagespeed-compare** skill imports them) rather
than rewriting this.

## What it reports

- **Scores** - each Lighthouse category present (often just `performance`, since
  the runs here scan `--category performance`).
- **Core metrics** - FCP, LCP, TBT, CLS, Speed Index, TTI, max-potential-FID,
  server response - with displayValue and score.
- **Actionable audits** - score < 1 and not informative/manual/N-A, sorted by
  score, with savings in ms / KiB. The `*-insight` audits (render-blocking,
  cache, forced-reflow, mainthread-work) surface here too.

## Reading the result

Low-score metrics tell you *what* is slow; the audits tell you *why*. On this
project mobile is the worst case (4x CPU + slow 4G emulation) and desktop is
usually green - focus on mobile. When the score moves unexpectedly, remember
metrics interact (e.g. an earlier FCP can expose JS execution as new TBT) - use
**pagespeed-compare** to see the trade across a round.
