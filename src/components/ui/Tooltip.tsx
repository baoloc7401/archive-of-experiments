import { useRef, type ReactNode } from "react";
import { trackTip } from "./trackTip";
import "./Tooltip.css";

interface Props {
  /** Tooltip text shown on hover / keyboard focus. */
  label: string;
  /** Stretch the wrapper (and its child) to fill width — for full-width triggers. */
  block?: boolean;
  children: ReactNode;
}

/**
 * Custom animated tooltip. A styled bubble that fades in on hover / keyboard
 * focus and smoothly trails the cursor, replacing the unstyled, un-animated,
 * touch-unfriendly native `title`. The trigger keeps its own accessible name;
 * the bubble is supplementary (`role="tooltip"`) and out of the layout/pointer
 * flow when idle.
 *
 * This wrapper suits arbitrary triggers. Primitives that must stay a single
 * element in a flex/grid row (Button, Slider) host the bubble themselves via a
 * `tooltip` prop + the `ui-tip-host` class (same CSS, no wrapper).
 */
export default function Tooltip({ label, block = false, children }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={ref}
      className={block ? "ui-tip-wrap ui-tip-wrap--block" : "ui-tip-wrap"}
      onMouseMove={(e) => trackTip(ref.current, e)}
    >
      {children}
      <span className="ui-tip" role="tooltip">
        {label}
      </span>
    </span>
  );
}
