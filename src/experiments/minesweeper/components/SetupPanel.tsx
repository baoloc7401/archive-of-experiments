import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Tooltip } from "@/components/ui";
import type { Difficulty, FieldConfig } from "../types";
import { MAX_DENSITY, MAX_DIM, MIN_DIM, MIN_MINES, PRESETS } from "../constants";

interface Props {
  difficulty: Difficulty;
  cfg: FieldConfig;
  onDifficulty: (d: Difficulty) => void;
  onPatch: (patch: Partial<FieldConfig>) => void;
  onNew: () => void;
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="ms-param">
      <span className="ms-param-head">
        <span className="ms-param-label">
          <ScrambleText text={label} duration={500} />
        </span>
        <span className="ms-param-val">{value}</span>
      </span>
      <input
        type="range"
        className="ms-slider"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function SetupPanel({ difficulty, cfg, onDifficulty, onPatch, onNew }: Props) {
  const { t } = useTranslation();
  const total = cfg.width * cfg.height;
  const safeCells = (cfg.safeRadius * 2 + 1) ** 2;
  const maxMines = Math.max(MIN_MINES, Math.min(total - safeCells, Math.floor(total * MAX_DENSITY)));
  const mines = Math.min(cfg.mines, maxMines);

  return (
    <div className="ms-setup">
      <div className="ms-chip-row">
        {PRESETS.map((p) => (
          <Tooltip
            key={p.id}
            label={t("experiments.minesweeper.setup.preset_hint", { w: p.width, h: p.height, mines: p.mines })}
          >
            <button
              className={`ms-chip${difficulty === p.id ? " ms-chip--on" : ""}`}
              onClick={() => onDifficulty(p.id)}
            >
              <ScrambleText text={t(`experiments.minesweeper.presets.${p.id}`)} duration={500} />
            </button>
          </Tooltip>
        ))}
        <button
          className={`ms-chip${difficulty === "custom" ? " ms-chip--on" : ""}`}
          onClick={() => onDifficulty("custom")}
        >
          <ScrambleText text={t("experiments.minesweeper.setup.custom")} duration={500} />
        </button>
      </div>

      <Slider label={t("experiments.minesweeper.setup.width")} value={cfg.width} min={MIN_DIM} max={MAX_DIM} onChange={(width) => onPatch({ width })} />
      <Slider label={t("experiments.minesweeper.setup.height")} value={cfg.height} min={MIN_DIM} max={MAX_DIM} onChange={(height) => onPatch({ height })} />
      <Slider label={t("experiments.minesweeper.setup.mines")} value={mines} min={MIN_MINES} max={maxMines} onChange={(m) => onPatch({ mines: m })} />
      <div className="ms-density">
        {t("experiments.minesweeper.setup.density", { pct: ((mines / total) * 100).toFixed(1) })}
        <span className="ms-density-cap"> · {t("experiments.minesweeper.setup.density_cap", { cap: Math.round(MAX_DENSITY * 100) })}</span>
      </div>

      <div className="ms-field-row">
        <span className="ms-field-label">
          <ScrambleText text={t("experiments.minesweeper.setup.first_click_safety")} duration={500} />
        </span>
        <div className="ms-toggle-pair">
          <Tooltip label={t("experiments.minesweeper.setup.safe_cell_hint")}>
            <button
              className={`ms-mini${cfg.safeRadius === 0 ? " ms-mini--on" : ""}`}
              onClick={() => onPatch({ safeRadius: 0 })}
            >
              <ScrambleText text={t("experiments.minesweeper.setup.safe_cell")} duration={500} />
            </button>
          </Tooltip>
          <Tooltip label={t("experiments.minesweeper.setup.safe_neighbours_hint")}>
            <button
              className={`ms-mini${cfg.safeRadius === 1 ? " ms-mini--on" : ""}`}
              onClick={() => onPatch({ safeRadius: 1 })}
            >
              <ScrambleText text={t("experiments.minesweeper.setup.safe_neighbours")} duration={500} />
            </button>
          </Tooltip>
        </div>
      </div>

      <label className="ms-field-row">
        <span className="ms-field-label">
          <ScrambleText text={t("experiments.minesweeper.setup.seed")} duration={500} />
        </span>
        <Tooltip label={t("experiments.minesweeper.setup.seed_hint")}>
          <input
            type="number"
            className="ms-seed"
            value={cfg.seed}
            min={0}
            onChange={(e) => onPatch({ seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            aria-label={t("experiments.minesweeper.setup.seed")}
          />
        </Tooltip>
      </label>

      <Tooltip label={t("experiments.minesweeper.setup.new_hint")} block>
        <button className="ms-btn ms-btn-accent ms-setup-new" onClick={onNew}>
          <ScrambleText text={t("experiments.minesweeper.setup.new")} duration={500} />
        </button>
      </Tooltip>
    </div>
  );
}
