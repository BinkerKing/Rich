import { describe, expect, it } from "vitest";
import { nodeColorPresets, noteButtonState, styleMenuOptions } from "./nodeStyleToolbarMenu.js";

describe("node style toolbar menus", () => {
  it("offers typography and border choices from the compact toolbar", () => {
    expect(styleMenuOptions("fontSize")).toEqual([14, 16, 18, 22, 26]);
    expect(styleMenuOptions("borderWidth")).toEqual([0, 1, 2, 3]);
    expect(styleMenuOptions("borderRadius")).toEqual([0, 8, 16, 28, 48]);
  });

  it("keeps an existing note safe from one-click removal", () => {
    expect(noteButtonState(false)).toEqual({ disabled: false, label: "增加备注" });
    expect(noteButtonState(true)).toEqual({ disabled: true, label: "删除备注内容即可关闭" });
  });

  it("offers readable text and background color swatches before the custom picker", () => {
    expect(nodeColorPresets("color")).toEqual(["#f8fafc", "#f87171", "#fbbf24", "#a3e635", "#38bdf8", "#a78bfa"]);
    expect(nodeColorPresets("fillColor")).toEqual(["#1f2937", "#7f1d1d", "#78350f", "#365314", "#164e63", "#4c1d95"]);
  });
});
