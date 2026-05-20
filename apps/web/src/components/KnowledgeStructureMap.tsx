import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { CenterView, Element, LearningPath, Relation } from "@ke/domain";
import { ChildCard } from "./ChildCard.js";
import { elementDragProps, useDropTarget } from "../lib/elementDnd.js";
import { elementTypeClass, elementTypeLabel } from "./elementLabels.js";
import { GrandPill } from "./GrandPill.js";
import { Icon, iconForElement } from "./Icon.js";
import { useStore } from "../state/store.js";
import "./components.css";

interface Props {
  view: CenterView;
  selectedId: string;
  relations: Relation[];
  elements: Map<string, Element>;
  totalElements: number;
  currentLevel: number;
  maxDepth: number;
  pathsForElement: (id: string) => LearningPath[];
  onSelect: (id: string) => void;
  onSetCenter: (id: string) => void;
  /** Called when a card is HTML5-dragged onto another card (= reparent). */
  onDropOnto?: (sourceId: string, targetId: string) => void;
  /** When true, the map is in "fullscreen within tv-main" mode (panel hidden). */
  expanded?: boolean;
  /** Toggle the expanded mode. */
  onToggleExpand?: () => void;
  /** Open the element detail page in fullscreen for the given element id. */
  onOpenDetail?: (elementId: string) => void;
}

interface TreeContextTarget {
  x: number;
  y: number;
  element: Element;
}

interface MapRow {
  parent: Element;
  nodes: Element[];
  selectedId?: string;
  kind: "wide" | "pill";
}

interface PositionedRow extends MapRow {
  top: number;
  height: number;
  width: number;
  gap: number;
  centers: number[];
  positions: Map<string, number>;
}

function directChildren(id: string, relations: Relation[], elements: Map<string, Element>) {
  return relations
    .filter(relation => relation.kind === "child" && relation.from === id)
    .map(relation => elements.get(relation.to))
    .filter((element): element is Element => Boolean(element));
}

function directParent(id: string, relations: Relation[]) {
  return relations.find(relation => relation.kind === "child" && relation.to === id)?.from;
}

function lineageFor(id: string, relations: Relation[], elements: Map<string, Element>) {
  const chain: Element[] = [];
  let current: string | undefined = id;
  const seen = new Set<string>();

  while (current && !seen.has(current)) {
    seen.add(current);
    const element = elements.get(current);
    if (element) chain.unshift(element);
    current = directParent(current, relations);
  }

  return chain;
}

export function KnowledgeStructureMap({
  view,
  selectedId,
  relations,
  elements,
  pathsForElement,
  onSelect,
  onSetCenter,
  onDropOnto,
  expanded,
  onToggleExpand,
  onOpenDetail,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [contextTarget, setContextTarget] = useState<TreeContextTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const favorites = useStore(s => s.favorites);
  const isFav = (id: string) => favorites.includes(id);
  const refine = useStore(s => s.refine);
  const expand = useStore(s => s.expand);
  const extend = useStore(s => s.extend);
  const generatePaths = useStore(s => s.generatePaths);
  const createChildElement = useStore(s => s.createChildElement);
  const inflight = useStore(s => s.inflight);
  const selected = elements.get(selectedId) ?? view.center;
  const root = view.center;
  const lineage = relativeLineageFor(root.id, selected.id, relations, elements);
  const rows = buildRows(lineage.length > 0 ? lineage : [root], relations, elements);
  const layout = treeLayout(rows);

  useEffect(() => {
    if (!contextTarget) return;

    const close = () => setContextTarget(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextTarget]);

  // Center the selected node in the scroll viewport whenever selection changes.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let cx: number;
    let cy: number;
    if (selected.id === root.id) {
      cx = layout.rootX;
      cy = layout.rootTop + 37;
    } else {
      const row = layout.rows.find(r => r.positions.has(selected.id));
      if (!row) return;
      cx = (row.positions.get(selected.id) ?? 0) + row.width / 2;
      cy = row.top + row.height / 2;
    }
    const targetLeft = Math.max(0, cx - scroller.clientWidth / 2);
    const targetTop = Math.max(0, cy - scroller.clientHeight / 2);
    scroller.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });
  }, [selected.id, layout]);

  useEffect(() => {
    if (!lastAction) return;
    const timer = window.setTimeout(() => setLastAction(null), 1600);
    return () => window.clearTimeout(timer);
  }, [lastAction]);

  function openNodeMenu(event: MouseEvent<HTMLElement>, element: Element) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(element.id);
    setContextTarget({
      x: Math.min(event.clientX, window.innerWidth - 228),
      y: Math.min(event.clientY, window.innerHeight - 272),
      element,
    });
  }

  async function runNodeAction(action: string) {
    if (!contextTarget) return;
    const element = contextTarget.element;
    setContextTarget(null);
    onSelect(element.id);

    switch (action) {
      case "打开":
        onOpenDetail?.(element.id);
        setLastAction(`打开 · ${element.title}`);
        return;
      case "设为中心":
        onSetCenter(element.id);
        setLastAction(`设为中心 · ${element.title}`);
        return;
      case "细化":
        setLastAction(`AI 正在细化 · ${element.title}`);
        await refine(element.id, 3);
        setLastAction(`细化完成 · ${element.title}`);
        return;
      case "展开下层":
        setLastAction(`AI 正在展开 · ${element.title}`);
        await expand(element.id, 4);
        setLastAction(`展开完成 · ${element.title}`);
        return;
      case "延伸": {
        const direction = window.prompt(
          `朝什么方向延伸「${element.title}」？\n例如：AI 领域应用 / 类似概念 / 反面观点`,
          "类似概念对比",
        );
        if (!direction || !direction.trim()) return;
        setLastAction(`AI 正在延伸 · ${element.title}`);
        await extend(element.id, direction.trim(), 3);
        setLastAction(`延伸完成 · ${element.title}`);
        return;
      }
      case "生成路径":
        setLastAction(`AI 正在生成路径 · ${element.title}`);
        await generatePaths(element.id);
        setLastAction(`路径已生成 · ${element.title}`);
        return;
      case "新增下级元": {
        const title = window.prompt(`在「${element.title}」下新增一个空的下级元，标题：`, "");
        const t = title?.trim();
        if (!t) return;
        setLastAction(`已新增「${t}」 · 挂在 ${element.title} 下`);
        try { await createChildElement(element.id, t); }
        catch (e) { setLastAction(`新增失败：${e instanceof Error ? e.message : String(e)}`); }
        return;
      }
      case "展开线路": {
        // Center the tree on the ROOT of the element's chain so all ancestors
        // — and the clicked element itself — are visible as a top-down path
        // from root down to it. TreeView's useEffect resets selectedId to
        // centerId on every center change, so we must re-select after that
        // effect runs (next tick) to keep the clicked element highlighted.
        let cur = element.id;
        const seen = new Set<string>();
        while (!seen.has(cur)) {
          seen.add(cur);
          const parent = relations.find(r => r.kind === "child" && r.to === cur)?.from;
          if (!parent) break;
          cur = parent;
        }
        if (cur === element.id) {
          // Already at root — nothing to expand upward.
          setLastAction(`「${element.title}」已是根，没有上层可展开`);
          return;
        }
        onSetCenter(cur);
        // Re-select the original (now deep) element AFTER the centerId-change
        // useEffect has run; that effect would otherwise reset selectedId to
        // the new center (the root).
        window.setTimeout(() => onSelect(element.id), 0);
        setLastAction(`展开线路 · 顶到 ${elements.get(cur)?.title ?? cur}`);
        return;
      }
      default:
        setLastAction(`${action} · ${element.title}`);
    }
  }

  function isOpInflight(elementId: string): boolean {
    for (const key of inflight.keys()) {
      if (key.endsWith(`:${elementId}`)) return true;
    }
    return false;
  }

  const renderNodeMenu = () => contextTarget && typeof document !== "undefined"
    ? createPortal(
        <div
          className="knowledge-context-menu tree-node-menu"
          style={{ left: contextTarget.x, top: contextTarget.y }}
          role="menu"
          onClick={event => event.stopPropagation()}
        >
          <div className="knowledge-context-menu__head">
            <strong>{contextTarget.element.title}</strong>
            <span>{contextTarget.element.type}</span>
          </div>
          {onOpenDetail && (
            <button
              type="button"
              role="menuitem"
              className="knowledge-context-menu__open"
              onClick={() => void runNodeAction("打开")}
            >
              打开 · 查看详情页
            </button>
          )}
          {["细化", "展开下层", "延伸", "生成路径"].map(action => (
            <button
              key={action}
              type="button"
              role="menuitem"
              disabled={isOpInflight(contextTarget.element.id)}
              onClick={() => void runNodeAction(action)}
            >
              {action}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => void runNodeAction("新增下级元")}
          >
            新增下级元
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void runNodeAction("展开线路")}
            title="把该元向上的全部父元显示出来（root 变成中心）"
          >
            展开线路
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={contextTarget.element.id === view.center.id}
            onClick={() => void runNodeAction("设为中心")}
          >
            {contextTarget.element.id === view.center.id ? "已是中心" : "设为中心"}
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <section className={`structure-map${expanded ? " structure-map--expanded" : ""}`}>
      <div className="structure-map__ambient" aria-hidden="true" />
      {onToggleExpand && (
        <button
          type="button"
          className="structure-map__expand"
          title={expanded ? "还原 · 显示元详情" : "展开知识树 · 隐藏元详情"}
          aria-label={expanded ? "还原" : "展开"}
          onClick={onToggleExpand}
        >
          <Icon name="expand" />
        </button>
      )}
      <div className="tree-canvas-scroll" aria-label="知识地图" ref={scrollRef}>
        <div className="tree-canvas" style={{ width: layout.canvasWidth, height: layout.canvasHeight }}>
          <svg
            className="tree-lines"
            width={layout.canvasWidth}
            height={layout.canvasHeight}
            viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="l2-line-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={layout.canvasWidth} y2="0">
                <stop offset="0%" stopColor="var(--center-accent-2)" />
                <stop offset="45%" stopColor="var(--center-accent)" />
                <stop offset="72%" stopColor="var(--center-warm)" />
                <stop offset="100%" stopColor="var(--center-accent)" />
              </linearGradient>
              <linearGradient id="l3-line-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={layout.canvasWidth} y2="0">
                <stop offset="0%" stopColor="var(--center-accent-2)" />
                <stop offset="52%" stopColor="var(--center-accent)" />
                <stop offset="100%" stopColor="var(--center-warm)" />
              </linearGradient>
            </defs>
            {layout.rows.map((row, index) => {
              // Row 0's children connect to the root; deeper rows connect to the
              // parent L2 (or further) node above. Use that parent's actual x,
              // not the root's, so the bus aligns with the parent column.
              const sourceX = index === 0
                ? layout.rootX
                : (layout.rows[index - 1].positions.get(row.parent.id) ?? layout.rootX)
                    + layout.rows[index - 1].width / 2;
              return (
                <path
                  key={`${row.parent.id}-${index}`}
                  className={`tree-line ${index === 0 ? "tree-line--root" : "tree-line--child"}`}
                  stroke={index === 0 ? "url(#l2-line-gradient)" : "url(#l3-line-gradient)"}
                  d={rootToChildrenPath(
                    sourceX,
                    row.centers,
                    layout.parentBottoms[index],
                    // Bus line sits midway between the parent's bottom edge
                    // and the child's top edge — works for any row gap.
                    (layout.parentBottoms[index] + row.top) / 2,
                    row.top,
                  )}
                />
              );
            })}
          </svg>

          <CenterDropButton
            root={root}
            selected={selected.id === root.id}
            favorited={isFav(root.id)}
            style={{ left: layout.rootLeft, top: layout.rootTop }}
            onSelect={onSelect}
            onSetCenter={onSetCenter}
            onOpenDetail={onOpenDetail}
            onContextMenu={event => openNodeMenu(event, root)}
            onDropOnto={onDropOnto}
          >
            <div className="structure-chain-card__title">
              <span className="node-glyph" aria-hidden="true">
                <Icon name={iconForElement(root.type, root.title)} />
              </span>
              <h2>{root.title}</h2>
              <span className="structure-chain-card__badge">{elementTypeLabel(root.type)}</span>
            </div>
            <p>{root.subtitle ?? "中心学习元"}</p>
          </CenterDropButton>

          {layout.rows.map((row, rowIndex) => (
            <div key={`${row.parent.id}-${rowIndex}`} className={row.kind === "wide" ? "structure-l2-row" : "structure-l3-row"}>
              {row.nodes.map(node => (
                <div
                  key={node.id}
                  className={`tree-node-wrap ${row.kind === "pill" ? "tree-node-wrap--pill" : ""}`}
                  style={{ left: row.positions.get(node.id) ?? 0, top: row.top }}
                  onContextMenu={event => openNodeMenu(event, node)}
                >
                  {row.kind === "wide" ? (
                    <ChildCard
                      el={node}
                      selected={selected.id === node.id}
                      favorited={isFav(node.id)}
                      onPaths={pathsForElement(node.id)}
                      onSelect={() => onSelect(node.id)}
                      onSetCenter={() => { onSelect(node.id); onSetCenter(node.id); }}
                      onOpenDetail={() => onOpenDetail?.(node.id)}
                      onDropOnto={onDropOnto}
                    />
                  ) : (
                    <GrandPill
                      el={node}
                      selected={selected.id === node.id}
                      favorited={isFav(node.id)}
                      onPaths={pathsForElement(node.id)}
                      onSelect={() => onSelect(node.id)}
                      onSetCenter={() => { onSelect(node.id); onSetCenter(node.id); }}
                      onOpenDetail={() => onOpenDetail?.(node.id)}
                      onDropOnto={onDropOnto}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}

          {rows.length === 0 && (
            <div className="structure-empty structure-empty--tree">当前元还没有下层方向</div>
          )}
          {renderNodeMenu()}
          {lastAction && typeof document !== "undefined"
            ? createPortal(<div className="knowledge-action-toast">{lastAction}</div>, document.body)
            : null}
        </div>
      </div>
    </section>
  );
}

function CenterDropButton({
  root, selected, favorited, style, onSelect, onSetCenter, onOpenDetail, onContextMenu, onDropOnto, children,
}: {
  root: Element;
  selected: boolean;
  favorited?: boolean;
  style: React.CSSProperties;
  onSelect: (id: string) => void;
  onSetCenter: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
  onDropOnto?: (sourceId: string, targetId: string) => void;
  children: React.ReactNode;
}) {
  const drop = useDropTarget(root.id, src => onDropOnto?.(src, root.id));
  void onSetCenter;
  return (
    <button
      className={`structure-chain-card ${elementTypeClass(root.type)} ${selected ? "is-selected" : ""}${favorited ? " is-favorited" : ""}${drop.isOver ? " is-drop-over" : ""}`}
      type="button"
      title="单击查看 · 双击打开详情页 · 拖到这里 = 设为新父元 · 右键更多操作"
      style={style}
      onClick={() => onSelect(root.id)}
      onDoubleClick={() => { onSelect(root.id); onOpenDetail?.(root.id); }}
      onContextMenu={onContextMenu}
      {...elementDragProps(root.id)}
      {...drop.bind}
    >
      {children}
    </button>
  );
}

function buildRows(lineage: Element[], relations: Relation[], elements: Map<string, Element>): MapRow[] {
  const rows: MapRow[] = [];

  lineage.forEach((parent, index) => {
    const nodes = directChildren(parent.id, relations, elements);
    if (nodes.length === 0) return;
    rows.push({
      parent,
      nodes,
      selectedId: lineage[index + 1]?.id,
      kind: index === 0 ? "wide" : "pill",
    });
  });

  return rows;
}

function relativeLineageFor(
  centerId: string,
  selectedId: string,
  relations: Relation[],
  elements: Map<string, Element>,
) {
  const center = elements.get(centerId);
  if (!center) return [];

  const fullLineage = lineageFor(selectedId, relations, elements);
  const centerIndex = fullLineage.findIndex(element => element.id === centerId);
  if (centerIndex >= 0) {
    return fullLineage.slice(centerIndex);
  }

  return [center];
}

function treeLayout(rows: MapRow[]) {
  const rootWidth = 450;
  // IMPORTANT: these must match the rendered card heights in components.css
  //   .structure-chain-card { height: 92px }
  //   .tree-element-card    { height: 86px }
  // The connector bus is computed as the midpoint between parent bottom and
  // child top, so wrong values here put the bus visually off-center.
  const rootHeight = 92;
  const rootTop = 18;
  const margin = 32;
  const wide = { width: 220, height: 86, gap: 12 };
  const pill = { width: 220, height: 86, gap: 12 };

  let requiredRootX = 560;
  for (const row of rows) {
    const size = row.kind === "wide" ? wide : pill;
    const rowWidth = row.nodes.length * size.width + Math.max(0, row.nodes.length - 1) * size.gap;
    const selectedIndex = row.selectedId
      ? Math.max(0, row.nodes.findIndex(node => node.id === row.selectedId))
      : -1;
    const leftNeed = selectedIndex >= 0
      ? margin + selectedIndex * (size.width + size.gap) + size.width / 2
      : margin + rowWidth / 2;
    requiredRootX = Math.max(requiredRootX, leftNeed);
  }

  const rootX = requiredRootX;
  const rootLeft = rootX - rootWidth / 2;
  const positionedRows: PositionedRow[] = [];
  const parentBottoms: number[] = [];
  let canvasWidth = Math.max(1100, rootX + rootWidth / 2 + margin);
  let previousTop = rootTop;
  let previousHeight = rootHeight;

  rows.forEach((row, index) => {
    const size = row.kind === "wide" ? wide : pill;
    const top = index === 0 ? rootTop + rootHeight + 40 : previousTop + previousHeight + 42;
    const rowWidth = row.nodes.length * size.width + Math.max(0, row.nodes.length - 1) * size.gap;
    const selectedIndex = row.selectedId
      ? row.nodes.findIndex(node => node.id === row.selectedId)
      : -1;
    const start = selectedIndex >= 0
      ? rootX - selectedIndex * (size.width + size.gap) - size.width / 2
      : rootX - rowWidth / 2;
    const centers = row.nodes.map((_, nodeIndex) => start + size.width / 2 + nodeIndex * (size.width + size.gap));
    const positions = new Map(row.nodes.map((node, nodeIndex) => [node.id, start + nodeIndex * (size.width + size.gap)]));
    const rightEdge = start + rowWidth;

    parentBottoms.push(index === 0 ? rootTop + rootHeight : previousTop + previousHeight);
    positionedRows.push({
      ...row,
      top,
      height: size.height,
      width: size.width,
      gap: size.gap,
      centers,
      positions,
    });
    canvasWidth = Math.max(canvasWidth, rightEdge + margin);
    previousTop = top;
    previousHeight = size.height;
  });

  const canvasHeight = Math.max(420, previousTop + previousHeight + 48);

  return {
    canvasWidth,
    canvasHeight,
    rootX,
    rootLeft,
    rootTop,
    rows: positionedRows,
    parentBottoms,
  };
}

/**
 * Right-angle tree connector: parent center drops down to a horizontal
 * "bus" line, the bus spans the leftmost-to-rightmost child x, and each
 * child gets its own vertical drop from the bus to its top edge.
 *
 * The 4th param `busY` is computed by the caller as the vertical midpoint
 * of the gap, so the bus sits cleanly between parent and children.
 */
function rootToChildrenPath(rootX: number, childCenters: number[], rootY: number, busY: number, childY: number) {
  if (childCenters.length === 0) return "";
  const first = childCenters[0];
  const last = childCenters[childCenters.length - 1];
  const drops = childCenters.map(x => `M ${x} ${busY} L ${x} ${childY}`).join(" ");
  return `M ${rootX} ${rootY} L ${rootX} ${busY} M ${first} ${busY} L ${last} ${busY} ${drops}`;
}
