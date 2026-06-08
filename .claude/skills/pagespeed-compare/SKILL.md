---
name: pagespeed-compare
description: >-
  Diff two PageSpeed / Lighthouse reports and show how scores, core metrics, and
  audits moved. Use when the user asks "did performance improve", "compare before
  and after", "diff the two scans", "did my fix help", or wants a round-over-round
  perf delta. Pairs the two newest reports of a strategy, or two explicit files.
---

# PageSpeed compare

Shows the **delta** between two reports: score change, each core metric
before -> after with a better/worse verdict, the audits still failing in the
newer run (with `[new]` regressions tagged), and which audits were resolved. The
script [`scripts/compare.mjs`](scripts/compare.mjs) reuses `loadReport()` and
`summarize()` from the **pagespeed-analyze** skill, so the two stay consistent.

## When to use

- "Did it get faster?", "compare before/after", "diff these two scans", after a
  perf fix + re-scan.
- Filling the before/after tables in
  [`docs/performance/IMPROVEMENTS.md`](../../../docs/performance/IMPROVEMENTS.md).

## Command

```bash
node .claude/skills/pagespeed-compare/scripts/compare.mjs                      # each strategy, its 2 newest rounds
node .claude/skills/pagespeed-compare/scripts/compare.mjs --latest mobile      # 2 newest mobile rounds
node .claude/skills/pagespeed-compare/scripts/compare.mjs <before.json> <after.json>
node .claude/skills/pagespeed-compare/scripts/compare.mjs --json
```

**No file arguments needed.** Pairing is by the embedded filename timestamp
(`pagespeed-<strategy>-<unixSeconds>.json`), older = before, newer = after - so
you never tag files by hand:

- **no args** - for every strategy with at least two reports, diff its two
  newest rounds; prints the latest timestamp per strategy at the end.
- `--latest <strategy>` - the two newest of just that strategy.
- `<before.json> <after.json>` - those exact files, in that order.

Like analyze, "latest" is the embedded timestamp (the scan time), not file
mtime, so it survives a `git checkout` or copy.

## Read the trade, not just the score

Lighthouse metrics interact, so a fix can improve one metric and *expose*
another. The canonical example on this project: self-hosting the font moved FCP
earlier, which pushed pre-existing JS execution into the FCP -> TTI window and
made **TBT** appear - the aggregate score dropped even though first paint got
faster. The compare output makes this legible (FCP "better", TBT "worse" in the
same run). Always explain the trade, not just the headline number.

## Notes

- Compares same-strategy reports (mobile vs mobile). To contrast mobile vs
  desktop of the *same* run, pass the two files explicitly - but read it as a
  device gap, not a regression.
- Lab numbers vary run to run; trust a clear directional move over a single
  decimal. Re-scan with **pagespeed-scan** if a result looks like noise.
