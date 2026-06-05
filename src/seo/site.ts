// Single source of truth for site-wide SEO metadata. Framework-free so it can be
// imported both at build time (the vite-seo plugin) and at runtime (the <Seo>
// component). Per-experiment copy is derived from the i18n `en` locale so the
// search/social text never drifts from what the cards already show.
import { experiments } from "../experiments";
import en from "../i18n/locales/en";

/** Deployed origin + base path, no trailing slash. */
export const BASE_URL = "https://baoloc7401.github.io/archive-of-experiments";

export const SITE = {
  name: "Archive of Experiments",
  title: "Archive of Experiments — Interactive Algorithm Visualizations",
  description:
    "A sandbox of interactive algorithm and data-structure visualizations — a chess engine with minimax + alpha-beta, A*/Dijkstra pathfinding, ant colony optimization, elevator scheduling, river-crossing state-space search, and a no-guess Minesweeper. Built to learn.",
  author: "Le Tran Bao Loc",
  authorUrl: "https://github.com/baoloc7401",
  locale: "en_US",
  themeColor: "#07080d",
  image: `${BASE_URL}/og-image.png`,
  keywords: [
    "algorithm visualization",
    "interactive algorithms",
    "data structures",
    "pathfinding",
    "A* algorithm",
    "Dijkstra",
    "chess engine",
    "minimax",
    "alpha-beta pruning",
    "ant colony optimization",
    "traveling salesman",
    "minesweeper solver",
    "elevator scheduling",
    "state-space search",
    "BFS",
    "DFS",
    "React",
  ],
} as const;

/** Absolute, canonical URL for an app path (always trailing-slash form). */
export function siteUrl(path: string): string {
  const clean = path.replace(/^\/+|\/+$/g, "");
  return clean ? `${BASE_URL}/${clean}/` : `${BASE_URL}/`;
}

export interface PageMeta {
  /** Experiment id, or "" for the home page. */
  id: string;
  /** App route path, e.g. "/experiments/chess". */
  path: string;
  title: string;
  description: string;
  canonical: string;
}

const enExperiments = en.experiments as Record<
  string,
  { title: string; description: string }
>;

/** Per-experiment SEO metadata for every `active` experiment (the routed ones). */
export const experimentPages: PageMeta[] = experiments
  .filter((e) => e.status === "active")
  .map((e) => {
    const copy = enExperiments[e.id];
    return {
      id: e.id,
      path: e.path,
      title: `${copy.title} — ${SITE.name}`,
      description: copy.description,
      canonical: siteUrl(e.path),
    };
  });

export const homePage: PageMeta = {
  id: "",
  path: "/",
  title: SITE.title,
  description: SITE.description,
  canonical: siteUrl("/"),
};

const author = { "@type": "Person", name: SITE.author, url: SITE.authorUrl };

/** WebSite + ItemList structured data for the gateway/home page. */
export function homeJsonLd(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: siteUrl("/"),
    description: SITE.description,
    inLanguage: "en",
    author,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: experimentPages.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: p.canonical,
        name: enExperiments[p.id].title,
      })),
    },
  };
}

/** WebApplication + BreadcrumbList structured data for an experiment page. */
export function experimentJsonLd(page: PageMeta): object[] {
  const name = enExperiments[page.id].title;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name,
      url: page.canonical,
      description: page.description,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any (modern web browser)",
      browserRequirements: "Requires JavaScript",
      inLanguage: "en",
      isAccessibleForFree: true,
      author,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE.name,
          item: siteUrl("/"),
        },
        { "@type": "ListItem", position: 2, name, item: page.canonical },
      ],
    },
  ];
}
