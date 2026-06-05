import { useEffect } from "react";
import { SITE, type PageMeta } from "./site";

// Keep the document <head> in sync with the current route during client-side
// navigation (and for Googlebot's rendered pass). The static per-route HTML
// emitted by scripts/vite-seo.ts already ships correct tags on first paint;
// this updates the SAME tags in place — no duplicate <title>/<meta> — when the
// SPA navigates without a full reload.

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useDocumentMeta(page: PageMeta | undefined) {
  const title = page?.title;
  const description = page?.description;
  const canonical = page?.canonical;
  useEffect(() => {
    if (!title || !description || !canonical) return;
    document.title = title;
    upsertMeta("name", "description", description);
    upsertCanonical(canonical);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", SITE.image);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
  }, [title, description, canonical]);
}
