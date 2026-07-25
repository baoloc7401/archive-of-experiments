import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";

const ITEMS: { cls: string; key: string }[] = [
  { cls: "aco-lg--pher", key: "pheromone" },
  { cls: "aco-lg--best", key: "best" },
  { cls: "aco-lg--ant", key: "ant" },
  { cls: "aco-lg--city", key: "city" },
];

export default function Legend() {
  const { t } = useTranslation();
  return (
    <div className="aco-legend">
      {ITEMS.map((it) => (
        <span key={it.cls} className="aco-lg">
          <span className={`aco-lg-swatch ${it.cls}`} aria-hidden="true" />
          <ScrambleText text={t(`experiments.aco.legend.${it.key}`)} duration={500} />
        </span>
      ))}
    </div>
  );
}
