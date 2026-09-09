import { describe, expect, it } from "vitest";
import { styleMenuOptions } from "./nodeStyleToolbarMenu.js";

describe("node style toolbar menus", () => {
  it("offers typography and border choices from the compact toolbar", () => {
    expect(styleMenuOptions("fontSize")).toEqual([14, 16, 18, 22, 26]);
    expect(styleMenuOptions("borderWidth")).toEqual([0, 1, 2, 3]);
    expect(styleMenuOptions("borderRadius")).toEqual([0, 8, 16, 28, 48]);
  });
});
