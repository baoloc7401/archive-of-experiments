import { useTranslation } from "react-i18next";
import ScrambleText from "../../components/ScrambleText";
import { ExperimentLayout } from "../../components/ui";
import "./SortingVisualizer.css";

export default function SortingVisualizer() {
  const { t } = useTranslation();

  return (
    <ExperimentLayout
      glow="accent"
      centered
      crumbs={[
        { label: t("experiments.sorting-visualizer.title").toLowerCase(), to: "/experiments/sorting-visualizer" },
      ]}
      info={
        <p className="sv-tagline">
          <ScrambleText text={t("experiments.sorting-visualizer.tagline")} duration={600} />
        </p>
      }
    >
      <div className="sv-wip">
        <h1 className="sv-title">
          <ScrambleText text={t("experiments.sorting-visualizer.title")} duration={700} />
        </h1>
        <p className="sv-desc">
          <ScrambleText text={t("experiments.sorting-visualizer.description")} duration={600} />
        </p>
        <p className="sv-note">
          <ScrambleText text={t("experiments.sorting-visualizer.wip_note")} duration={600} />
        </p>
        <span className="sv-badge" aria-label={t("status.wip")}>
          {t("status.wip")}
        </span>
      </div>
    </ExperimentLayout>
  );
}
