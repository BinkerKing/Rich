import type { Element, LearningPath } from "@ke/domain";
import "./components.css";

export function GrandPill({ el, onPaths, onSelect }:
  { el: Element; onPaths: LearningPath[]; onSelect: () => void }) {
  const primary = onPaths[0];
  const cls = primary?.color === "gold" ? "path-gold"
    : primary?.color === "cyan" ? "path-cyan"
    : primary?.color === "pink" ? "path-pink" : "";
  return <div className={`grand-pill ${cls}`} onClick={onSelect}>{el.title}</div>;
}
