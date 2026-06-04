import { useTranslation } from "react-i18next";
import type { Config } from "../types";
import { MAX_CAP, MAX_PEOPLE, MIN_CAP, MIN_PEOPLE } from "../constants";

interface Props {
  cfg: Config;
  onChange: (patch: Partial<Config>) => void;
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const { t } = useTranslation();
  return (
    <div className="rc-stepper">
      <span className="rc-stepper-label">{label}</span>
      <div className="rc-stepper-ctrl">
        <button
          type="button"
          className="rc-stepper-btn"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label={t("experiments.river-crossing.setup.decrease", { label })}
        >
          −
        </button>
        <span className="rc-stepper-value">{value}</span>
        <button
          type="button"
          className="rc-stepper-btn"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          aria-label={t("experiments.river-crossing.setup.increase", { label })}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Changing any number rebuilds the puzzle from scratch — that's the whole point
 * of the state-space framing: the same solver handles every variant.
 */
export default function SetupPanel({ cfg, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <section className="rc-setup">
      <div className="rc-panel-head">{t("experiments.river-crossing.setup.title")}</div>
      <div className="rc-steppers">
        <Stepper
          label={t("experiments.river-crossing.setup.missionaries")}
          value={cfg.m}
          min={MIN_PEOPLE}
          max={MAX_PEOPLE}
          onChange={(m) => onChange({ m })}
        />
        <Stepper
          label={t("experiments.river-crossing.setup.cannibals")}
          value={cfg.c}
          min={MIN_PEOPLE}
          max={MAX_PEOPLE}
          onChange={(c) => onChange({ c })}
        />
        <Stepper
          label={t("experiments.river-crossing.setup.boat_seats")}
          value={cfg.k}
          min={MIN_CAP}
          max={MAX_CAP}
          onChange={(k) => onChange({ k })}
        />
      </div>
    </section>
  );
}
