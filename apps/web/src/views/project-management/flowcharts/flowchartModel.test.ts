import assert from "node:assert/strict";
import test from "node:test";
import { createFlowchart, removeFlowNodes, scopePath, searchFlowNodes, readFlowchart } from "./flowchartModel.js";

test("删除父节点同时清理深层子流程和相关连线，保留其他分支", () => {
  const graph = createFlowchart(true);
  const parent = graph.nodes[1];
  const child = { ...parent, id: "child", data: { ...parent.data, scope: parent.id } };
  const grandchild = { ...parent, id: "grandchild", data: { ...parent.data, scope: child.id } };
  graph.nodes.push(child, grandchild);
  graph.edges.push({ id: "nested", source: child.id, target: grandchild.id });
  const next = removeFlowNodes(graph, [parent.id]);
  assert.deepEqual(next.nodes.map(node => node.id), [graph.nodes[0].id, graph.nodes[2].id]);
  assert.equal(next.edges.length, 0);
  assert.equal(graph.nodes.length, 5);
});
test("全层级搜索源码与描述，面包屑按祖先顺序返回", () => {
  const graph = createFlowchart(true);
  const parent = graph.nodes[1];
  const child = { ...parent, id: "child", data: { ...parent.data, source: "CFACA.java:43", description: "按合同号匹配", scope: parent.id } };
  graph.nodes.push(child);
  assert.deepEqual(searchFlowNodes(graph.nodes, "cfaca"), [child]);
  assert.deepEqual(searchFlowNodes(graph.nodes, "合同号"), [child]);
  assert.deepEqual(scopePath(graph.nodes, child.id).map(node => node.id), [parent.id, child.id]);
  assert.deepEqual(searchFlowNodes(graph.nodes, "  "), []);
});
test("任务图数据 JSON 往返保留节点编号、连线和状态；拒绝未知版本", () => {
  const graph = createFlowchart(false);
  assert.deepEqual(readFlowchart(JSON.parse(JSON.stringify({ graph }))), graph);
  assert.throws(() => readFlowchart({ graph: { ...graph, version: 2 } }));
});
