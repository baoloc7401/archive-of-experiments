import { useId, useRef, type ReactNode } from "react";
import ScrambleText from "../ScrambleText";
import { trackTip } from "./trackTip";
import "./Slider.css";
import "./Tooltip.css";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Formatted current value (e.g. "1.4×", "12 ms"). Defaults to the raw number. */
  display?: ReactNode;
  disabled?: boolean;
  /** Stacked layout: label/value row on top, full-width track below. */
  stacked?: boolean;
  /** Custom animated, cursor-following tooltip for the control. */
  hint?: string;
}

/**
 * Labeled range input. Inline (label · track · value) by default, or stacked
 * for tighter columns. The label is associated with the input via `htmlFor`/`id`
 * so screen readers announce its purpose; `hint` shows an animated tooltip.
 */
export default function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  disabled,
  stacked = false,
  hint,
}: Props) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  const labelEl = (
    <label className="ui-slider-label" htmlFor={id}>
      <ScrambleText text={label} duration={500} />
    </label>
  );
  const valueEl = <span className="ui-slider-val">{display ?? value}</span>;
  const input = (
    <input
      id={id}
      className="ui-slider-input"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );

  const cls = `ui-slider${stacked ? " ui-slider--stacked" : ""}${hint ? " ui-tip-host" : ""}`;

  return (
    <div ref={ref} className={cls} onMouseMove={hint ? (e) => trackTip(ref.current, e) : undefined}>
      {stacked ? (
        <>
          <div className="ui-slider-head">
            {labelEl}
            {valueEl}
          </div>
          {input}
        </>
      ) : (
        <>
          {labelEl}
          {input}
          {valueEl}
        </>
      )}
      {hint && (
        <span className="ui-tip" role="tooltip">
          {hint}
        </span>
      )}
    </div>
  );
}
