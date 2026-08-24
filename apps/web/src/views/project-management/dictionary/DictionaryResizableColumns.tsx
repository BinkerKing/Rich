import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";

export type DictionaryResizableColumn = { id: string; label: string; width: number; minWidth?: number };

function dictionaryColumnWidthsKey(storageKey: string) {
  return `rich-project-dictionary-column-widths:${storageKey}`;
}

export function loadDictionaryColumnWidths(storageKey: string, defaults: Record<string, number>): Record<string, number> {
  if (typeof window === "undefined") return defaults;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dictionaryColumnWidthsKey(storageKey)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
    const next = { ...defaults };
    Object.entries(parsed).forEach(([columnId, value]) => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0 && columnId in defaults) {
        next[columnId] = Math.round(value);
      }
    });
    return next;
  } catch {
    return defaults;
  }
}

export function saveDictionaryColumnWidths(storageKey: string, widths: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dictionaryColumnWidthsKey(storageKey), JSON.stringify(widths));
  } catch {
    // Column widths are a local UI preference; failing to persist them is safe.
  }
}

export function useDictionaryResizableColumns(
  storageKey: string,
  columns: DictionaryResizableColumn[],
  load: (storageKey: string, defaults: Record<string, number>) => Record<string, number>,
  save: (storageKey: string, widths: Record<string, number>) => void,
) {
  const defaultWidths = useMemo(() => Object.fromEntries(columns.map(column => [column.id, column.width])), [columns]);
  const minWidths = useMemo(() => Object.fromEntries(columns.map(column => [column.id, column.minWidth ?? 48])), [columns]);
  const [widths, setWidths] = useState<Record<string, number>>(() => load(storageKey, defaultWidths));
  useEffect(() => { setWidths(load(storageKey, defaultWidths)); }, [defaultWidths, load, storageKey]);
  const startResize = (event: ReactPointerEvent<HTMLElement>, columnId: string) => {
    event.preventDefault(); event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widths[columnId] ?? defaultWidths[columnId] ?? 120;
    const minWidth = minWidths[columnId] ?? 48;
    const nextWidth = (clientX: number) => Math.max(minWidth, Math.round(startWidth + clientX - startX));
    const onMove = (moveEvent: PointerEvent) => setWidths(current => ({ ...current, [columnId]: nextWidth(moveEvent.clientX) }));
    const onUp = (upEvent: PointerEvent) => {
      setWidths(current => { const next = { ...current, [columnId]: nextWidth(upEvent.clientX) }; save(storageKey, next); return next; });
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp);
  };
  const columnWidth = (columnId: string) => widths[columnId] ?? defaultWidths[columnId] ?? 120;
  return { columnWidth, startResize, totalWidth: columns.reduce((sum, column) => sum + columnWidth(column.id), 0) };
}

export function DictionaryResizableHeadCell({ column, onResizeStart }: { column: DictionaryResizableColumn; onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>, columnId: string) => void }) {
  return <span className="prj-pm-dict-resizable-head-cell">{column.label}<button type="button" className="prj-pm-dict-column-resizer" aria-label={`调整${column.label || "序号"}列宽`} title="拖拽调整列宽" onClick={event => event.stopPropagation()} onPointerDown={event => onResizeStart(event, column.id)} /></span>;
}
