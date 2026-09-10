import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { clampNodeStyleToolbarPosition, parseNodeStyleToolbarPosition, type NodeStyleToolbarPosition } from "../../../components/mindmap/nodeStyleToolbarPosition.js";

export const SELECTION_TOOLBAR_POSITION_STORAGE_KEY = "rich.flowchart.selection-toolbar.position.v1";
export type FlowchartToolbarIconName = "drag" | "text" | "bold" | "icon" | "kind" | "color" | "fill" | "border" | "preset" | "label" | "route" | "stroke" | "arrow" | "motion" | "delete";

export function FlowchartToolbarIcon({ name }: { name: FlowchartToolbarIconName }) {
  const paths: Record<FlowchartToolbarIconName, ReactNode> = {
    drag: <><circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/></>,
    text: <><path d="M5 5h14M12 5v14M8 19h8"/></>,
    bold: <path d="M8 5h5a3 3 0 0 1 0 6H8zm0 6h6a3 3 0 0 1 0 6H8z"/>,
    icon: <><circle cx="12" cy="12" r="7"/><circle cx="9.5" cy="10" r=".7" fill="currentColor"/><circle cx="14.5" cy="10" r=".7" fill="currentColor"/><path d="M9 14c1.5 1.3 4.5 1.3 6 0"/></>,
    kind: <><path d="m12 3 9 9-9 9-9-9z"/><path d="M3 12h18"/></>,
    color: <><path d="m8 17 4-11 4 11M9.5 13h5"/><path d="M5 20h14"/></>,
    fill: <><path d="m7 4 10 10-5 5L2 9z"/><path d="M16 18h5"/></>,
    border: <><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 12h6"/></>,
    preset: <><path d="M6 4h12v16H6z"/><path d="m9 8 3-2 3 2v4l-3 2-3-2z"/><path d="M9 17h6"/></>,
    label: <><path d="M5 5h14v10H9l-4 4z"/><path d="M8 9h8M8 12h5"/></>,
    route: <><path d="M4 6h7v12h9"/><path d="m17 14 3 4-4 2"/></>,
    stroke: <><path d="M5 7h14M5 12h14M5 17h14"/><path d="M8 5v4M14 10v4M18 15v4"/></>,
    arrow: <><path d="M4 12h14"/><path d="m13 7 5 5-5 5"/></>,
    motion: <><path d="M4 8c3-4 6 4 10 0s5-4 6-2"/><path d="M4 16c3-4 6 4 10 0s5-4 6-2"/></>,
    delete: <><path d="M5 7h14M10 11v6M14 11v6M8 7l1 13h6l1-13M9 7l1-3h4l1 3"/></>,
  };
  return <svg aria-hidden="true" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function FlowchartFloatingToolbar({ ariaLabel, className = "", children }: { ariaLabel: string; className?: string; children: ReactNode }) {
  const [position, setPosition] = useState<NodeStyleToolbarPosition | null>(() => parseNodeStyleToolbarPosition(localStorage.getItem(SELECTION_TOOLBAR_POSITION_STORAGE_KEY)));
  const toolbarRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const toolbar = toolbarRef.current;
      const canvas = toolbar?.parentElement;
      const drag = dragRef.current;
      if (!toolbar || !canvas || !drag) return;
      const canvasRect = canvas.getBoundingClientRect();
      setPosition(clampNodeStyleToolbarPosition({ x: event.clientX - canvasRect.left - drag.offsetX, y: event.clientY - canvasRect.top - drag.offsetY }, canvasRect, toolbar.getBoundingClientRect()));
    };
    const stop = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setPosition(current => { if (current) localStorage.setItem(SELECTION_TOOLBAR_POSITION_STORAGE_KEY, JSON.stringify(current)); return current; });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
  }, []);
  useEffect(() => {
    const toolbar = toolbarRef.current;
    const canvas = toolbar?.parentElement;
    if (!toolbar || !canvas || !position) return;
    const keepVisible = () => {
      const next = clampNodeStyleToolbarPosition(position, canvas.getBoundingClientRect(), toolbar.getBoundingClientRect());
      if (next.x !== position.x || next.y !== position.y) { localStorage.setItem(SELECTION_TOOLBAR_POSITION_STORAGE_KEY, JSON.stringify(next)); setPosition(next); }
    };
    keepVisible(); const observer = new ResizeObserver(keepVisible); observer.observe(canvas);
    return () => observer.disconnect();
  }, [position]);
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const toolbar = toolbarRef.current;
    const canvas = toolbar?.parentElement;
    if (!toolbar || !canvas) return;
    const rect = toolbar.getBoundingClientRect();
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPosition({ x: rect.left - canvas.getBoundingClientRect().left, y: rect.top - canvas.getBoundingClientRect().top });
  };

  return <aside ref={toolbarRef} className={`pfc-node-style-toolbar ${className}`} aria-label={ariaLabel} style={position ? { left: position.x, top: position.y, bottom: "auto", transform: "none" } : undefined}>
    <button className="pfc-node-style-toolbar__drag" type="button" title="拖动编辑器" aria-label="拖动编辑器" onPointerDown={startDrag}><FlowchartToolbarIcon name="drag" /></button>
    {children}
  </aside>;
}
