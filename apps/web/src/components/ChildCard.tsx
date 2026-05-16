import type { Element, LearningPath } from "@ke/domain";
import { Icon, iconForElement } from "./Icon.js";
import "./components.css";

interface Props {
  el: Element;
  onPaths: LearningPath[]; // paths this element is part of (any step)
  onSelect: () => void;
  selected?: boolean;
}

export function ChildCard({ el, onPaths, onSelect, selected = false }: Props) {
  const primary = onPaths[0];
  const cls = primary?.color === "gold" ? "path-gold"
    : primary?.color === "cyan" ? "path-cyan"
    : primary?.color === "pink" ? "path-pink" : "";
  return (
    <button className={`child-card ${cls} ${selected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <span className="child-card__icon" aria-hidden="true">
        <Icon name={iconForElement(el.type, el.title)} />
      </span>
      <h4>{el.title}</h4>
      {el.subtitle && <p>{el.subtitle}</p>}
      {primary && <div className="badge">{primary.label}</div>}
    </button>
  );
}
