import { useCallback, useState, type DragEvent } from "react";

const DND_MIME = "application/x-ke-element-id";

export type DropSide = "before" | "after" | "on";

/** Source side: makes a node draggable. Returns props to spread on the element. */
export function elementDragProps(elementId: string) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(DND_MIME, elementId);
      e.dataTransfer.setData("text/plain", elementId);
      e.dataTransfer.effectAllowed = "move";
    },
  };
}

/**
 * Target side: makes a node a drop target.
 * - Calls `onDrop(sourceId, side)` when an element is dropped.
 *   `side` reports whether the cursor was over the LEFT third ("before"),
 *   RIGHT third ("after"), or middle ("on") at the time of the drop.
 *   Callers wanting plain "drop onto" behavior can ignore `side`.
 * - Provides `isOver` + `side` so callers can render a drop indicator
 *   (e.g. a vertical bar before / after the target card).
 * - Refuses self-drop.
 */
export function useDropTarget(
  targetId: string,
  onDrop: (sourceId: string, side: DropSide) => void,
) {
  const [isOver, setIsOver] = useState(false);
  const [side, setSide] = useState<DropSide>("on");

  const computeSide = useCallback((e: DragEvent): DropSide => {
    const target = e.currentTarget as HTMLElement | null;
    if (!target) return "on";
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    if (w <= 0) return "on";
    if (x < w * 0.33) return "before";
    if (x > w * 0.67) return "after";
    return "on";
  }, []);

  const dragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const next = computeSide(e);
    setSide(prev => (prev === next ? prev : next));
  }, [computeSide]);
  const dragEnter = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    setIsOver(true);
    setSide(computeSide(e));
  }, [computeSide]);
  const dragLeave = useCallback(() => { setIsOver(false); setSide("on"); }, []);
  const drop = useCallback((e: DragEvent) => {
    const finalSide = computeSide(e);
    setIsOver(false);
    setSide("on");
    const sourceId = e.dataTransfer.getData(DND_MIME);
    if (!sourceId || sourceId === targetId) return;
    e.preventDefault();
    onDrop(sourceId, finalSide);
  }, [targetId, onDrop, computeSide]);

  return {
    isOver,
    side,
    bind: {
      onDragOver: dragOver,
      onDragEnter: dragEnter,
      onDragLeave: dragLeave,
      onDrop: drop,
    },
  };
}
