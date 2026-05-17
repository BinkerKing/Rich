import type { Element, LearningPath } from "@ke/domain";
import { elementTypeClass, elementTypeLabel } from "./elementLabels.js";
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
    <button className={`tree-element-card child-card ${elementTypeClass(el.type)} ${cls} ${selected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <span className="tree-element-card__line">
        <span className="tree-element-card__icon" aria-hidden="true">
          <Icon name={iconForElement(el.type, el.title)} />
        </span>
        <span className="tree-element-card__title">{el.title}</span>
        <span className="tree-element-card__type">{elementTypeLabel(el.type)}</span>
      </span>
      <span className="tree-element-card__desc">{el.subtitle ?? primary?.label ?? "等待补充说明"}</span>
    </button>
  );
}
