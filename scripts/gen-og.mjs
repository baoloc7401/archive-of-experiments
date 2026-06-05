// One-off: rasterize public/og-image.svg -> public/og-image.png (1200x630) so
// social platforms that don't render SVG (Facebook/LinkedIn) still get a card.
// Run with: node scripts/gen-og.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(root, "public/og-image.svg"), "utf8");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(
  `<!doctype html><html><body style="margin:0">${svg}</body></html>`,
  { waitUntil: "networkidle" }
);
await page.screenshot({
  path: resolve(root, "public/og-image.png"),
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});
await browser.close();
console.log("wrote public/og-image.png");
