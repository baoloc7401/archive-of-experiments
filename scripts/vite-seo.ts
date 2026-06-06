// Build-time SEO plugin. GitHub Pages serves static files with no SSR, and
// social unfurlers (Facebook/LinkedIn/Slack/Discord) don't run JavaScript - so
// every shareable route needs its <head> baked into static HTML. This plugin:
//   1. injects the home page's SEO tags into index.html (dev + build), and
//   2. on build, writes experiments/{id}/index.html for each active experiment
//      with route-specific title/description/canonical/OG/JSON-LD, plus a
//      sitemap.xml - all derived from the single source of truth in src/seo/site.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import {
  SITE,
  experimentJsonLd,
  experimentPages,
  homeJsonLd,
  homePage,
  type PageMeta,
} from "../src/seo/site";

const START = "<!-- seo:start -->";
const END = "<!-- seo:end -->";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render the per-page SEO tag block that lives between the seo markers. */
function renderSeoTags(
  page: PageMeta,
  jsonLd: object | object[],
  isHome: boolean
): string {
  const lines = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<meta name="author" content="${esc(SITE.author)}" />`,
    `<link rel="canonical" href="${page.canonical}" />`,
    // Open Graph
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE.name)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${page.canonical}" />`,
    `<meta property="og:image" content="${SITE.image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:locale" content="${SITE.locale}" />`,
    // Twitter
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${SITE.image}" />`,
  ];
  if (isHome) {
    lines.splice(
      3,
      0,
      `<meta name="keywords" content="${esc(SITE.keywords.join(", "))}" />`
    );
  }
  lines.push(
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
  );
  return lines.join("\n    ");
}

/** Replace the content between the seo markers (markers preserved). */
function injectSeo(html: string, inner: string): string {
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  if (s === -1 || e === -1) return html;
  return (
    html.slice(0, s + START.length) +
    "\n    " +
    inner +
    "\n    " +
    html.slice(e)
  );
}

function renderSitemap(pages: PageMeta[]): string {
  const urls = pages
    .map(
      (p) =>
        `  <url>\n    <loc>${p.canonical}</loc>\n    <changefreq>monthly</changefreq>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function seoPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "archive-seo",
    configResolved(c) {
      config = c;
    },
    // Bake the home page's SEO tags into index.html for both dev and build.
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return injectSeo(
          html,
          renderSeoTags(homePage, homeJsonLd(), true)
        );
      },
    },
    // After the bundle is written, emit a static HTML file per active
    // experiment (with its own head) plus the sitemap.
    closeBundle() {
      if (config.command !== "build") return;
      const outDir = resolve(config.root, config.build.outDir);
      const indexPath = resolve(outDir, "index.html");
      let baseHtml: string;
      try {
        baseHtml = readFileSync(indexPath, "utf8");
      } catch {
        this.warn("seo: dist/index.html not found, skipping per-route emit");
        return;
      }
      for (const page of experimentPages) {
        const html = injectSeo(
          baseHtml,
          renderSeoTags(page, experimentJsonLd(page), false)
        );
        // app path "/experiments/chess" -> dist/experiments/chess/index.html
        const rel = page.path.replace(/^\/+/, "");
        const dest = resolve(outDir, rel, "index.html");
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, html);
      }
      const sitemap = renderSitemap([homePage, ...experimentPages]);
      writeFileSync(resolve(outDir, "sitemap.xml"), sitemap);
      this.info(
        `seo: emitted ${experimentPages.length} route pages + sitemap.xml`
      );
    },
  };
}
