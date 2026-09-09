import { useEffect, useRef, useState } from "react";
import MindMap from "simple-mind-map";
import Drag from "simple-mind-map/src/plugins/Drag.js";
import Select from "simple-mind-map/src/plugins/Select.js";
import Export from "simple-mind-map/src/plugins/Export.js";
import RichText from "simple-mind-map/src/plugins/RichText.js";
import { canvasPanDelta, shouldStartCanvasPan, type CanvasPoint } from "./mindmapInteractions.js";
import { MindmapNodeStyleToolbar, type MindmapNodeStyleTarget } from "./MindmapNodeStyleToolbar.js";

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
  onChange(data: MindmapData): void;
  onReady?(actions: MindmapCanvasActions): void;
}

export function MindmapCanvas({ data, layout, theme, onChange, onReady }: MindmapCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [activeNode, setActiveNode] = useState<MindmapNodeStyleTarget | null>(null);
  const [richTextSelection, setRichTextSelection] = useState<{ bold?: boolean; italic?: boolean; underline?: boolean; color?: string } | null>(null);
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);

  onChangeRef.current = onChange;
  onReadyRef.current = onReady;

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
    (hostRef.current as HTMLDivElement & { __mindMap?: typeof mindMap }).__mindMap = mindMap;
    let panStart: CanvasPoint | null = null;
    let pointerId: number | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (!shouldStartCanvasPan(event.button)) return;
      event.preventDefault();
      panStart = { x: event.clientX, y: event.clientY };
      pointerId = event.pointerId;
      hostRef.current?.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!panStart || event.pointerId !== pointerId) return;
      const next = { x: event.clientX, y: event.clientY };
      const delta = canvasPanDelta(panStart, next);
      mindMap.view.translateXY(delta.x, delta.y);
      panStart = next;
    };
    const stopPanning = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      panStart = null;
      pointerId = null;
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

    mindMap.on("data_change", handleChange);
    mindMap.on("layout_change", handleChange);
    mindMap.on("node_active", handleNodeActive);
    mindMap.on("rich_text_selection_change", handleRichTextSelection);
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
      hostRef.current?.removeEventListener("pointerdown", onPointerDown);
      hostRef.current?.removeEventListener("pointermove", onPointerMove);
      hostRef.current?.removeEventListener("pointerup", stopPanning);
      hostRef.current?.removeEventListener("pointercancel", stopPanning);
      hostRef.current?.removeEventListener("contextmenu", preventContextMenu);
      mindMap.off("node_active", handleNodeActive);
      mindMap.off("rich_text_selection_change", handleRichTextSelection);
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
