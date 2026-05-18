import type { Element, LearningPath } from "@ke/domain";
import { elementTypeClass, elementTypeLabel } from "./elementLabels.js";
import { Icon, iconForElement } from "./Icon.js";
import { elementDragProps, useDropTarget } from "../lib/elementDnd.js";
import "./components.css";

export function GrandPill({ el, onPaths, onSelect, onSetCenter, onDropOnto, selected = false }:
  { el: Element; onPaths: LearningPath[]; onSelect: () => void; onSetCenter?: () => void; onDropOnto?: (sourceId: string, targetId: string) => void; selected?: boolean }) {
  const primary = onPaths[0];
  const cls = primary?.color === "gold" ? "path-gold"
    : primary?.color === "cyan" ? "path-cyan"
    : primary?.color === "pink" ? "path-pink" : "";
  const drop = useDropTarget(el.id, src => onDropOnto?.(src, el.id));
  return (
    <button
      className={`tree-element-card grand-pill ${elementTypeClass(el.type)} ${cls} ${selected ? "is-selected" : ""}${drop.isOver ? " is-drop-over" : ""}`}
      type="button"
      title="单击查看 · 双击设为中心 · 可拖动"
      onClick={onSelect}
      onDoubleClick={onSetCenter}
      {...elementDragProps(el.id)}
      {...drop.bind}
    >
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
