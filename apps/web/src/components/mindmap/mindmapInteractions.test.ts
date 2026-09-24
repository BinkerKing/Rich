import { describe, expect, it } from "vitest";
import { applyPanSensitivity, boundedCanvasPanDelta, canvasPanDelta, nextInertialPan, panSensitivityFromPercent, panSensitivityPercent, shouldStartCanvasPan, shouldSuppressNativeCanvasPan } from "./mindmapInteractions.js";

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

  it("maps the 0–100 drag control to a clamped sensitivity", () => {
    expect(panSensitivityFromPercent(0)).toBe(0);
    expect(panSensitivityFromPercent(40)).toBe(0.4);
    expect(panSensitivityFromPercent(100)).toBe(1);
    expect(panSensitivityFromPercent(130)).toBe(1);
    expect(panSensitivityPercent(-0.2)).toBe(0);
    expect(panSensitivityPercent(0.65)).toBe(65);
  });

  it("suppresses the mind-map library's native pan while custom panning is active", () => {
    expect(shouldSuppressNativeCanvasPan(2, false)).toBe(true);
    expect(shouldSuppressNativeCanvasPan(0, true)).toBe(true);
    expect(shouldSuppressNativeCanvasPan(0, false)).toBe(false);
  });

  it("stops immediately on release so a quick right-drag cannot fling the canvas", () => {
    expect(nextInertialPan({ x: 1, y: -0.5 })).toEqual({
      delta: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    });
  });
});
