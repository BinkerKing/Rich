import { describe, expect, it } from "vitest";
import { clampNodeStyleToolbarPosition, parseNodeStyleToolbarPosition } from "./nodeStyleToolbarPosition.js";

describe("node style toolbar position", () => {
  it("keeps a dragged editor inside the mind-map canvas", () => {
    expect(clampNodeStyleToolbarPosition({ x: 920, y: -12 }, { width: 800, height: 600 }, { width: 230, height: 46 })).toEqual({ x: 570, y: 0 });
  });

  it("restores only complete saved positions", () => {
    expect(parseNodeStyleToolbarPosition('{"x":120,"y":80}')).toEqual({ x: 120, y: 80 });
    expect(parseNodeStyleToolbarPosition('{"x":"120","y":80}')).toBeNull();
  });
});
