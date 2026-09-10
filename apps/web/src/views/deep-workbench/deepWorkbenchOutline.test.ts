import assert from "node:assert/strict";
import test from "node:test";
import { indentOutlineNode, insertOutlineChild, insertOutlineSibling, outdentOutlineNode, setOutlineExpanded, updateOutlineText } from "./deepWorkbenchOutline.js";
import type { DeepWorkbenchNode } from "./deepWorkbenchModel.js";

const tree = (): DeepWorkbenchNode => ({
  data: { uid: "root", text: "主题" },
  children: [
    { data: { uid: "a", text: "第一项" }, children: [] },
    { data: { uid: "b", text: "第二项" }, children: [] },
  ],
});

test("indenting an outline item makes it a child of its previous sibling", () => {
  const next = indentOutlineNode(tree(), "b");
  assert.deepEqual(next.children.map(node => node.data.uid), ["a"]);
  assert.deepEqual(next.children[0].children.map(node => node.data.uid), ["b"]);
});

test("outdenting an outline item moves it after its parent", () => {
  const next = outdentOutlineNode({
    data: { uid: "root", text: "主题" },
    children: [{ data: { uid: "a", text: "第一项" }, children: [{ data: { uid: "b", text: "第二项" }, children: [] }] }],
  }, "b");
  assert.deepEqual(next.children.map(node => node.data.uid), ["a", "b"]);
  assert.equal(next.children[0].children.length, 0);
});

test("pressing Enter can insert a sibling directly after the current outline item", () => {
  const next = insertOutlineSibling(tree(), "a", "new");
  assert.deepEqual(next.children.map(node => node.data.uid), ["a", "new", "b"]);
  assert.equal(next.children[1].data.text, "");
});

test("editing an outline title updates the matching node only", () => {
  const next = updateOutlineText(tree(), "b", "结论");
  assert.equal(next.children[0].data.text, "第一项");
  assert.equal(next.children[1].data.text, "结论");
});

test("the root can create its first outline child", () => {
  const next = insertOutlineChild(tree(), "root", "new");
  assert.deepEqual(next.children.map(node => node.data.uid), ["a", "b", "new"]);
});

test("collapsing an outline node keeps its children and stores the collapsed state", () => {
  const next = setOutlineExpanded(tree(), "a", false);
  assert.equal(next.children[0].data.expand, false);
  assert.equal(next.children[0].children.length, 0);
});
