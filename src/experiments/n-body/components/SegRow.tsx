import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";

interface SegRowProps<T extends string> {
  label: string;
  /** i18n key prefix; option `o` resolves to `${prefix}${o}`. */
  prefix: string;
  value: T;
  options: readonly T[];
  onSelect: (value: T) => void;
}

/** A labeled row of mutually-exclusive segmented buttons. */
export default function SegRow<T extends string>({
  label,
  prefix,
  value,
  options,
  onSelect,
}: SegRowProps<T>) {
  const { t } = useTranslation();
  return (
    <div className="nb-field-row">
      <span className="nb-field-label">
        <ScrambleText text={label} duration={400} />
      </span>
      <div className="nb-seg">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`nb-seg-btn${opt === value ? " nb-seg-btn--on" : ""}`}
            aria-pressed={opt === value}
            onClick={() => onSelect(opt)}
          >
            <ScrambleText text={t(`${prefix}${opt}`)} duration={400} />
          </button>
        ))}
      </div>
    </div>
  );
}
