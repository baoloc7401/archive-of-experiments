import { useState, type ReactNode } from "react";
import ScrambleText from "../ScrambleText";
import "./Panel.css";

interface Props {
  /** Section heading. Omit for a plain titled-less box (always static). */
  title?: string;
  /** Whether the section starts expanded (collapsible mode only). */
  defaultOpen?: boolean;
  /** When false, renders a static titled box instead of a collapsible one. */
  collapsible?: boolean;
  /** Non-interactive content shown at the right of the title row (e.g. a badge). */
  aside?: ReactNode;
  children: ReactNode;
}

const Caret = (
  <span className="ui-panel-caret" aria-hidden="true">
    ▾
  </span>
);

/**
 * Sidebar panel. Collapsible by default, built on native `<details>` so it's
 * keyboard-accessible for free; open state is mirrored to React so parent
 * re-renders don't reset the user's toggle. With no `title` it's a plain box.
 */
export default function Panel({
  title,
  defaultOpen = true,
  collapsible = true,
  aside,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  if (!title) {
    return <section className="ui-panel">{children}</section>;
  }

  const heading = (
    <span className="ui-panel-title">
      <ScrambleText text={title} duration={500} />
    </span>
  );

  if (!collapsible) {
    return (
      <section className="ui-panel">
        <div className="ui-panel-head ui-panel-head--static">
          {heading}
          {aside}
        </div>
        <div className="ui-panel-body">{children}</div>
      </section>
    );
  }

  return (
    <details
      className="ui-panel"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="ui-panel-head">
        {heading}
        {aside}
        {Caret}
      </summary>
      <div className="ui-panel-body">{children}</div>
    </details>
  );
}
