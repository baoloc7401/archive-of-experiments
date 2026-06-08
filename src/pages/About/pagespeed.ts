// Static snapshot of the latest PageSpeed Insights / Lighthouse run of the home
// page, rendered by the About terminal's `pagespeed` command as scored bars.
//
// Source reports (Lighthouse 13.3.0, 2026-06-08):
//   pagespeed-scannings/pagespeed-mobile-1780903358.json
//   pagespeed-scannings/pagespeed-desktop-1780903374.json
// The full round-by-round story lives in docs/pagespeed/IMPROVEMENTS.md.
// When a newer scan is recorded, update CATEGORIES / METRICS / LIGHTHOUSE here.

import type { Gauge, OutLine, PagespeedLabels } from "./commands";

const LIGHTHOUSE = "Lighthouse 13.3.0";

/** Category scores (0-100) per strategy. */
const CATEGORIES: { label: string; mobile: number; desktop: number }[] = [
  { label: "Performance", mobile: 96, desktop: 100 },
  { label: "Accessibility", mobile: 100, desktop: 100 },
  { label: "Best Practices", mobile: 100, desktop: 100 },
  { label: "SEO", mobile: 100, desktop: 100 },
];

/** Core Web Vitals (mobile, the throttled worst case): Lighthouse sub-score +
 *  human-readable value. */
const METRICS: { label: string; score: number; value: string }[] = [
  { label: "FCP", score: 95, value: "1.6 s" },
  { label: "LCP", score: 97, value: "2.0 s" },
  { label: "TBT", score: 99, value: "70 ms" },
  { label: "CLS", score: 100, value: "0" },
  { label: "Speed Index", score: 77, value: "4.2 s" },
];

const gauge = (label: string, score: number, value: string): Gauge => ({
  kind: "gauge",
  label,
  score,
  value,
});

/** Build the `pagespeed` output: a header, then mobile + desktop category bars
 *  and the mobile Core Web Vitals, as scored gauges. */
export function renderPagespeed(l: PagespeedLabels): OutLine[] {
  return [
    `PageSpeed Insights · ${LIGHTHOUSE}`,
    `// ${l.caption}`,
    `  ${l.mobile}`,
    ...CATEGORIES.map((c) => gauge(c.label, c.mobile, String(c.mobile))),
    `  ${l.desktop}`,
    ...CATEGORIES.map((c) => gauge(c.label, c.desktop, String(c.desktop))),
    `// ${l.metrics}`,
    ...METRICS.map((m) => gauge(m.label, m.score, m.value)),
  ];
}
