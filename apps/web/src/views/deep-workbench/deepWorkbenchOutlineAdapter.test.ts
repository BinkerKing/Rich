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
    data: { uid: "root", text: "Root", expand: true },
    expanded: true,
    children: [
      {
        id: "first",
        text: "First",
        data: { uid: "first", text: "First", expand: false },
        expanded: false,
        children: [{ id: "nested", text: "Nested", data: { uid: "nested", text: "Nested" }, children: [] }],
      },
      { id: "second", text: "Second", data: { uid: "second", text: "Second", expand: true }, expanded: true, children: [] },
    ],
  });
  assert.deepEqual(fromOutlineNode(outline), root);
});

test("keeps rich text and visual node data for the outline view", () => {
  const root: DeepWorkbenchNode = {
    data: {
      uid: "root",
      text: '<p class="mindmap-node-title"><strong>标题</strong></p><div class="mindmap-node-note"><p>备注</p></div>',
      fillColor: "#123c5a",
      borderColor: "#38bdf8",
      fontSize: 18,
      nodeCardStyle: "title-note",
    },
    children: [],
  };

  const outline = toOutlineNode(root);

  assert.deepEqual(outline.data, root.data);
  assert.deepEqual(fromOutlineNode(outline), root);
});
