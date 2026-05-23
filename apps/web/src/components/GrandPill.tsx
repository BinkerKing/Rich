import type { Element, LearningPath } from "@ke/domain";
import { elementTypeClass, elementTypeLabel } from "./elementLabels.js";
import { Icon, iconForElement } from "./Icon.js";
import { elementDragProps, useDropTarget, type DropSide } from "../lib/elementDnd.js";
import "./components.css";

export function GrandPill({ el, onPaths, onSelect, onSetCenter, onOpenDetail, onDropOnto, selected = false, favorited = false }:
  { el: Element; onPaths: LearningPath[]; onSelect: () => void; onSetCenter?: () => void; onOpenDetail?: () => void; onDropOnto?: (sourceId: string, targetId: string, side: DropSide) => void; selected?: boolean; favorited?: boolean }) {
  const primary = onPaths[0];
  const cls = primary?.color === "gold" ? "path-gold"
    : primary?.color === "cyan" ? "path-cyan"
    : primary?.color === "pink" ? "path-pink" : "";
  const drop = useDropTarget(el.id, (src, side) => onDropOnto?.(src, el.id, side));
  void onSetCenter;
  const sideClass = drop.isOver
    ? drop.side === "before" ? " is-drop-before"
    : drop.side === "after"  ? " is-drop-after"
    :                          " is-drop-over"
    : "";
  return (
    <button
      className={`tree-element-card grand-pill ${elementTypeClass(el.type)} ${cls} ${selected ? "is-selected" : ""}${favorited ? " is-favorited" : ""}${sideClass}`}
      type="button"
      title="单击查看 · 双击打开详情页 · 可拖动 · 拖到兄弟卡片左/右可换位置 · 拖到中央(非兄弟)可移到该元下"
      onClick={onSelect}
      onDoubleClick={onOpenDetail}
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
