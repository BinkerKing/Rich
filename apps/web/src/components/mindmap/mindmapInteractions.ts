export type CanvasPoint = { x: number; y: number };

export function shouldStartCanvasPan(button: number) {
  return button === 2;
}

export function canvasPanDelta(previous: CanvasPoint, next: CanvasPoint): CanvasPoint {
  return { x: next.x - previous.x, y: next.y - previous.y };
}
