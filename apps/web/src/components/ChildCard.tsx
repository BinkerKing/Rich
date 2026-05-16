import type { Element, LearningPath } from "@ke/domain";
import "./components.css";

interface Props {
  el: Element;
  onPaths: LearningPath[]; // paths this element is part of (any step)
  onSelect: () => void;
}

export function ChildCard({ el, onPaths, onSelect }: Props) {
  const primary = onPaths[0];
  const cls = primary?.color === "gold" ? "path-gold"
    : primary?.color === "cyan" ? "path-cyan"
    : primary?.color === "pink" ? "path-pink" : "";
  return (
    <div className={`child-card ${cls}`} onClick={onSelect}>
      <h4>{el.title}</h4>
      {primary && <div className="badge">{primary.label}</div>}
    </div>
  );
}
