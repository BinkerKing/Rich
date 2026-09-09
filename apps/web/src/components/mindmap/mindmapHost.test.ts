import { describe, expect, it } from "vitest";
import { clearMindmapHost } from "./mindmapHost.js";

describe("mind-map host cleanup", () => {
  it("does not throw when React has already cleared the host ref during unmount", () => {
    expect(() => clearMindmapHost(null)).not.toThrow();
  });
});
