import { describe, it, expect } from "vitest";
import { selectCenterView } from "../src/logic/tree.js";
import type { Element, Relation } from "../src/index.js";

const e = (id: string): Element => ({
  id, type: "concept", title: id,
  content: {},
  metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
});

const r = (from: string, to: string, kind: "child" | "parent" = "child"): Relation => ({
  id: `${from}-${to}`, from, to, kind, createdAt: "",
});

describe("selectCenterView", () => {
  it("returns center, its children, and grandchildren within 2 layers down", () => {
    const elements = new Map([
      ["root", e("root")], ["a", e("a")], ["b", e("b")],
      ["a1", e("a1")], ["a2", e("a2")], ["b1", e("b1")],
      ["a1x", e("a1x")],
    ]);
    const relations = [
      r("root", "a"), r("root", "b"),
      r("a", "a1"), r("a", "a2"), r("b", "b1"),
      r("a1", "a1x"),
    ];
    const view = selectCenterView({ centerId: "root", elements, relations, depthDown: 2 });
    expect(view.center.id).toBe("root");
    expect(view.children.map(c => c.id).sort()).toEqual(["a", "b"]);
    expect(view.grandchildren["a"].map(c => c.id).sort()).toEqual(["a1", "a2"]);
    expect(view.grandchildren["b"].map(c => c.id)).toEqual(["b1"]);
    expect(view.grandchildren["a1"]).toBeUndefined(); // depth 2 cutoff
  });

  it("returns up to N upstream ancestors", () => {
    const elements = new Map([
      ["gp", e("gp")], ["p", e("p")], ["c", e("c")],
    ]);
    const relations = [r("gp", "p"), r("p", "c")];
    const view = selectCenterView({ centerId: "c", elements, relations, depthUp: 2 });
    expect(view.upstream.map(u => u.id)).toEqual(["p", "gp"]);
  });

  it("returns siblings (other children of the same parent)", () => {
    const elements = new Map([
      ["p", e("p")], ["c1", e("c1")], ["c2", e("c2")], ["c3", e("c3")],
    ]);
    const relations = [r("p", "c1"), r("p", "c2"), r("p", "c3")];
    const view = selectCenterView({ centerId: "c2", elements, relations });
    expect(view.siblings.map(s => s.id).sort()).toEqual(["c1", "c3"]);
  });
});
