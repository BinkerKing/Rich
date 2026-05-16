import type { LearningPath } from "@ke/domain";
import "./components.css";

export function PathChip({ p, visible, onToggle }:
  { p: LearningPath; visible: boolean; onToggle: () => void }) {
  return (
    <span className={`path-chip ${p.color} ${visible ? "" : "off"}`} onClick={onToggle}>
      <span className="swatch" />
      {p.label}
    </span>
  );
}
