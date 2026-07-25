import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Button, Panel } from "@/components/ui";
import type { CAParams } from "../types";
import { CELL_LEVELS } from "../constants";
import { PALETTE_IDS, paletteAccentCss } from "../palettes";

interface Props {
  params: CAParams;
  onChange: (p: Partial<CAParams>) => void;
  onExport: () => void;
}

/** Palette picker, cell-size picker, and the PNG export, mirroring reaction-diffusion's Look. */
export default function Look({ params, onChange, onExport }: Props) {
  const { t } = useTranslation();
  return (
    <Panel title={t("experiments.cellular-automata.look_title")}>
      <div className="ca-presets">
        {PALETTE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`ca-chip ca-chip--swatch${id === params.palette ? " ca-chip--on" : ""}`}
            aria-pressed={id === params.palette}
            onClick={() => onChange({ palette: id })}
          >
            <i className="ca-swatch" style={{ background: paletteAccentCss(id) }} aria-hidden="true" />
            <ScrambleText text={t(`experiments.cellular-automata.palette_${id}`)} duration={400} />
          </button>
        ))}
      </div>

      <div className="ca-look-field">
        <span className="ca-look-label">
          <ScrambleText text={t("experiments.cellular-automata.cell_size")} duration={400} />
        </span>
        <div className="ca-presets">
          {CELL_LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              className={`ca-chip${lvl.px === params.cellSize ? " ca-chip--on" : ""}`}
              aria-pressed={lvl.px === params.cellSize}
              onClick={() => onChange({ cellSize: lvl.px })}
            >
              <ScrambleText text={t(`experiments.cellular-automata.cell_${lvl.id}`)} duration={400} />
            </button>
          ))}
        </div>
      </div>

      <div className="ca-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          tooltip={t("experiments.cellular-automata.export_hint")}
        >
          <ScrambleText text={t("experiments.cellular-automata.export")} duration={400} />
        </Button>
      </div>
    </Panel>
  );
}
