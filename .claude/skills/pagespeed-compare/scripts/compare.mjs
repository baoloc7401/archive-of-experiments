#!/usr/bin/env node
// Compare two PageSpeed / Lighthouse reports (before vs after, or two strategies)
// and print score + core-metric deltas plus how each actionable audit moved.
// Reuses the loader/summary from the sibling analyze skill.
//
// Usage:
//   node compare.mjs <before.json> <after.json>
//   node compare.mjs --latest mobile        two newest mobile reports (prev->newest)
//   node compare.mjs <a> <b> --json
import { fileURLToPath } from "node:url";
import {
  loadReport,
  summarize,
  listReports,
  latestByStrategy,
} from "../../pagespeed-analyze/scripts/analyze.mjs";

// The two newest reports for a strategy, by embedded timestamp -> [before, after].
function twoLatest(strategy) {
  const list = listReports()
    .filter((r) => r.strategy === strategy.toLowerCase())
    .sort((a, b) => a.ts - b.ts);
  if (list.length < 2) throw new Error(`Need 2 ${strategy} reports in pagespeed-scannings/`);
  return [list[list.length - 2].file, list[list.length - 1].file];
}

// Every strategy that has at least two reports (for a no-argument run).
function comparableStrategies() {
  const counts = new Map();
  for (const r of listReports()) counts.set(r.strategy, (counts.get(r.strategy) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([s]) => s).sort();
}

function delta(before, after, lowerIsBetter = true) {
  const d = after - before;
  if (d === 0) return "0";
  const sign = d > 0 ? "+" : "";
  const good = lowerIsBetter ? d < 0 : d > 0;
  return `${sign}${d} ${good ? "(better)" : "(worse)"}`;
}

function comparePair(before, after, asJson) {
  const A = summarize(loadReport(before));
  const B = summarize(loadReport(after));

  if (asJson) {
    console.log(JSON.stringify({ before: { file: before, ...A }, after: { file: after, ...B } }, null, 2));
    return;
  }

  console.log(`before: ${before}  (${A.fetchTime})`);
  console.log(`after:  ${after}  (${B.fetchTime})\n`);

  console.log("Scores (before -> after)");
  for (const k of new Set([...Object.keys(A.categories), ...Object.keys(B.categories)])) {
    const a = A.categories[k] ?? "-";
    const b = B.categories[k] ?? "-";
    console.log(`  ${k.padEnd(16)} ${a} -> ${b}   ${typeof a === "number" && typeof b === "number" ? delta(a, b, false) : ""}`);
  }

  console.log("\nCore metrics (before -> after)");
  const am = Object.fromEntries(A.metrics.map((m) => [m.id, m]));
  for (const m of B.metrics) {
    const prev = am[m.id];
    const pv = prev ? prev.value : "-";
    const ds = prev && prev.numeric != null && m.numeric != null ? delta(Math.round(prev.numeric), Math.round(m.numeric)) : "";
    console.log(`  ${m.id.padEnd(26)} ${String(pv).padEnd(10)} -> ${String(m.value).padEnd(10)} ${ds}`);
  }

  console.log("\nActionable audits in the newer run (worst first)");
  const aIssues = new Set(A.issues.map((i) => i.id));
  if (!B.issues.length) console.log("  none - all passing");
  for (const it of B.issues) {
    const tag = aIssues.has(it.id) ? "" : "  [new]";
    console.log(`  [${it.score.toFixed(2)}] ${it.id.padEnd(34)} ${it.value}${tag}`);
  }
  const resolved = A.issues.filter((i) => !B.issues.some((j) => j.id === i.id));
  if (resolved.length) {
    console.log("\nResolved since the older run");
    for (const it of resolved) console.log(`  + ${it.id} (${it.value})`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const explicit = args.filter((a) => !a.startsWith("--"));
  const li = args.indexOf("--latest");
  const stratArg =
    li !== -1 && args[li + 1] && !args[li + 1].startsWith("--") ? args[li + 1] : undefined;

  // Two explicit files win. Otherwise resolve by embedded timestamp: a named
  // strategy -> its two newest; no strategy -> the two newest of EVERY strategy
  // that has a pair (so a bare run diffs the latest mobile + desktop rounds).
  let pairs;
  if (explicit.length >= 2) pairs = [explicit.slice(0, 2)];
  else if (stratArg) pairs = [twoLatest(stratArg)];
  else {
    const strategies = comparableStrategies();
    if (!strategies.length) {
      console.error("Need at least two reports of a strategy in pagespeed-scannings/.");
      process.exit(1);
    }
    pairs = strategies.map((s) => twoLatest(s));
  }

  pairs.forEach(([before, after], i) => {
    if (i) console.log("\n" + "=".repeat(60) + "\n");
    comparePair(before, after, asJson);
  });

  // Default discovery uses each strategy's two newest reports - confirm latest.
  if (!explicit.length) {
    const latest = latestByStrategy();
    const tags = [...latest.values()]
      .sort((a, b) => a.strategy.localeCompare(b.strategy))
      .map((r) => `${r.strategy} ${new Date(r.ts * 1000).toISOString()}`);
    if (!asJson) console.error(`\n(latest per strategy: ${tags.join(", ")})`);
  }
}

// only run when invoked directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
