export type CanvasPoint = { x: number; y: number };

export function shouldStartCanvasPan(button: number) {
  return button === 2;
}

export function canvasPanDelta(previous: CanvasPoint, next: CanvasPoint): CanvasPoint {
  return { x: next.x - previous.x, y: next.y - previous.y };
}

export function boundedCanvasPanDelta(previous: CanvasPoint, next: CanvasPoint, maximum = 40): CanvasPoint {
  const delta = canvasPanDelta(previous, next);
  const distance = Math.hypot(delta.x, delta.y);
  if (distance <= maximum) return delta;
  const ratio = maximum / distance;
  return { x: delta.x * ratio, y: delta.y * ratio };
}

export function applyPanSensitivity(delta: CanvasPoint, sensitivity: number): CanvasPoint {
  return { x: delta.x * sensitivity, y: delta.y * sensitivity };
}

export function nextInertialPan(velocity: CanvasPoint): { delta: CanvasPoint; velocity: CanvasPoint } {
  const nextVelocity = { x: velocity.x * 0.85, y: velocity.y * 0.85 };
  return {
    delta: { x: nextVelocity.x * 16, y: nextVelocity.y * 16 },
    velocity: nextVelocity,
  };
}
