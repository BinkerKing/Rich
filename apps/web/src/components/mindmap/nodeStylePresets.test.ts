import { describe, expect, it } from "vitest";
import type { NodeStyle } from "./nodeStyleControls.js";
import { createNodeStylePreset, parseNodeStylePresets, saveNodeStylePreset } from "./nodeStylePresets.js";

const style: NodeStyle = {
  color: "#f8fafc",
  fillColor: "#18212c",
  borderColor: "#38bdf8",
  borderWidth: 2,
  borderRadius: 16,
  fontSize: 18,
  fontWeight: "bold",
};

describe("node style presets", () => {
  it("creates a named reusable snapshot of the complete node appearance", () => {
    expect(createNodeStylePreset("重点节点", style)).toEqual({ id: "重点节点", name: "重点节点", style });
  });

  it("keeps only valid named presets when reading local storage", () => {
    expect(parseNodeStylePresets(JSON.stringify([
      { id: "重点", name: "重点", style },
      { id: "broken", name: "", style: {} },
    ]))).toEqual([{ id: "重点", name: "重点", style }]);
  });

  it("replaces an existing preset with the same name instead of duplicating it", () => {
    const updated = { ...style, fillColor: "#0f172a" };
    expect(saveNodeStylePreset([createNodeStylePreset("重点节点", style)], "重点节点", updated)).toEqual([
      createNodeStylePreset("重点节点", updated),
    ]);
  });
});
