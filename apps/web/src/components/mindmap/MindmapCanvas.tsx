import { useEffect, useRef, useState } from "react";
import MindMap from "simple-mind-map";
import Drag from "simple-mind-map/src/plugins/Drag.js";
import Select from "simple-mind-map/src/plugins/Select.js";
import Export from "simple-mind-map/src/plugins/Export.js";
import RichText from "simple-mind-map/src/plugins/RichText.js";
import { applyPanSensitivity, boundedCanvasPanDelta, nextInertialPan, shouldStartCanvasPan, type CanvasPoint } from "./mindmapInteractions.js";
import { MindmapNodeStyleToolbar, type MindmapNodeStyleTarget } from "./MindmapNodeStyleToolbar.js";
import { hasNodeNote, richTextNodeLayoutCss, titleOnlyNodeHtml } from "./richTextNode.js";

MindMap.usePlugin(Drag).usePlugin(Select).usePlugin(Export).usePlugin(RichText);

export type MindmapData = Record<string, unknown>;

export interface MindmapTheme {
  template?: string;
  config?: Record<string, unknown>;
}

export interface MindmapCanvasActions {
  undo(): void;
  redo(): void;
  insertSibling(): void;
  insertChild(): void;
  fitView(): void;
  exportPng(title?: string): void;
}

export interface MindmapCanvasProps {
  data: MindmapData;
  layout: string;
  theme: MindmapTheme | string;
  panSensitivity?: number;
  onChange(data: MindmapData): void;
  onReady?(actions: MindmapCanvasActions): void;
}

export function MindmapCanvas({ data, layout, theme, panSensitivity = 0.4, onChange, onReady }: MindmapCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [activeNode, setActiveNode] = useState<MindmapNodeStyleTarget | null>(null);
  const [richTextSelection, setRichTextSelection] = useState<{ bold?: boolean; italic?: boolean; underline?: boolean; color?: string } | null>(null);
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);
  const panSensitivityRef = useRef(panSensitivity);

  onChangeRef.current = onChange;
  onReadyRef.current = onReady;
  panSensitivityRef.current = panSensitivity;

  useEffect(() => {
    if (!hostRef.current) return;

    const themeConfig = typeof theme === "string" ? undefined : theme.config;
    const mindMap = new MindMap({
      el: hostRef.current,
      data,
      layout,
      theme: typeof theme === "string" ? theme : theme.template,
      themeConfig,
      fit: true,
      isDisableDrag: true,
      enableFreeDrag: false,
      beforeDragEnd: () => false,
    });
    mindMap.appendCss("richTextNodeLayout", richTextNodeLayoutCss);
    mindMap.render();
    (hostRef.current as HTMLDivElement & { __mindMap?: typeof mindMap }).__mindMap = mindMap;
    let panStart: CanvasPoint | null = null;
    let pointerId: number | null = null;
    let panVelocity: CanvasPoint = { x: 0, y: 0 };
    let lastPanTime = 0;
    let inertiaFrame: number | null = null;
    const stopInertia = () => {
      if (inertiaFrame !== null) window.cancelAnimationFrame(inertiaFrame);
      inertiaFrame = null;
    };
    const startInertia = () => {
      const tick = () => {
        const next = nextInertialPan(panVelocity);
        panVelocity = next.velocity;
        if (Math.hypot(panVelocity.x, panVelocity.y) < 0.02) {
          inertiaFrame = null;
          return;
        }
        mindMap.view.translateXY(next.delta.x, next.delta.y);
        inertiaFrame = window.requestAnimationFrame(tick);
      };
      if (Math.hypot(panVelocity.x, panVelocity.y) >= 0.02) inertiaFrame = window.requestAnimationFrame(tick);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!shouldStartCanvasPan(event.button)) return;
      event.preventDefault();
      stopInertia();
      panStart = { x: event.clientX, y: event.clientY };
      pointerId = event.pointerId;
      panVelocity = { x: 0, y: 0 };
      lastPanTime = performance.now();
      hostRef.current?.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!panStart || event.pointerId !== pointerId) return;
      const next = { x: event.clientX, y: event.clientY };
      const delta = applyPanSensitivity(boundedCanvasPanDelta(panStart, next), panSensitivityRef.current);
      mindMap.view.translateXY(delta.x, delta.y);
      const elapsed = Math.max(performance.now() - lastPanTime, 8);
      const instantaneousVelocity = { x: delta.x / elapsed, y: delta.y / elapsed };
      panVelocity = {
        x: Math.max(-1.5, Math.min(1.5, panVelocity.x * 0.7 + instantaneousVelocity.x * 0.3)),
        y: Math.max(-1.5, Math.min(1.5, panVelocity.y * 0.7 + instantaneousVelocity.y * 0.3)),
      };
      lastPanTime = performance.now();
      panStart = next;
    };
    const stopPanning = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      panStart = null;
      pointerId = null;
      startInertia();
    };
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    const resizeObserver = new ResizeObserver(() => mindMap.resize());
    hostRef.current.addEventListener("pointerdown", onPointerDown);
    hostRef.current.addEventListener("pointermove", onPointerMove);
    hostRef.current.addEventListener("pointerup", stopPanning);
    hostRef.current.addEventListener("pointercancel", stopPanning);
    hostRef.current.addEventListener("contextmenu", preventContextMenu);
    resizeObserver.observe(hostRef.current);
    // `getData(true)` wraps the node tree with layout, theme and view config.
    // The controlled `data` prop is the node tree itself, so persisting the
    // configured payload here would corrupt the caller's root node.
    const handleChange = () => onChangeRef.current(mindMap.getData() as MindmapData);
    const handleNodeActive = (node: MindmapNodeStyleTarget | null) => setActiveNode(node);
    const handleRichTextSelection = (hasRange: boolean, _rect: unknown, format: { bold?: boolean; italic?: boolean; underline?: boolean; color?: string } | null) => setRichTextSelection(hasRange ? format : null);
    const handleHideTextEdit = (_editor: unknown, nodes: MindmapNodeStyleTarget[]) => {
      for (const node of nodes) {
        if (node.getData("nodeCardStyle") !== "title-note" || hasNodeNote(node.getData("text"))) continue;
        node.setData({ nodeCardStyle: undefined });
        node.setText(titleOnlyNodeHtml(node.getData("text")), true);
      }
    };

    mindMap.on("data_change", handleChange);
    mindMap.on("layout_change", handleChange);
    mindMap.on("node_active", handleNodeActive);
    mindMap.on("rich_text_selection_change", handleRichTextSelection);
    mindMap.on("hide_text_edit", handleHideTextEdit);
    onReadyRef.current?.({
      undo: () => mindMap.execCommand("BACK"),
      redo: () => mindMap.execCommand("FORWARD"),
      insertSibling: () => mindMap.execCommand("INSERT_NODE"),
      insertChild: () => mindMap.execCommand("INSERT_CHILD_NODE"),
      fitView: () => mindMap.view.fit(),
      exportPng: (title) => mindMap.export?.export("png", true, title),
    });

    return () => {
      resizeObserver.disconnect();
      stopInertia();
      hostRef.current?.removeEventListener("pointerdown", onPointerDown);
      hostRef.current?.removeEventListener("pointermove", onPointerMove);
      hostRef.current?.removeEventListener("pointerup", stopPanning);
      hostRef.current?.removeEventListener("pointercancel", stopPanning);
      hostRef.current?.removeEventListener("contextmenu", preventContextMenu);
      mindMap.off("node_active", handleNodeActive);
      mindMap.off("rich_text_selection_change", handleRichTextSelection);
      mindMap.off("hide_text_edit", handleHideTextEdit);
      mindMap.removeAppendCss("richTextNodeLayout");
      delete (hostRef.current as HTMLDivElement & { __mindMap?: typeof mindMap }).__mindMap;
      mindMap.destroy();
    };
  // Map edits emit `data_change` and update the parent state. Recreating the
  // canvas for that new object destroys and reinitializes the renderer in a
  // loop, which presents as a visible flash. The map owns edits while mounted;
  // a new data tree is applied on the next mount (for example after returning
  // from the outline view).
  }, [layout, theme]);

  const formatSelection = (format: Record<string, unknown>) => {
    const map = (hostRef.current as unknown as { __mindMap?: { richText?: { formatText(style: Record<string, unknown>): void } } })?.__mindMap;
    map?.richText?.formatText(format);
  };
  return <div style={{ position: "relative", width: "100%", height: "100%" }}><div ref={hostRef} style={{ width: "100%", height: "100%" }} />{activeNode && <MindmapNodeStyleToolbar node={activeNode} />}{richTextSelection && <aside className="mindmap-richtext-toolbar" aria-label="选中文字样式"><button type="button" className={richTextSelection.bold ? "is-active" : ""} onClick={() => formatSelection({ bold: !richTextSelection.bold })}>B</button><button type="button" className={richTextSelection.italic ? "is-active" : ""} onClick={() => formatSelection({ italic: !richTextSelection.italic })}>I</button><button type="button" className={richTextSelection.underline ? "is-active" : ""} onClick={() => formatSelection({ underline: !richTextSelection.underline })}>U</button><input aria-label="文字颜色" type="color" value={richTextSelection.color ?? "#f8fafc"} onChange={event => formatSelection({ color: event.target.value })} /></aside>}</div>;
}
