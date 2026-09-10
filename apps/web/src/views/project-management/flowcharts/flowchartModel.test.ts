import assert from "node:assert/strict";
import test from "node:test";
import { alignFlowNodes, copyFlowSelection, createFlowGroup, createFlowchart, createFlowEdge, createFlowNode, distributeFlowNodes, layoutFlowNodes, pasteFlowSelection, removeFlowNodes, scopePath, searchFlowNodes, readFlowchart, toggleFlowGroup } from "./flowchartModel.js";

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

test("多选节点可按边缘对齐并保持各自尺寸", () => {
  const left = createFlowNode("step", { x: 100, y: 160 });
  const right = createFlowNode("note", { x: 420, y: 40 });
  const graph = { ...createFlowchart(false), nodes: [left, right], edges: [] };
  const next = alignFlowNodes(graph, [left.id, right.id], "left");
  assert.deepEqual(next.nodes.map(node => node.position.x), [100, 100]);
  assert.equal(next.nodes[1]?.style?.width, 260);
});

test("多选节点可按横向间距均匀分布", () => {
  const first = createFlowNode("step", { x: 0, y: 0 });
  const middle = createFlowNode("step", { x: 100, y: 0 });
  const last = createFlowNode("step", { x: 600, y: 0 });
  const graph = { ...createFlowchart(false), nodes: [first, middle, last], edges: [] };
  const next = distributeFlowNodes(graph, [first.id, middle.id, last.id], "horizontal");
  assert.deepEqual(next.nodes.map(node => node.position.x), [0, 300, 600]);
});

test("自动布局可按横向流程顺序重新排布当前节点", () => {
  const first = createFlowNode("step", { x: 480, y: 260 });
  const second = createFlowNode("step", { x: 40, y: 20 });
  const graph = { ...createFlowchart(false), nodes: [first, second], edges: [] };
  const next = layoutFlowNodes(graph, [first.id, second.id], "horizontal");
  assert.deepEqual(next.nodes.map(node => node.position), [{ x: 100, y: 160 }, { x: 360, y: 160 }]);
});

test("复制粘贴选区会保留内部连线而不带出外部连线", () => {
  const first = createFlowNode("step", { x: 100, y: 100 });
  const second = createFlowNode("step", { x: 350, y: 100 });
  const outside = createFlowNode("step", { x: 600, y: 100 });
  const graph = { ...createFlowchart(false), nodes: [first, second, outside], edges: [createFlowEdge({ source: first.id, target: second.id }), createFlowEdge({ source: second.id, target: outside.id })] };
  const pasted = pasteFlowSelection(graph, copyFlowSelection(graph, [first.id, second.id]));
  assert.equal(pasted.graph.nodes.length, 5);
  assert.equal(pasted.graph.edges.length, 3);
  assert.deepEqual(pasted.graph.nodes.slice(-2).map(node => node.position), [{ x: 132, y: 132 }, { x: 382, y: 132 }]);
});

test("选中的节点可组成可折叠流程区域，折叠状态可切换", () => {
  const first = createFlowNode("step", { x: 100, y: 100 });
  const second = createFlowNode("step", { x: 350, y: 100 });
  const graph = { ...createFlowchart(false), nodes: [first, second], edges: [] };
  const grouped = createFlowGroup(graph, [first.id, second.id]);
  const group = grouped.nodes[0]!;
  assert.equal(group.data.kind, "region");
  assert.deepEqual(grouped.nodes.slice(1).map(node => node.data.groupId), [group.id, group.id]);
  assert.equal(toggleFlowGroup(grouped, group.id).nodes[0]?.data.collapsed, true);
});
