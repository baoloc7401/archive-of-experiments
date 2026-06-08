#!/usr/bin/env node
// Run a fresh PageSpeed Insights scan via the public PSI v5 API and save the
// full JSON response into pagespeed-scannings/ using the repo naming scheme
// (pagespeed-<strategy>-<unixSeconds>.json). UTF-8, no BOM - clean to re-read.
//
// Usage:
//   node scan.mjs                         both strategies, deployed home page
//   node scan.mjs --strategy mobile       just mobile
//   node scan.mjs --url https://example/  scan another URL
//   node scan.mjs --category performance --category accessibility
//
// Optional: set PAGESPEED_API_KEY to raise the anonymous rate limit.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_URL = "https://baoloc7401.github.io/archive-of-experiments/";
const SCAN_DIR = "pagespeed-scannings";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function argAll(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === name && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}

async function scan(url, strategy, categories, key) {
  const u = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  u.searchParams.set("url", url);
  u.searchParams.set("strategy", strategy);
  for (const c of categories) u.searchParams.append("category", c);
  if (key) u.searchParams.set("key", key);

  process.stdout.write(`scanning ${strategy} ${url} ...`);
  const res = await fetch(u);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PSI ${strategy} failed: ${res.status} ${res.statusText}\n${body.slice(0, 400)}`);
  }
  const json = await res.json();
  mkdirSync(SCAN_DIR, { recursive: true });
  const file = join(SCAN_DIR, `pagespeed-${strategy}-${Math.floor(Date.now() / 1000)}.json`);
  writeFileSync(file, JSON.stringify(json));

  const perf = json.lighthouseResult?.categories?.performance?.score;
  console.log(` saved ${file}` + (perf != null ? `  (performance ${Math.round(perf * 100)})` : ""));
  return file;
}

async function main() {
  const url = arg("--url", DEFAULT_URL);
  const strategyArg = arg("--strategy", "both");
  const strategies = strategyArg === "both" ? ["mobile", "desktop"] : [strategyArg];
  const categories = argAll("--category");
  if (!categories.length) categories.push("performance");
  const key = process.env.PAGESPEED_API_KEY;

  for (const s of strategies) {
    // run sequentially: the anonymous API rate-limits parallel calls
    await scan(url, s, categories, key);
  }
  console.log("\nNext: analyze with the pagespeed-analyze skill (node ... analyze.mjs --latest mobile).");
}

main().catch((e) => {
  console.error(String(e.message ?? e));
  process.exit(1);
});
