import { useState } from "react";
import ScrambleText from "@/components/ScrambleText";

interface Props {
  title: string;
  /** Whether the section starts expanded. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible sidebar section on native `<details>` (accessible by default). Open
 * state is mirrored into React via `onToggle` so the parent's re-renders don't
 * reset the user's toggle.
 */
export default function Section({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="ms-section" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="ms-section-head">
        <span className="ms-section-title">
          <ScrambleText text={title} duration={500} />
        </span>
        <span className="ms-section-caret" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="ms-section-body">{children}</div>
    </details>
  );
}
