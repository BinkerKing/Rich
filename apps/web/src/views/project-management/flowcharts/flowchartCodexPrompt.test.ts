import assert from "node:assert/strict";
import test from "node:test";
import { flowchartCodexPrompt } from "./flowchartCodexPrompt.js";

test("creates a scoped Codex instruction with graph background, structure, and MCP actions", () => {
  const prompt = flowchartCodexPrompt({
    projectId: "project-1", flowchartId: "flowchart-1", title: "订单处理", request: "补充人工审核风险判断",
    graph: { version: 1, objective: "梳理订单处理", status: "active", nodes: [
      { id: "start", position: { x: 0, y: 0 }, data: { label: "接收订单", kind: "step", description: "接收订单内容", source: "order.ts", verified: true, scope: "root" } },
      { id: "review", position: { x: 300, y: 0 }, data: { label: "人工审核", kind: "decision", description: "", source: "", verified: false, scope: "root" } },
    ], edges: [{ id: "start-review", source: "start", target: "review", label: "提交审核", type: "smoothstep" }], },
    selectedNodeIds: ["review"],
  });

  assert.match(prompt, /rich_flowchart_manage/);
  assert.match(prompt, /project-1/);
  assert.match(prompt, /flowchart-1/);
  assert.match(prompt, /订单处理/);
  assert.match(prompt, /接收订单 → 人工审核/);
  assert.match(prompt, /选中节点：review/);
  assert.match(prompt, /补充人工审核风险判断/);
  assert.match(prompt, /先调用.*get/);
});

test("omits the full graph after the initial Codex turn", () => {
  const prompt = flowchartCodexPrompt({
    projectId: "project-1", flowchartId: "flowchart-1", title: "订单处理", request: "补充人工审核风险判断", includeGraph: false,
    graph: { version: 1, objective: "梳理订单处理", status: "active", nodes: [
      { id: "start", position: { x: 0, y: 0 }, data: { label: "接收订单", kind: "step", scope: "root" } },
      { id: "review", position: { x: 300, y: 0 }, data: { label: "人工审核", kind: "decision", description: "核对风险", scope: "root" } },
    ], edges: [{ id: "start-review", source: "start", target: "review" }], },
    selectedNodeIds: ["review"],
  });

  assert.doesNotMatch(prompt, /## 全图结构/);
  assert.doesNotMatch(prompt, /接收订单/);
  assert.match(prompt, /人工审核/);
  assert.match(prompt, /会话已具备首次发送的全图背景/);
});
