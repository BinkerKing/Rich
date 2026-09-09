import { describe, expect, it } from "vitest";
import { applyPanSensitivity, boundedCanvasPanDelta, canvasPanDelta, nextInertialPan, shouldStartCanvasPan } from "./mindmapInteractions.js";

describe("mind-map canvas interactions", () => {
  it("starts canvas panning only from the right mouse button", () => {
    expect(shouldStartCanvasPan(0)).toBe(false);
    expect(shouldStartCanvasPan(2)).toBe(true);
  });

  it("uses the pointer displacement as the view translation", () => {
    expect(canvasPanDelta({ x: 120, y: 80 }, { x: 156, y: 104 })).toEqual({ x: 36, y: 24 });
  });

  it("bounds an unusually large pointer jump so panning does not suddenly accelerate", () => {
    expect(boundedCanvasPanDelta({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ x: 40, y: 0 });
  });

  it("scales panning by the selected sensitivity without changing its direction", () => {
    expect(applyPanSensitivity({ x: 40, y: -20 }, 0.4)).toEqual({ x: 16, y: -8 });
  });

  it("turns the final drag velocity into a short decaying inertial movement", () => {
    expect(nextInertialPan({ x: 1, y: -0.5 })).toEqual({
      delta: { x: 13.6, y: -6.8 },
      velocity: { x: 0.85, y: -0.425 },
    });
  });
});
