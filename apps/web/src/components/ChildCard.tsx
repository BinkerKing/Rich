import type { Element, LearningPath } from "@ke/domain";
import { elementTypeClass, elementTypeLabel } from "./elementLabels.js";
import { Icon, iconForElement } from "./Icon.js";
import { elementDragProps, useDropTarget, type DropSide } from "../lib/elementDnd.js";
import "./components.css";

interface Props {
  el: Element;
  onPaths: LearningPath[]; // paths this element is part of (any step)
  onSelect: () => void;
  onSetCenter?: () => void;
  /** Double-click = open detail page (fullscreen). */
  onOpenDetail?: () => void;
  /** `side` reports whether the cursor was over the left third / right
   *  third / middle when the drop landed. Used by the host to choose
   *  reorder ("before"/"after" a sibling) vs reparent ("on" a non-sibling). */
  onDropOnto?: (sourceId: string, targetId: string, side: DropSide) => void;
  selected?: boolean;
  favorited?: boolean;
}

export function ChildCard({ el, onPaths, onSelect, onSetCenter, onOpenDetail, onDropOnto, selected = false, favorited = false }: Props) {
  const primary = onPaths[0];
  const cls = primary?.color === "gold" ? "path-gold"
    : primary?.color === "cyan" ? "path-cyan"
    : primary?.color === "pink" ? "path-pink" : "";
  const drop = useDropTarget(el.id, (src, side) => onDropOnto?.(src, el.id, side));
  // Keep onSetCenter referenced so prop drilling stays consistent — set via
  // right-click menu rather than double-click now.
  void onSetCenter;
  const sideClass = drop.isOver
    ? drop.side === "before" ? " is-drop-before"
    : drop.side === "after"  ? " is-drop-after"
    :                          " is-drop-over"
    : "";
  return (
    <button
      className={`tree-element-card child-card ${elementTypeClass(el.type)} ${cls} ${selected ? "is-selected" : ""}${favorited ? " is-favorited" : ""}${sideClass}`}
      type="button"
      title="单击查看 · 双击打开详情页 · 可拖动 · 拖到兄弟卡片左/右边可换位置 · 拖到中央(非兄弟)可移到该元下"
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
