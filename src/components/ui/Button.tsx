import { useRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import "./Button.css";
import "./Tooltip.css";
import { trackTip } from "./trackTip";

export type ButtonVariant = "ghost" | "primary" | "accent" | "pause";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  /** Custom animated, cursor-following tooltip (replaces the native `title`). */
  tooltip?: string;
}

/**
 * The one bordered control button shared by every experiment.
 * `ghost` is the neutral default; `primary` (green), `accent` (purple) and
 * `pause` (yellow) tint border + text for emphasis. When `tooltip` is set the
 * button hosts the animated bubble itself, so it stays a single flex/grid item.
 */
export default function Button({
  variant = "ghost",
  size = "md",
  tooltip,
  className = "",
  type = "button",
  children,
  onMouseMove,
  ...rest
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const cls = [
    "ui-btn",
    variant !== "ghost" && `ui-btn--${variant}`,
    size === "sm" && "ui-btn--sm",
    tooltip && "ui-tip-host",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function handleMove(e: MouseEvent<HTMLButtonElement>) {
    if (tooltip) trackTip(ref.current, e);
    onMouseMove?.(e);
  }

  return (
    <button ref={ref} type={type} className={cls} onMouseMove={handleMove} {...rest}>
      {children}
      {tooltip && (
        <span className="ui-tip" role="tooltip">
          {tooltip}
        </span>
      )}
    </button>
  );
}
