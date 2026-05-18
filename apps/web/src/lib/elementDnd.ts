import { useCallback, useState, type DragEvent } from "react";

const DND_MIME = "application/x-ke-element-id";

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
 * - Calls `onDrop(sourceId)` when an element is dropped.
 * - Provides `isOver` so the caller can highlight the target.
 * - Refuses self-drop.
 */
export function useDropTarget(targetId: string, onDrop: (sourceId: string) => void) {
  const [isOver, setIsOver] = useState(false);
  const dragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
  const dragEnter = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    setIsOver(true);
  }, []);
  const dragLeave = useCallback(() => setIsOver(false), []);
  const drop = useCallback((e: DragEvent) => {
    setIsOver(false);
    const sourceId = e.dataTransfer.getData(DND_MIME);
    if (!sourceId || sourceId === targetId) return;
    e.preventDefault();
    onDrop(sourceId);
  }, [targetId, onDrop]);
  return {
    isOver,
    bind: {
      onDragOver: dragOver,
      onDragEnter: dragEnter,
      onDragLeave: dragLeave,
      onDrop: drop,
    },
  };
}
