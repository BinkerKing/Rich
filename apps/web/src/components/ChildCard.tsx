import type { Element, LearningPath } from "@ke/domain";
import { elementTypeClass, elementTypeLabel } from "./elementLabels.js";
import { Icon, iconForElement } from "./Icon.js";
import { elementDragProps, useDropTarget } from "../lib/elementDnd.js";
import "./components.css";

interface Props {
  el: Element;
  onPaths: LearningPath[]; // paths this element is part of (any step)
  onSelect: () => void;
  onSetCenter?: () => void;
  /** Double-click = open detail page (fullscreen). */
  onOpenDetail?: () => void;
  onDropOnto?: (sourceId: string, targetId: string) => void;
  selected?: boolean;
  favorited?: boolean;
}

export function ChildCard({ el, onPaths, onSelect, onSetCenter, onOpenDetail, onDropOnto, selected = false, favorited = false }: Props) {
  const primary = onPaths[0];
  const cls = primary?.color === "gold" ? "path-gold"
    : primary?.color === "cyan" ? "path-cyan"
    : primary?.color === "pink" ? "path-pink" : "";
  const drop = useDropTarget(el.id, src => onDropOnto?.(src, el.id));
  // Keep onSetCenter referenced so prop drilling stays consistent — set via
  // right-click menu rather than double-click now.
  void onSetCenter;
  return (
    <button
      className={`tree-element-card child-card ${elementTypeClass(el.type)} ${cls} ${selected ? "is-selected" : ""}${favorited ? " is-favorited" : ""}${drop.isOver ? " is-drop-over" : ""}`}
      type="button"
      title="单击查看 · 双击打开详情页 · 可拖动 · 右键更多操作"
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
