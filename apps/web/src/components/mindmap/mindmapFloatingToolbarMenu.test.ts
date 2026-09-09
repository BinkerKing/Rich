import { describe, expect, it } from "vitest";
import { menuAfterPointerDown } from "./mindmapFloatingToolbarMenu.js";

describe("floating toolbar menu dismissal", () => {
  it("closes an open menu when the pointer lands outside the toolbar", () => {
    expect(menuAfterPointerDown("line", false)).toBeNull();
  });

  it("keeps the menu open for a pointer event inside the toolbar", () => {
    expect(menuAfterPointerDown("line", true)).toBe("line");
  });
});
