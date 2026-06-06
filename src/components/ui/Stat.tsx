import type { ReactNode } from "react";
import ScrambleText from "../ScrambleText";
import "./Stat.css";

interface StatGridProps {
  columns?: number;
  children: ReactNode;
}

/** Grid container for {@link Stat} cards. */
export function StatGrid({ columns = 2, children }: StatGridProps) {
  return (
    <div
      className="ui-stat-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

interface StatProps {
  label: string;
  /** Rendered as-is - pass numbers directly; they are not scrambled per tick. */
  value: ReactNode;
  highlight?: boolean;
}

/** A single label/value readout card with tabular-aligned value. */
export function Stat({ label, value, highlight }: StatProps) {
  return (
    <div className={highlight ? "ui-stat ui-stat--hi" : "ui-stat"}>
      <span className="ui-stat-label">
        <ScrambleText text={label} duration={500} />
      </span>
      <span className="ui-stat-val">{value}</span>
    </div>
  );
}
