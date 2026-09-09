import type { Edge, Node } from "@xyflow/react";
import type { NodeStyle } from "../../../components/mindmap/nodeStyleControls.js";

export type FlowNode = Node<{
  label: string;
  kind: "step" | "decision" | "table" | "boundary" | "region" | "note";
  caption?: string;
  tone?: "cyan" | "mint" | "amber";
  description: string;
  source: string;
  verified: boolean;
  scope: string;
} & Partial<NodeStyle>>;
export interface FlowchartData {
  version: 1;
  objective: string;
  status: "draft" | "active" | "completed";
  nodes: FlowNode[];
  edges: Edge[];
}
export const ROOT_SCOPE = "root";
export function createFlowchart(codeAnalysis: boolean): FlowchartData {
  const labels = codeAnalysis ? ["入口方法", "处理逻辑（待分析）", "返回结果"] : ["开始", "处理步骤", "结束"];
  const nodes: FlowNode[] = labels.map((label, i) => ({
    id: crypto.randomUUID(), type: "analysis", position: { x: 100 + i * 300, y: 160 },
    data: { label, kind: i === 1 ? "step" : "boundary", description: "", source: "", verified: false, scope: ROOT_SCOPE },
  }));
  return { version: 1, objective: "", status: "draft", nodes, edges: nodes.slice(1).map((node, i) => ({
    id: crypto.randomUUID(), source: nodes[i].id, target: node.id, label: "", type: "smoothstep",
  })) };
}
export function readFlowchart(content: Record<string, unknown>): FlowchartData {
  const graph = content.graph as FlowchartData | undefined;
  if (!graph || graph.version !== 1 || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error("流程图数据格式不正确，无法加载。");
  }
  return graph;
}
export function scopePath(nodes: FlowNode[], scope: string): FlowNode[] {
  const path: FlowNode[] = [];
  const seen = new Set<string>();
  while (scope !== ROOT_SCOPE && !seen.has(scope)) {
    seen.add(scope);
    const node = nodes.find(item => item.id === scope);
    if (!node) break;
    path.unshift(node);
    scope = node.data.scope;
  }
  return path;
}
export function removeFlowNodes(graph: FlowchartData, ids: string[]): FlowchartData {
  const removed = new Set(ids);
  let previous = -1;
  while (previous !== removed.size) {
    previous = removed.size;
    graph.nodes.forEach(node => { if (removed.has(node.data.scope)) removed.add(node.id); });
  }
  return { ...graph, nodes: graph.nodes.filter(node => !removed.has(node.id)),
    edges: graph.edges.filter(edge => !removed.has(edge.source) && !removed.has(edge.target)) };
}
export function searchFlowNodes(nodes: FlowNode[], query: string): FlowNode[] {
  const keyword = query.trim().toLocaleLowerCase();
  return keyword ? nodes.filter(node => [node.id, node.data.label, node.data.source, node.data.description]
    .some(value => value.toLocaleLowerCase().includes(keyword))) : [];
}
