import type { Connection, Edge, Node, XYPosition } from "@xyflow/react";
import type { NodeStyle } from "../../../components/mindmap/nodeStyleControls.js";

export type FlowNodeKind = "step" | "decision" | "table" | "boundary" | "region" | "note";
export type FlowEdge = Edge<{ lineStyle?: "solid" | "dashed" | "dotted"; lineColor?: string; lineWidth?: number; markerEnd?: "arrow" | "none"; animated?: boolean }>;
export type FlowNode = Node<{
  label: string;
  kind: FlowNodeKind;
  icon?: string;
  caption?: string;
  tone?: "cyan" | "mint" | "amber";
  description: string;
  source: string;
  verified: boolean;
  scope: string;
  editing?: boolean;
  onLabelChange?: (label: string) => void;
  onNoteTextChange?: (text: string) => void;
} & Partial<NodeStyle>>;
export interface FlowchartData {
  version: 1;
  objective: string;
  status: "draft" | "active" | "completed";
  nodes: FlowNode[];
  edges: FlowEdge[];
}
export const ROOT_SCOPE = "root";
const nodeLabels: Record<FlowNodeKind, string> = { step: "处理步骤", decision: "判断条件", table: "数据表", boundary: "开始 / 结束", region: "流程区域", note: "备注" };
const nodeSizes: Record<FlowNodeKind, { width: number; height: number }> = { step: { width: 180, height: 68 }, decision: { width: 180, height: 68 }, table: { width: 180, height: 68 }, boundary: { width: 180, height: 68 }, region: { width: 460, height: 240 }, note: { width: 260, height: 150 } };
export function flowNodeType(kind: FlowNodeKind): FlowNode["type"] { return kind === "region" ? "region" : kind === "note" ? "note" : "analysis"; }
export function createFlowNode(kind: FlowNodeKind, position: XYPosition, scope = ROOT_SCOPE): FlowNode {
  return { id: crypto.randomUUID(), type: flowNodeType(kind), position, style: { ...nodeSizes[kind] }, data: { label: nodeLabels[kind], kind, description: "", source: "", verified: false, scope } };
}
export function createFlowEdge(connection: Pick<Connection, "source" | "target"> & Partial<Pick<Connection, "sourceHandle" | "targetHandle">>): FlowEdge {
  return { ...connection, id: crypto.randomUUID(), type: "smoothstep", label: "", data: { lineStyle: "solid", lineWidth: 1.5, markerEnd: "arrow" } };
}
export function createFlowchart(codeAnalysis: boolean): FlowchartData {
  const labels = codeAnalysis ? ["入口方法", "处理逻辑（待分析）", "返回结果"] : ["开始", "处理步骤", "结束"];
  const nodes: FlowNode[] = labels.map((label, i) => {
    const node = createFlowNode(i === 1 ? "step" : "boundary", { x: 100 + i * 300, y: 160 });
    return { ...node, data: { ...node.data, label } };
  });
  return { version: 1, objective: "", status: "draft", nodes, edges: nodes.slice(1).map((node, i) => createFlowEdge({ source: nodes[i].id, target: node.id })) };
}
export function readFlowchart(content: Record<string, unknown>): FlowchartData {
  const graph = content.graph as FlowchartData | undefined;
  if (!graph || graph.version !== 1 || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error("流程图数据格式不正确，无法加载。");
  }
  return { ...graph, nodes: graph.nodes.map(node => ({ ...node, style: { ...nodeSizes[node.data.kind], ...node.style } })) };
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
