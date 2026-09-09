import assert from "node:assert/strict";
import { test } from "node:test";
import { fromOutlineNode, toOutlineNode } from "./deepWorkbenchOutlineAdapter.ts";
import type { DeepWorkbenchNode } from "./deepWorkbenchModel.ts";

test("round trips deep workbench nodes through outline nodes without changing ordered tree data", () => {
  const root: DeepWorkbenchNode = {
    data: { uid: "root", text: "Root", expand: true },
    children: [
      {
        data: { uid: "first", text: "First", expand: false },
        children: [
          { data: { uid: "nested", text: "Nested" }, children: [] },
        ],
      },
      { data: { uid: "second", text: "Second", expand: true }, children: [] },
    ],
  };

  const outline = toOutlineNode(root);

  assert.deepEqual(outline, {
    id: "root",
    text: "Root",
    expanded: true,
    children: [
      {
        id: "first",
        text: "First",
        expanded: false,
        children: [{ id: "nested", text: "Nested", children: [] }],
      },
      { id: "second", text: "Second", expanded: true, children: [] },
    ],
  });
  assert.deepEqual(fromOutlineNode(outline), root);
});
