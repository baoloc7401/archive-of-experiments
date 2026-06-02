import ScrambleText from "../../../components/ScrambleText";

const ITEMS: { cls: string; label: string }[] = [
  { cls: "aco-lg--pher", label: "pheromone trail" },
  { cls: "aco-lg--best", label: "best tour" },
  { cls: "aco-lg--ant", label: "ant" },
  { cls: "aco-lg--city", label: "city" },
];

export default function Legend() {
  return (
    <div className="aco-legend">
      {ITEMS.map((it) => (
        <span key={it.cls} className="aco-lg">
          <span className={`aco-lg-swatch ${it.cls}`} aria-hidden="true" />
          <ScrambleText text={it.label} duration={500} />
        </span>
      ))}
    </div>
  );
}
