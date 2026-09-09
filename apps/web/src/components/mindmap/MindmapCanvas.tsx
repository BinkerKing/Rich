import { useEffect, useRef } from "react";
import MindMap from "simple-mind-map";
import Drag from "simple-mind-map/src/plugins/Drag.js";
import Select from "simple-mind-map/src/plugins/Select.js";
import Export from "simple-mind-map/src/plugins/Export.js";

MindMap.usePlugin(Drag).usePlugin(Select).usePlugin(Export);

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
      enableFreeDrag: false,
      beforeDragEnd: () => false,
    });
    const handleChange = () => onChangeRef.current(mindMap.getData(true) as MindmapData);

    mindMap.on("data_change", handleChange);
    mindMap.on("layout_change", handleChange);
    onReadyRef.current?.({
      undo: () => mindMap.execCommand("BACK"),
      redo: () => mindMap.execCommand("FORWARD"),
      insertSibling: () => mindMap.execCommand("INSERT_NODE"),
      insertChild: () => mindMap.execCommand("INSERT_CHILD_NODE"),
      exportPng: (title) => mindMap.export?.export("png", true, title),
    });

    return () => mindMap.destroy();
  }, [data, layout, theme]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}
