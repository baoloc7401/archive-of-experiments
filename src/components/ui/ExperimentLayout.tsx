import type { CSSProperties, ReactNode } from "react";
import ExperimentHeader, { type Crumb } from "../ExperimentHeader";
import "./ExperimentLayout.css";

interface Props {
  crumbs: Crumb[];
  /** Optional intro strip (tagline / description) under the header. */
  info?: ReactNode;
  /** Sticky sidebar content. When omitted, children fill the full width. */
  sidebar?: ReactNode;
  /** Centered, max-width content shell (e.g. chess) instead of full-bleed. */
  centered?: boolean;
  /** Page background glow tint. */
  glow?: "accent" | "accent2";
  /** Sidebar column width (default 320px). */
  sidebarWidth?: string;
  children: ReactNode;
}

/**
 * Standard experiment shell: page background glow + shared topbar, plus an
 * optional intro strip and a 2-column stage/sidebar grid that collapses on
 * narrow viewports. Replaces the per-experiment `*-page` scaffolding.
 */
export default function ExperimentLayout({
  crumbs,
  info,
  sidebar,
  centered = false,
  glow = "accent2",
  sidebarWidth,
  children,
}: Props) {
  return (
    <div className={`ui-page ui-page--${glow}`}>
      <ExperimentHeader crumbs={crumbs} />
      {info && <div className="ui-info-strip">{info}</div>}
      {sidebar ? (
        <div
          className={centered ? "ui-layout ui-layout--centered" : "ui-layout"}
          style={
            sidebarWidth
              ? ({ "--ui-sidebar-w": sidebarWidth } as CSSProperties)
              : undefined
          }
        >
          <main className="ui-stage">{children}</main>
          <aside className="ui-sidebar">{sidebar}</aside>
        </div>
      ) : (
        <div className={centered ? "ui-content ui-content--centered" : "ui-content"}>
          {children}
        </div>
      )}
    </div>
  );
}

export type { Crumb };
