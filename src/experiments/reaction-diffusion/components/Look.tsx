import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Button, Panel } from "../../../components/ui";
import type { RDParams } from "../types";
import { RES_LEVELS } from "../constants";
import { PALETTE_IDS, paletteAccentCss } from "../palettes";

interface Props {
  params: RDParams;
  onChange: (p: Partial<RDParams>) => void;
  onExport: () => void;
}

/** Palette picker, resolution picker, and the PNG export, mirroring n-body's Look. */
export default function Look({ params, onChange, onExport }: Props) {
  const { t } = useTranslation();
  return (
    <Panel title={t("experiments.reaction-diffusion.look_title")}>
      <div className="rd-presets">
        {PALETTE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`rd-chip rd-chip--swatch${id === params.palette ? " rd-chip--on" : ""}`}
            aria-pressed={id === params.palette}
            onClick={() => onChange({ palette: id })}
          >
            <i className="rd-swatch" style={{ background: paletteAccentCss(id) }} aria-hidden="true" />
            <ScrambleText text={t(`experiments.reaction-diffusion.palette_${id}`)} duration={400} />
          </button>
        ))}
      </div>

      <div className="rd-look-field">
        <span className="rd-look-label">
          <ScrambleText text={t("experiments.reaction-diffusion.resolution")} duration={400} />
        </span>
        <div className="rd-presets">
          {RES_LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              className={`rd-chip${lvl.scale === params.resolution ? " rd-chip--on" : ""}`}
              aria-pressed={lvl.scale === params.resolution}
              onClick={() => onChange({ resolution: lvl.scale })}
            >
              <ScrambleText text={t(`experiments.reaction-diffusion.res_${lvl.id}`)} duration={400} />
            </button>
          ))}
        </div>
      </div>

      <div className="rd-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          tooltip={t("experiments.reaction-diffusion.export_hint")}
        >
          <ScrambleText text={t("experiments.reaction-diffusion.export")} duration={400} />
        </Button>
      </div>
    </Panel>
  );
}
