import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { clampNodeStyleToolbarPosition, parseNodeStyleToolbarPosition, type NodeStyleToolbarPosition } from "../../../components/mindmap/nodeStyleToolbarPosition.js";

export const SELECTION_TOOLBAR_POSITION_STORAGE_KEY = "rich.flowchart.selection-toolbar.position.v1";

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
    <button className="pfc-node-style-toolbar__drag" type="button" title="拖动编辑器" aria-label="拖动编辑器" onPointerDown={startDrag}>⠿</button>
    {children}
  </aside>;
}
