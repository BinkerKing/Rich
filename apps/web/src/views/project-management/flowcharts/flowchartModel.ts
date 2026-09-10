import type { Connection, Edge, Node, XYPosition } from "@xyflow/react";
import type { NodeStyle } from "../../../components/mindmap/nodeStyleControls.js";

export type FlowNodeKind = "step" | "decision" | "table" | "boundary" | "region" | "note";
export type FlowNodeAlignment = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type FlowNodeDistribution = "horizontal" | "vertical";
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
  groupId?: string;
  collapsed?: boolean;
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
    graph.nodes.forEach(node => { if (removed.has(node.data.scope) || (node.data.groupId && removed.has(node.data.groupId))) removed.add(node.id); });
  }
  return { ...graph, nodes: graph.nodes.filter(node => !removed.has(node.id)),
    edges: graph.edges.filter(edge => !removed.has(edge.source) && !removed.has(edge.target)) };
}
function nodeSize(node: FlowNode) {
  const fallback = nodeSizes[node.data.kind];
  return {
    width: typeof node.style?.width === "number" ? node.style.width : fallback.width,
    height: typeof node.style?.height === "number" ? node.style.height : fallback.height,
  };
}
function selectedNodes(graph: FlowchartData, ids: string[]) { const selected = new Set(ids); return graph.nodes.filter(node => selected.has(node.id)); }
export function alignFlowNodes(graph: FlowchartData, ids: string[], alignment: FlowNodeAlignment): FlowchartData {
  const nodes = selectedNodes(graph, ids);
  if (nodes.length < 2) return graph;
  const horizontal = alignment === "left" || alignment === "center" || alignment === "right";
  const starts = nodes.map(node => horizontal ? node.position.x : node.position.y);
  const ends = nodes.map(node => (horizontal ? node.position.x : node.position.y) + (horizontal ? nodeSize(node).width : nodeSize(node).height));
  const start = Math.min(...starts), end = Math.max(...ends), center = (start + end) / 2;
  const selected = new Set(ids);
  return { ...graph, nodes: graph.nodes.map(node => {
    if (!selected.has(node.id)) return node;
    const size = horizontal ? nodeSize(node).width : nodeSize(node).height;
    const coordinate = alignment === "left" || alignment === "top" ? start : alignment === "right" || alignment === "bottom" ? end - size : center - size / 2;
    return { ...node, position: horizontal ? { ...node.position, x: coordinate } : { ...node.position, y: coordinate } };
  }) };
}
export function distributeFlowNodes(graph: FlowchartData, ids: string[], direction: FlowNodeDistribution): FlowchartData {
  const nodes = selectedNodes(graph, ids).sort((a, b) => direction === "horizontal" ? a.position.x - b.position.x : a.position.y - b.position.y);
  if (nodes.length < 3) return graph;
  const first = direction === "horizontal" ? nodes[0]!.position.x : nodes[0]!.position.y;
  const last = direction === "horizontal" ? nodes.at(-1)!.position.x : nodes.at(-1)!.position.y;
  const spacing = (last - first) / (nodes.length - 1);
  const coordinates = new Map(nodes.map((node, index) => [node.id, first + spacing * index]));
  return { ...graph, nodes: graph.nodes.map(node => {
    const coordinate = coordinates.get(node.id);
    return coordinate === undefined ? node : { ...node, position: direction === "horizontal" ? { ...node.position, x: coordinate } : { ...node.position, y: coordinate } };
  }) };
}
export function layoutFlowNodes(graph: FlowchartData, ids: string[], direction: FlowNodeDistribution): FlowchartData {
  const selected = new Set(ids);
  let index = 0;
  return { ...graph, nodes: graph.nodes.map(node => {
    if (!selected.has(node.id)) return node;
    const position = direction === "horizontal" ? { x: 100 + index * 260, y: 160 } : { x: 220, y: 100 + index * 150 };
    index += 1;
    return { ...node, position };
  }) };
}
export interface FlowSelection { nodes: FlowNode[]; edges: FlowEdge[]; }
export function copyFlowSelection(graph: FlowchartData, ids: string[]): FlowSelection {
  const selected = new Set(ids);
  return { nodes: graph.nodes.filter(node => selected.has(node.id)).map(node => ({ ...node, data: { ...node.data }, style: { ...node.style } })),
    edges: graph.edges.filter(edge => selected.has(edge.source) && selected.has(edge.target)).map(edge => ({ ...edge, data: { ...edge.data } })) };
}
export function pasteFlowSelection(graph: FlowchartData, selection: FlowSelection, offset = 32): { graph: FlowchartData; nodeIds: string[] } {
  if (!selection.nodes.length) return { graph, nodeIds: [] };
  const ids = new Map(selection.nodes.map(node => [node.id, crypto.randomUUID()]));
  const nodes = selection.nodes.map(node => ({ ...node, id: ids.get(node.id)!, position: { x: node.position.x + offset, y: node.position.y + offset }, data: { ...node.data, groupId: undefined, collapsed: false } }));
  const edges = selection.edges.map(edge => ({ ...edge, id: crypto.randomUUID(), source: ids.get(edge.source)!, target: ids.get(edge.target)!, data: { ...edge.data } }));
  return { graph: { ...graph, nodes: [...graph.nodes, ...nodes], edges: [...graph.edges, ...edges] }, nodeIds: nodes.map(node => node.id) };
}
export function createFlowGroup(graph: FlowchartData, ids: string[]): FlowchartData {
  const members = selectedNodes(graph, ids).filter(node => node.data.kind !== "region");
  if (members.length < 2 || members.some(node => node.data.scope !== members[0]!.data.scope || node.data.groupId)) return graph;
  const bounds = members.reduce((current, node) => {
    const size = nodeSize(node);
    return { left: Math.min(current.left, node.position.x), top: Math.min(current.top, node.position.y), right: Math.max(current.right, node.position.x + size.width), bottom: Math.max(current.bottom, node.position.y + size.height) };
  }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const group = createFlowNode("region", { x: bounds.left - 36, y: bounds.top - 54 }, members[0]!.data.scope);
  group.data = { ...group.data, label: "流程组", caption: "" };
  group.style = { width: bounds.right - bounds.left + 72, height: bounds.bottom - bounds.top + 90, zIndex: 0 };
  const memberIds = new Set(members.map(node => node.id));
  return { ...graph, nodes: [group, ...graph.nodes.map(node => memberIds.has(node.id) ? { ...node, style: { ...node.style, zIndex: 1 }, data: { ...node.data, groupId: group.id } } : node)] };
}
export function toggleFlowGroup(graph: FlowchartData, groupId: string): FlowchartData {
  return { ...graph, nodes: graph.nodes.map(node => node.id === groupId ? { ...node, data: { ...node.data, collapsed: !node.data.collapsed } } : node) };
}
export function searchFlowNodes(nodes: FlowNode[], query: string): FlowNode[] {
  const keyword = query.trim().toLocaleLowerCase();
  return keyword ? nodes.filter(node => [node.id, node.data.label, node.data.source, node.data.description]
    .some(value => value.toLocaleLowerCase().includes(keyword))) : [];
}
