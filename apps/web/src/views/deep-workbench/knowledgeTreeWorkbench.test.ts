import assert from "node:assert/strict";
import test from "node:test";
import { planKnowledgeTreeChanges, projectKnowledgeTree } from "./knowledgeTreeWorkbench.js";

const at = "2026-09-09T00:00:00.000Z";
const element = (id: string, title: string) => ({
  id, title, type: "concept", content: {}, metadata: { createdAt: at, updatedAt: at, generatedBy: "user", richness: 1 },
});
const child = (from: string, to: string) => ({ id: `${from}-${to}`, from, to, kind: "child", createdAt: at });

test("projects an ordered knowledge subtree into a mind map and keeps prior node styles", () => {
  const map = projectKnowledgeTree(
    "root",
    [element("root", "知识库"), element("first", "第一章"), element("second", "第二章")],
    [child("root", "first"), child("root", "second")],
    {
      root: {
        data: { uid: "root", text: "旧标题", fillColor: "#112233" },
        children: [{ data: { uid: "first", text: "旧第一章", fontWeight: "bold" }, children: [] }],
      },
      layout: "mindMap",
      theme: { template: "default", config: {} },
    },
  );

  assert.equal(map.layout, "mindMap");
  assert.equal(map.root.data.uid, "root");
  assert.equal(map.root.data.text, "知识库");
  assert.equal(map.root.data.fillColor, "#112233");
  assert.deepEqual(map.root.children.map(node => node.data.uid), ["first", "second"]);
  assert.equal(map.root.children[0]!.data.fontWeight, "bold");
});

test("plans tree edits as canonical knowledge operations", () => {
  const previous = {
    data: { uid: "root", text: "知识库" },
    children: [
      { data: { uid: "first", text: "第一章" }, children: [] },
      { data: { uid: "second", text: "第二章" }, children: [] },
      { data: { uid: "removed", text: "待删除" }, children: [] },
    ],
  };
  const next = {
    data: { uid: "root", text: "新的知识库" },
    children: [
      { data: { uid: "second", text: "第二章" }, children: [{ data: { uid: "first", text: "第一章" }, children: [] }] },
      { data: { uid: "draft", text: "新节点" }, children: [] },
    ],
  };

  assert.deepEqual(planKnowledgeTreeChanges(previous, next, new Set(["root", "first", "second", "removed"])), {
    renames: [{ elementId: "root", title: "新的知识库" }],
    creates: [{ draftId: "draft", parentId: "root", title: "新节点" }],
    moves: [{ elementId: "first", parentId: "second" }],
    reorders: [
      { parentId: "root", childIds: ["second", "draft"] },
      { parentId: "second", childIds: ["first"] },
    ],
    deletes: ["removed"],
  });
});
