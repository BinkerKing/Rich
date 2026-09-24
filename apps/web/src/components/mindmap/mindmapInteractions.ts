export type CanvasPoint = { x: number; y: number };

export function shouldStartCanvasPan(button: number) {
  return button === 2;
}

export function shouldSuppressNativeCanvasPan(button: number, customPanActive: boolean) {
  return button === 2 || customPanActive;
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

export function panSensitivityFromPercent(percent: number): number {
  return Math.min(100, Math.max(0, percent)) / 100;
}

export function panSensitivityPercent(sensitivity: number): number {
  return Math.round(Math.min(1, Math.max(0, sensitivity)) * 100);
}

export function nextInertialPan(_velocity: CanvasPoint): { delta: CanvasPoint; velocity: CanvasPoint } {
  const nextVelocity = { x: 0, y: 0 };
  return {
    delta: nextVelocity,
    velocity: nextVelocity,
  };
}
