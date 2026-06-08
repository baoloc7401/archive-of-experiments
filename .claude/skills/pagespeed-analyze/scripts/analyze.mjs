#!/usr/bin/env node
// Parse a PageSpeed Insights / Lighthouse JSON report and print scores, core
// metrics, and ranked actionable audits. Handles the UTF-16-with-BOM encoding
// that PSI's "download report" produces (the recurring gotcha).
//
// Usage:
//   node analyze.mjs <report.json>           analyze one file
//   node analyze.mjs --latest [mobile|desktop]   newest report in the scan dir
//   node analyze.mjs <file> --json           machine-readable output
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCAN_DIR = "pagespeed-scannings";

function decode(file) {
  const b = readFileSync(file);
  const s =
    b[0] === 0xff && b[1] === 0xfe
      ? b.toString("utf16le")
      : b[0] === 0xfe && b[1] === 0xff
        ? b.swap16().toString("utf16le")
        : b.toString("utf8");
  return JSON.parse(s.replace(/^﻿/, ""));
}

export function loadReport(file) {
  const j = decode(file);
  return j.lighthouseResult ?? j;
}

// Reports are named pagespeed-<strategy>-<unixSeconds>.json. The embedded
// timestamp (the scan's own time, == fetchTime) is the authoritative "latest"
// signal - more robust than file mtime, which a git checkout or copy resets.
const NAME_RE = /pagespeed-([a-z]+)-(\d+)\.json$/i;

export function listReports(dir = SCAN_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const full = join(dir, f);
      const m = f.match(NAME_RE);
      // Fall back to mtime (seconds) for any file that isn't named to scheme.
      const ts = m ? Number(m[2]) : Math.floor(statSync(full).mtimeMs / 1000);
      return { file: full, name: f, strategy: m ? m[1].toLowerCase() : "unknown", ts };
    });
}

/** Map of strategy -> its newest report (by embedded timestamp). */
export function latestByStrategy(dir = SCAN_DIR) {
  const map = new Map();
  for (const r of listReports(dir)) {
    const cur = map.get(r.strategy);
    if (!cur || r.ts > cur.ts) map.set(r.strategy, r);
  }
  return map;
}

/** Newest report file: for a given strategy, or overall when omitted. */
export function latestReport(strategy, dir = SCAN_DIR) {
  if (strategy) {
    const r = latestByStrategy(dir).get(strategy.toLowerCase());
    if (!r) throw new Error(`No ${strategy} reports in ${dir}/`);
    return r.file;
  }
  const all = listReports(dir).sort((a, b) => b.ts - a.ts);
  if (!all.length) throw new Error(`No reports in ${dir}/`);
  return all[0].file;
}

const CORE = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "speed-index",
  "interactive",
  "max-potential-fid",
  "server-response-time",
];

const SKIP_MODES = new Set(["informative", "manual", "notApplicable"]);

function isFailing(x) {
  return x && x.score != null && x.score < 1 && !SKIP_MODES.has(x.scoreDisplayMode);
}

export function summarize(lhr) {
  const a = lhr.audits ?? {};
  const catsRaw = lhr.categories ?? {};

  const categories = {};
  const auditCategory = {}; // auditId -> first category title that owns it
  for (const [key, cat] of Object.entries(catsRaw)) {
    categories[key] = cat.score == null ? null : Math.round(cat.score * 100);
    for (const ref of cat.auditRefs ?? []) {
      if (!(ref.id in auditCategory)) auditCategory[ref.id] = cat.title ?? key;
    }
  }

  const metrics = CORE.filter((m) => a[m]).map((m) => ({
    id: m,
    value: a[m].displayValue ?? "",
    score: a[m].score,
    numeric: a[m].numericValue,
  }));

  // Flat list of every failing audit (used by the compare skill).
  const issues = [];
  for (const [id, x] of Object.entries(a)) {
    if (!isFailing(x)) continue;
    issues.push({
      id,
      score: x.score,
      value: x.displayValue ?? "",
      category: auditCategory[id] ?? "",
      saveMs: x.details?.overallSavingsMs,
      saveBytes: x.details?.overallSavingsBytes,
    });
  }
  issues.sort((p, q) => p.score - q.score);

  // The same failing audits, grouped under each Lighthouse category so every
  // aspect that needs work is visible (performance, accessibility, SEO, ...).
  const byCategory = Object.entries(catsRaw).map(([key, cat]) => {
    const seen = new Set();
    const catIssues = [];
    for (const ref of cat.auditRefs ?? []) {
      const x = a[ref.id];
      if (!isFailing(x) || seen.has(ref.id)) continue;
      seen.add(ref.id);
      catIssues.push({
        id: ref.id,
        score: x.score,
        value: x.displayValue ?? "",
        weight: ref.weight ?? 0,
        saveMs: x.details?.overallSavingsMs,
        saveBytes: x.details?.overallSavingsBytes,
      });
    }
    // worst score first, then by how much the audit weighs on the category score
    catIssues.sort((p, q) => p.score - q.score || q.weight - p.weight);
    return { key, title: cat.title ?? key, score: categories[key], issues: catIssues };
  });

  return {
    finalUrl: lhr.finalUrl,
    fetchTime: lhr.fetchTime,
    lighthouseVersion: lhr.lighthouseVersion,
    formFactor: lhr.configSettings?.formFactor,
    categories,
    metrics,
    issues,
    byCategory,
  };
}

function savingsLabel(it) {
  return [
    it.saveMs ? `${Math.round(it.saveMs)}ms` : "",
    it.saveBytes ? `${Math.round(it.saveBytes / 1024)}KiB` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function printHuman(s) {
  console.log(`URL:        ${s.finalUrl}`);
  console.log(`Fetched:    ${s.fetchTime}  (${s.formFactor ?? "?"}, lh ${s.lighthouseVersion})`);
  console.log("\nScores");
  for (const [k, v] of Object.entries(s.categories)) console.log(`  ${k.padEnd(16)} ${v ?? "-"}`);
  if (s.metrics.length) {
    console.log("\nCore metrics (performance)");
    for (const m of s.metrics) {
      console.log(`  ${m.id.padEnd(26)} ${String(m.value).padEnd(10)} score ${m.score}`);
    }
  }
  console.log("\nIssues by category (worst first)");
  const totalIssues = s.byCategory.reduce((n, c) => n + c.issues.length, 0);
  if (!totalIssues) {
    console.log("  none - everything passing in the categories that were scanned");
  }
  for (const c of s.byCategory) {
    console.log(`\n  ${c.title} - ${c.score ?? "-"}`);
    if (!c.issues.length) {
      console.log("    all passing");
      continue;
    }
    for (const it of c.issues) {
      const save = savingsLabel(it);
      console.log(`    [${it.score.toFixed(2)}] ${it.id.padEnd(34)} ${it.value} ${save ? "(" + save + ")" : ""}`);
    }
  }
}

function emit(file, asJson) {
  const s = summarize(loadReport(file));
  if (asJson) console.log(JSON.stringify({ file, ...s }, null, 2));
  else {
    console.log(`# ${file}\n`);
    printHuman(s);
  }
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const li = args.indexOf("--latest");
  const stratArg =
    li !== -1 && args[li + 1] && !args[li + 1].startsWith("--") ? args[li + 1] : undefined;
  // The token after --latest is the strategy, not a file path - exclude it.
  const stratIdx = stratArg ? li + 1 : -1;
  const explicit = args.find((a, idx) => !a.startsWith("--") && idx !== stratIdx);

  // Explicit file wins. Otherwise resolve the latest by embedded timestamp:
  // a named strategy -> that one; no strategy -> the newest of EVERY strategy
  // (so a bare run reports the latest mobile + desktop without any tagging).
  let files;
  if (explicit) files = [explicit];
  else if (stratArg) files = [latestReport(stratArg)];
  else {
    const latest = latestByStrategy();
    if (!latest.size) {
      console.error(`No reports in ${SCAN_DIR}/ - add the PageSpeed JSON there, or pass a file path.`);
      process.exit(1);
    }
    files = [...latest.values()]
      .sort((a, b) => a.strategy.localeCompare(b.strategy))
      .map((r) => r.file);
  }

  files.forEach((f, i) => {
    if (i) console.log("\n" + "=".repeat(60) + "\n");
    emit(f, asJson);
  });
}

// run only when invoked directly (robust across platforms, incl. Windows paths)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
