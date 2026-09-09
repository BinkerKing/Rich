import { describe, expect, it } from "vitest";
import { applyNodeStyle, nextShiftSelection, selectionOptions } from "./mindmapMultiSelection.js";

type Node = { id: string };
const idOf = (node: Node) => node.id;

describe("mind-map multi selection", () => {
  it("uses left drag for range selection while preserving right-drag canvas movement", () => {
    expect(selectionOptions).toEqual({ useLeftKeySelectionRightKeyDrag: true, enableCtrlKeyNodeSelection: true });
  });

  it("adds and removes a node from the Shift selection", () => {
    const first = { id: "first" };
    const second = { id: "second" };
    expect(nextShiftSelection([first], second, idOf)).toEqual([first, second]);
    expect(nextShiftSelection([first, second], second, idOf)).toEqual([first]);
  });

  it("applies a style change to every selected node", () => {
    const updates: unknown[] = [];
    applyNodeStyle([{ setStyles: (style: unknown) => updates.push(style) }, { setStyles: (style: unknown) => updates.push(style) }], { fontWeight: "bold" });
    expect(updates).toEqual([{ fontWeight: "bold" }, { fontWeight: "bold" }]);
  });
});
