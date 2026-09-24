import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { ProjectManagementRepo, ProjectModuleItem } from "../../repos/ProjectManagementRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

const nodeKind = z.enum(["step", "decision", "table", "boundary", "region", "note"]);
const position = z.object({ x: z.number().finite(), y: z.number().finite() });
const nodeInput = z.object({
  id: z.string().trim().min(1).max(160).optional(), label: z.string().trim().min(1).max(500), kind: nodeKind,
  position, caption: z.string().max(4_000).optional(), description: z.string().max(20_000).optional(),
  source: z.string().max(4_000).optional(), verified: z.boolean().optional(), scope: z.string().trim().min(1).max(160).optional(),
});
const nodePatch = nodeInput.partial().omit({ id: true, position: true }).extend({ position: position.optional() });
const edgeInput = z.object({
  id: z.string().trim().min(1).max(160).optional(), source: z.string().trim().min(1).max(160), target: z.string().trim().min(1).max(160),
  label: z.string().max(500).optional(), type: z.enum(["smoothstep", "straight", "step", "bezier"]).optional(),
  lineStyle: z.enum(["solid", "dashed", "dotted"]).optional(), lineColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  lineWidth: z.number().min(0.5).max(12).optional(), markerEnd: z.enum(["arrow", "none"]).optional(), animated: z.boolean().optional(),
});
const edgePatch = edgeInput.omit({ id: true, source: true, target: true }).partial();
const flowchartInput = z.object({
  action: z.enum(["get", "update_chart", "create_node", "update_node", "delete_node", "create_edge", "update_edge", "delete_edge"]),
  projectId: z.string().trim().min(1), flowchartId: z.string().trim().min(1), nodeId: z.string().trim().min(1).optional(), edgeId: z.string().trim().min(1).optional(),
  node: nodeInput.optional(), patch: nodePatch.optional(), edge: edgeInput.optional(), edgePatch: edgePatch.optional(),
  title: z.string().trim().min(1).max(280).optional(), objective: z.string().max(20_000).optional(), status: z.enum(["draft", "active", "completed"]).optional(),
  context: richContextSchema, options: richOptionsSchema,
}).superRefine((input, context) => {
  if (input.action === "create_node" && !input.node) context.addIssue({ code: "custom", path: ["node"], message: "node is required." });
  if (input.action === "update_node" && (!input.nodeId || !input.patch || Object.keys(input.patch).length === 0)) context.addIssue({ code: "custom", path: ["patch"], message: "nodeId and a non-empty patch are required." });
  if (input.action === "delete_node" && !input.nodeId) context.addIssue({ code: "custom", path: ["nodeId"], message: "nodeId is required." });
  if (input.action === "create_edge" && !input.edge) context.addIssue({ code: "custom", path: ["edge"], message: "edge is required." });
  if (input.action === "update_edge" && (!input.edgeId || !input.edgePatch || Object.keys(input.edgePatch).length === 0)) context.addIssue({ code: "custom", path: ["edgePatch"], message: "edgeId and a non-empty edgePatch are required." });
  if (input.action === "delete_edge" && !input.edgeId) context.addIssue({ code: "custom", path: ["edgeId"], message: "edgeId is required." });
  if (input.action === "update_chart" && input.title === undefined && input.objective === undefined && input.status === undefined) context.addIssue({ code: "custom", path: ["action"], message: "Provide title, objective, or status." });
});

type FlowchartGraph = { version: 1; objective: string; status: "draft" | "active" | "completed"; nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
type FlowchartMutationResult = { item: ProjectModuleItem; node?: Record<string, unknown>; edge?: Record<string, unknown>; deletedNodeId?: string; deletedEdgeId?: string; flowchart?: Record<string, unknown> };

function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function id(value: Record<string, unknown>): string { return typeof value.id === "string" ? value.id : ""; }
function graphOf(item: ProjectModuleItem): FlowchartGraph {
  const graph = item.content.graph;
  if (!object(graph) || graph.version !== 1 || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !["draft", "active", "completed"].includes(String(graph.status))) {
    throw new RichMcpError("VALIDATION_ERROR", "The stored flowchart graph is invalid.");
  }
  return graph as FlowchartGraph;
}
function flowchartRef(item: ProjectModuleItem) { return [{ type: "projectItem", id: item.id, label: item.title }]; }

export function registerFlowchartTools(registry: RichToolRegistry, projects: Pick<ProjectManagementRepo, "listModuleItems" | "updateModuleItem">, operationRepo?: McpOperationRepo): void {
  registry.register({
    name: "rich_flowchart_manage", title: "管理项目流程图", category: "manage",
    description: "读取并精确修改项目流程图：图信息、节点、连线及节点详情。所有写入均写后读回校验。",
    inputSchema: flowchartInput, annotations: { readOnly: false, destructive: true, idempotent: true },
    examples: [{ description: "修改当前流程图节点详情", input: { action: "update_node", projectId: "project-id", flowchartId: "flowchart-id", nodeId: "node-id", patch: { description: "补充后的处理说明" } } }],
    verification: "Every mutation reads the same flowchart back and verifies the requested node, edge, or chart field.",
    handler: async input => {
      const find = async () => {
        const item = (await projects.listModuleItems(input.projectId, "flowcharts")).find(candidate => candidate.id === input.flowchartId);
        if (!item) throw new RichMcpError("NOT_FOUND", "The requested flowchart was not found in this project.");
        return item;
      };
      if (input.action === "get") {
        const item = await find();
        return richSuccess("rich_flowchart_manage", { flowchart: { id: item.id, title: item.title, graph: graphOf(item), updatedAt: item.updatedAt } }, { refs: flowchartRef(item) });
      }
      const destructive = input.action === "delete_node" || input.action === "delete_edge";
      return executeSafeWrite<FlowchartMutationResult>({
        toolName: "rich_flowchart_manage", operationRepo, context: input.context, options: input.options, destructive,
        inputForHash: input, changes: [{ operation: input.action.startsWith("delete") ? "delete" : input.action.startsWith("create") ? "create" : "update", resource: "flowchart", id: input.flowchartId }],
        execute: async () => {
          const item = await find(); const graph = graphOf(item);
          let nextGraph: FlowchartGraph = { ...graph, nodes: [...graph.nodes], edges: [...graph.edges] };
          let nextTitle = item.title; let result: Omit<FlowchartMutationResult, "item"> = {};
          if (input.action === "update_chart") {
            nextTitle = input.title ?? item.title; nextGraph = { ...nextGraph, ...(input.objective === undefined ? {} : { objective: input.objective }), ...(input.status === undefined ? {} : { status: input.status }) };
            result = { flowchart: { id: item.id, title: nextTitle, graph: nextGraph } };
          }
          if (input.action === "create_node") {
            const nodeId = input.node!.id ?? randomUUID();
            if (nextGraph.nodes.some(node => id(node) === nodeId)) throw new RichMcpError("CONFLICT", "A node with this ID already exists.");
            const node = { id: nodeId, type: input.node!.kind === "region" ? "region" : input.node!.kind === "note" ? "note" : "analysis", position: input.node!.position, data: { label: input.node!.label, kind: input.node!.kind, caption: input.node!.caption, description: input.node!.description ?? "", source: input.node!.source ?? "", verified: input.node!.verified ?? false, scope: input.node!.scope ?? "root" } };
            nextGraph = { ...nextGraph, nodes: [...nextGraph.nodes, node] }; result = { node };
          }
          if (input.action === "update_node") {
            const index = nextGraph.nodes.findIndex(node => id(node) === input.nodeId); if (index < 0) throw new RichMcpError("NOT_FOUND", "The requested flowchart node was not found.");
            const previous = nextGraph.nodes[index]!; const data = object(previous.data) ? previous.data : {};
            const patch = input.patch!; const node = { ...previous, ...(patch.position ? { position: patch.position } : {}), data: { ...data, ...(patch.label === undefined ? {} : { label: patch.label }), ...(patch.kind === undefined ? {} : { kind: patch.kind }), ...(patch.caption === undefined ? {} : { caption: patch.caption }), ...(patch.description === undefined ? {} : { description: patch.description }), ...(patch.source === undefined ? {} : { source: patch.source }), ...(patch.verified === undefined ? {} : { verified: patch.verified }), ...(patch.scope === undefined ? {} : { scope: patch.scope }) } };
            nextGraph.nodes[index] = node; result = { node };
          }
          if (input.action === "delete_node") {
            if (!nextGraph.nodes.some(node => id(node) === input.nodeId)) throw new RichMcpError("NOT_FOUND", "The requested flowchart node was not found.");
            nextGraph = { ...nextGraph, nodes: nextGraph.nodes.filter(node => id(node) !== input.nodeId), edges: nextGraph.edges.filter(edge => edge.source !== input.nodeId && edge.target !== input.nodeId) }; result = { deletedNodeId: input.nodeId };
          }
          if (input.action === "create_edge") {
            const edgeId = input.edge!.id ?? randomUUID();
            if (nextGraph.edges.some(edge => id(edge) === edgeId)) throw new RichMcpError("CONFLICT", "An edge with this ID already exists.");
            if (![input.edge!.source, input.edge!.target].every(nodeId => nextGraph.nodes.some(node => id(node) === nodeId))) throw new RichMcpError("VALIDATION_ERROR", "Both edge endpoints must exist in this flowchart.");
            const edge = { id: edgeId, source: input.edge!.source, target: input.edge!.target, label: input.edge!.label ?? "", type: input.edge!.type ?? "smoothstep", data: { lineStyle: input.edge!.lineStyle ?? "solid", ...(input.edge!.lineColor ? { lineColor: input.edge!.lineColor } : {}), ...(input.edge!.lineWidth ? { lineWidth: input.edge!.lineWidth } : {}), markerEnd: input.edge!.markerEnd ?? "arrow", ...(input.edge!.animated === undefined ? {} : { animated: input.edge!.animated }) } };
            nextGraph = { ...nextGraph, edges: [...nextGraph.edges, edge] }; result = { edge };
          }
          if (input.action === "update_edge") {
            const index = nextGraph.edges.findIndex(edge => id(edge) === input.edgeId); if (index < 0) throw new RichMcpError("NOT_FOUND", "The requested flowchart edge was not found.");
            const previous = nextGraph.edges[index]!; const data = object(previous.data) ? previous.data : {}; const patch = input.edgePatch!;
            const edge = { ...previous, ...(patch.label === undefined ? {} : { label: patch.label }), ...(patch.type === undefined ? {} : { type: patch.type }), data: { ...data, ...(patch.lineStyle === undefined ? {} : { lineStyle: patch.lineStyle }), ...(patch.lineColor === undefined ? {} : { lineColor: patch.lineColor }), ...(patch.lineWidth === undefined ? {} : { lineWidth: patch.lineWidth }), ...(patch.markerEnd === undefined ? {} : { markerEnd: patch.markerEnd }), ...(patch.animated === undefined ? {} : { animated: patch.animated }) } };
            nextGraph.edges[index] = edge; result = { edge };
          }
          if (input.action === "delete_edge") {
            if (!nextGraph.edges.some(edge => id(edge) === input.edgeId)) throw new RichMcpError("NOT_FOUND", "The requested flowchart edge was not found.");
            nextGraph = { ...nextGraph, edges: nextGraph.edges.filter(edge => id(edge) !== input.edgeId) }; result = { deletedEdgeId: input.edgeId };
          }
          const updated = await projects.updateModuleItem(input.projectId, item.id, { title: nextTitle, content: { ...item.content, graph: nextGraph } });
          if (!updated) throw new RichMcpError("NOT_FOUND", "The requested flowchart was no longer available.");
          return { item: updated, ...result };
        },
        verify: async result => {
          const current = await find(); const graph = graphOf(current);
          const verified = input.action === "update_chart" ? current.title === (input.title ?? current.title) && (input.objective === undefined || graph.objective === input.objective) && (input.status === undefined || graph.status === input.status)
            : input.action === "create_node" || input.action === "update_node" ? graph.nodes.some(node => id(node) === (input.action === "create_node" ? (input.node!.id ?? id(result.node ?? {})) : input.nodeId))
            : input.action === "delete_node" ? !graph.nodes.some(node => id(node) === input.nodeId) && !graph.edges.some(edge => edge.source === input.nodeId || edge.target === input.nodeId)
            : input.action === "create_edge" || input.action === "update_edge" ? graph.edges.some(edge => id(edge) === (input.action === "create_edge" ? (input.edge!.id ?? id(result.edge ?? {})) : input.edgeId))
            : !graph.edges.some(edge => id(edge) === input.edgeId);
          return { status: verified ? "verified" : "failed", details: "Flowchart mutation was read back from the project." };
        },
        refs: result => flowchartRef(result.item),
      });
    },
  });
}
