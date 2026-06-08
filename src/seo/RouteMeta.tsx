import { useLocation } from "react-router-dom";
import { experimentPages, homePage, staticPages, type PageMeta } from "./site";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * Centralized per-route document metadata. Rendered once inside the router; on
 * every client-side navigation it resolves the current path to a PageMeta and
 * updates the head tags in place. First paint is already correct via the static
 * HTML emitted by scripts/vite-seo.ts - this keeps SPA navigation in sync.
 */
export default function RouteMeta() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, "") || "/";
  let page: PageMeta | undefined =
    path === "/"
      ? homePage
      : (staticPages.find((p) => path === p.path) ??
        experimentPages.find(
          (p) => path === p.path || path.startsWith(`${p.path}/`)
        ));
  // Unknown deep path still belongs to the gateway - fall back to home meta.
  if (!page) page = homePage;
  useDocumentMeta(page);
  return null;
}
