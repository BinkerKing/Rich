import type { Element, LearningPath } from "@ke/domain";
import { Icon, iconForElement } from "./Icon.js";
import "./components.css";

export function GrandPill({ el, onPaths, onSelect, selected = false }:
  { el: Element; onPaths: LearningPath[]; onSelect: () => void; selected?: boolean }) {
  const primary = onPaths[0];
  const cls = primary?.color === "gold" ? "path-gold"
    : primary?.color === "cyan" ? "path-cyan"
    : primary?.color === "pink" ? "path-pink" : "";
  return (
    <button className={`grand-pill ${cls} ${selected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <Icon name={iconForElement(el.type, el.title)} />
      <span>{el.title}</span>
      {primary && <em>{primary.label}</em>}
    </button>
  );
}
