export type NodeStyleToolbarPosition = { x: number; y: number };

type Size = { width: number; height: number };

export function clampNodeStyleToolbarPosition(position: NodeStyleToolbarPosition, canvas: Size, toolbar: Size): NodeStyleToolbarPosition {
  return {
    x: Math.max(0, Math.min(position.x, Math.max(0, canvas.width - toolbar.width))),
    y: Math.max(0, Math.min(position.y, Math.max(0, canvas.height - toolbar.height))),
  };
}

export function parseNodeStyleToolbarPosition(value: string | null): NodeStyleToolbarPosition | null {
  try {
    const parsed = JSON.parse(value ?? "") as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const { x, y } = parsed as Record<string, unknown>;
    return typeof x === "number" && typeof y === "number" ? { x, y } : null;
  } catch {
    return null;
  }
}
