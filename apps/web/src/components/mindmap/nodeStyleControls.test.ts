import { describe, expect, it } from "vitest";
import { nodeStyleFromData } from "./nodeStyleControls.js";

describe("node style controls", () => {
  it("reads a node's saved overrides while retaining the editing defaults", () => {
    expect(nodeStyleFromData({ color: "#f8fafc", fontWeight: "bold", borderWidth: 2 })).toEqual({
      color: "#f8fafc",
      fillColor: "#18212c",
      borderColor: "#38bdf8",
      borderWidth: 2,
      borderRadius: 12,
      fontSize: 16,
      fontWeight: "bold",
    });
  });
});
