import assert from "node:assert/strict";
import test from "node:test";
import { createFlowchart, createFlowEdge, createFlowNode, removeFlowNodes, scopePath, searchFlowNodes, readFlowchart } from "./flowchartModel.js";

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

test("创建节点保留语义类型、画布位置与默认文字", () => {
  const node = createFlowNode("decision", { x: 240, y: 180 });
  assert.equal(node.data.kind, "decision");
  assert.equal(node.data.label, "判断条件");
  assert.deepEqual(node.position, { x: 240, y: 180 });
  assert.equal(node.data.scope, "root");
  assert.deepEqual(node.style, { width: 180, height: 68 });
});

test("读取旧流程图时补全节点可调整的默认尺寸", () => {
  const graph = createFlowchart(false);
  delete graph.nodes[0].style;
  const restored = readFlowchart({ graph });
  assert.deepEqual(restored.nodes[0].style, { width: 180, height: 68 });
});

test("创建连线带有可编辑的默认外观", () => {
  const edge = createFlowEdge({ source: "source", target: "target" });
  assert.equal(edge.type, "smoothstep");
  assert.equal(edge.label, "");
  assert.deepEqual(edge.data, { lineStyle: "solid", lineWidth: 1.5, markerEnd: "arrow" });
});
