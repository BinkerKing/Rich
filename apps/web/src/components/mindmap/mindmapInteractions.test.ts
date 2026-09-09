import { describe, expect, it } from "vitest";
import { canvasPanDelta, shouldStartCanvasPan } from "./mindmapInteractions.js";

describe("mind-map canvas interactions", () => {
  it("starts canvas panning only from the right mouse button", () => {
    expect(shouldStartCanvasPan(0)).toBe(false);
    expect(shouldStartCanvasPan(2)).toBe(true);
  });

  it("uses the pointer displacement as the view translation", () => {
    expect(canvasPanDelta({ x: 120, y: 80 }, { x: 156, y: 104 })).toEqual({ x: 36, y: 24 });
  });
});
