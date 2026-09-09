import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendChild,
  expandAll,
  indentNode,
  insertSiblingAfter,
  outdentNode,
  removeEmptyNode,
  updateNodeText,
} from "./outlineTreeOps.ts";
import type { OutlineNode } from "./types.ts";

const tree = (): OutlineNode => ({
  id: "root",
  text: "Root",
  children: [
    { id: "a", text: "A", children: [] },
    { id: "b", text: "", children: [{ id: "b1", text: "B1", children: [] }] },
  ],
});

const ids = (...values: string[]) => {
  let index = 0;
  return () => values[index++]!;
};

test("insertSiblingAfter adds an empty sibling immediately after a node without changing input", () => {
  const root = tree();
  const result = insertSiblingAfter(root, "a", ids("new"));

  assert.deepEqual(result.children.map(({ id }) => id), ["a", "new", "b"]);
  assert.deepEqual(result.children[1], { id: "new", text: "", children: [] });
  assert.deepEqual(root.children.map(({ id }) => id), ["a", "b"]);
});

test("appendChild adds an empty child and expands its parent", () => {
  const root = tree();
  const result = appendChild(root, "a", ids("new"));

  assert.deepEqual(result.children[0], {
    id: "a",
    text: "A",
    expanded: true,
    children: [{ id: "new", text: "", children: [] }],
  });
  assert.notStrictEqual(result, root);
  assert.deepEqual(root, tree());
});

test("indentNode nests a node under its previous sibling", () => {
  const root = tree();
  const result = indentNode(root, "b");

  assert.deepEqual(result.children.map(({ id }) => id), ["a"]);
  assert.deepEqual(result.children[0]?.children.map(({ id }) => id), ["b"]);
  assert.equal(result.children[0]?.expanded, true);
  assert.notStrictEqual(result, root);
  assert.deepEqual(root, tree());
});

test("indentNode leaves a first sibling and the root unchanged", () => {
  const root = tree();
  assert.deepEqual(indentNode(root, "a"), root);
  assert.deepEqual(indentNode(root, "root"), root);
});

test("outdentNode moves a nested node after its parent", () => {
  const root: OutlineNode = {
    id: "root",
    text: "Root",
    children: [{ id: "a", text: "A", children: [{ id: "b", text: "B", children: [] }] }],
  };
  const result = outdentNode(root, "b");

  assert.deepEqual(result.children.map(({ id }) => id), ["a", "b"]);
  assert.deepEqual(result.children[0]?.children, []);
  assert.notStrictEqual(result, root);
  assert.deepEqual(root, {
    id: "root",
    text: "Root",
    children: [{ id: "a", text: "A", children: [{ id: "b", text: "B", children: [] }] }],
  });
});

test("outdentNode leaves top-level nodes and the root unchanged", () => {
  const root = tree();
  assert.deepEqual(outdentNode(root, "a"), root);
  assert.deepEqual(outdentNode(root, "root"), root);
});

test("removeEmptyNode removes a blank non-root node and promotes children at its index", () => {
  const root = tree();
  const result = removeEmptyNode(root, "b");

  assert.deepEqual(result.children.map(({ id }) => id), ["a", "b1"]);
  assert.notStrictEqual(result, root);
  assert.deepEqual(root, tree());
});

test("removeEmptyNode preserves non-empty nodes and the root", () => {
  const root = tree();
  assert.deepEqual(removeEmptyNode(root, "a"), root);
  assert.deepEqual(removeEmptyNode(root, "root"), root);
});

test("updateNodeText changes only the matching node", () => {
  const root = tree();
  const result = updateNodeText(root, "b1", "Edited");

  assert.equal(result.children[1]?.children[0]?.text, "Edited");
  assert.equal(root.children[1]?.children[0]?.text, "B1");
});

test("expandAll sets every node expansion state", () => {
  const root = tree();
  const result = expandAll(root, false);

  assert.equal(result.expanded, false);
  assert.equal(result.children[0]?.expanded, false);
  assert.equal(result.children[1]?.children[0]?.expanded, false);
  assert.equal(expandAll(tree()).children[1]?.expanded, true);
  assert.notStrictEqual(result, root);
  assert.deepEqual(root, tree());
});
