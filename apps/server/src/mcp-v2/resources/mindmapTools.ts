import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Element, Relation } from "@ke/domain";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { RelationsRepo } from "../../repos/RelationsRepo.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

type NodePatch = { title?: string; subtitle?: string | null; tags?: string[]; type?: Element["type"]; details?: string };

function contentOf(element: Element): Record<string, unknown> { return element.content && typeof element.content === "object" && !Array.isArray(element.content) ? element.content as Record<string, unknown> : {}; }
function nodeOf(element: Element) { return { id: element.id, title: element.title, subtitle: element.subtitle, type: element.type, tags: element.tags, details: typeof contentOf(element).mindmapDetails === "string" ? contentOf(element).mindmapDetails : "", updatedAt: element.metadata.updatedAt }; }

export function registerMindmapTools(registry: RichToolRegistry, deps: { elements: ElementsRepo; relations: RelationsRepo }, operationRepo?: McpOperationRepo): void {
  registry.register({
    name: "rich_mindmap_manage", title: "管理 Rich 思维导图", category: "manage",
    description: "快速读取、搜索并维护知识树思维导图。get 返回完整节点树；search 可按标题、标签、详情查询；create_node、update_node、delete_node 精确新增、修改、删除节点。所有写入会读回验证。",
    inputSchema: z.object({
      action: z.enum(["get", "search", "create_node", "update_node", "delete_node"]),
      rootId: z.string().trim().min(1), nodeId: z.string().trim().min(1).optional(), parentId: z.string().trim().min(1).optional(), query: z.string().trim().min(1).optional(),
      node: z.object({ id: z.string().trim().min(1).optional(), title: z.string().trim().min(1).max(280), subtitle: z.string().max(280).nullable().optional(), tags: z.array(z.string().trim().min(1).max(80)).max(30).optional(), type: z.string().trim().min(1).optional(), details: z.string().max(20000).optional() }).optional(),
      patch: z.object({ title: z.string().trim().min(1).max(280).optional(), subtitle: z.string().max(280).nullable().optional(), tags: z.array(z.string().trim().min(1).max(80)).max(30).optional(), type: z.string().trim().min(1).optional(), details: z.string().max(20000).optional() }).optional(),
      context: richContextSchema, options: richOptionsSchema,
    }).superRefine((input, ctx) => {
      if ((input.action === "update_node" || input.action === "delete_node") && !input.nodeId) ctx.addIssue({ code: "custom", path: ["nodeId"], message: "nodeId is required." });
      if (input.action === "create_node" && (!input.parentId || !input.node)) ctx.addIssue({ code: "custom", path: ["node"], message: "parentId and node are required." });
      if (input.action === "update_node" && !input.patch) ctx.addIssue({ code: "custom", path: ["patch"], message: "patch is required." });
      if (input.action === "search" && !input.query) ctx.addIssue({ code: "custom", path: ["query"], message: "query is required." });
    }),
    annotations: { readOnly: false, destructive: true, idempotent: true },
    examples: [{ description: "更新节点详情", input: { action: "update_node", rootId: "root-id", nodeId: "node-id", patch: { details: "补充后的节点说明" } } }],
    verification: "所有写操作会读取相同的思维导图节点和关系，确认写入结果。",
    handler: async input => {
      const root = await deps.elements.get(input.rootId);
      if (!root) throw new RichMcpError("NOT_FOUND", "The mindmap root was not found.");
      const relations = (await deps.relations.list()).filter(relation => relation.kind === "child");
      const childrenByParent = new Map<string, string[]>();
      for (const relation of relations) childrenByParent.set(relation.from, [...(childrenByParent.get(relation.from) ?? []), relation.to]);
      const descendants = (startId: string) => {
        const result = new Set<string>([startId]); const queue = [startId];
        while (queue.length) for (const childId of childrenByParent.get(queue.shift()!) ?? []) if (!result.has(childId)) { result.add(childId); queue.push(childId); }
        return result;
      };
      const inMap = descendants(input.rootId);
      const getNode = async (id: string) => {
        if (!inMap.has(id)) throw new RichMcpError("NOT_FOUND", "The node was not found in this mindmap.");
        const node = await deps.elements.get(id); if (!node) throw new RichMcpError("NOT_FOUND", "The node was not found."); return node;
      };
      const tree = async (id: string): Promise<Record<string, unknown>> => {
        const node = await getNode(id);
        const children = relations.filter(item => item.from === id && inMap.has(item.to));
        return { ...nodeOf(node), children: await Promise.all(children.map(child => tree(child.to))) };
      };
      if (input.action === "get") return richSuccess("rich_mindmap_manage", { mindmap: await tree(input.rootId) }, { refs: [{ type: "mindmap", id: root.id, label: root.title }] });
      if (input.action === "search") {
        const query = input.query!.toLocaleLowerCase();
        const nodes = (await Promise.all([...inMap].map(async id => nodeOf(await getNode(id))))).filter(node => `${node.title} ${node.subtitle ?? ""} ${(node.tags ?? []).join(" ")} ${node.details}`.toLocaleLowerCase().includes(query));
        return richSuccess("rich_mindmap_manage", { nodes }, { refs: nodes.map(node => ({ type: "mindmapNode", id: node.id, label: node.title })) });
      }
      if (input.action === "create_node") return executeSafeWrite({
        toolName: "rich_mindmap_manage", operationRepo, context: input.context, options: input.options, inputForHash: input,
        changes: [{ operation: "create", resource: "mindmapNode", id: input.node!.id }],
        execute: async () => {
          await getNode(input.parentId!);
          const now = new Date().toISOString(); const id = input.node!.id ?? `mindmap-${randomUUID()}`;
          if (await deps.elements.get(id)) throw new RichMcpError("CONFLICT", "A node with this ID already exists.");
          const node: Element = { id, type: (input.node!.type ?? "concept") as Element["type"], title: input.node!.title, ...(input.node!.subtitle === undefined ? {} : { subtitle: input.node!.subtitle ?? undefined }), tags: input.node!.tags ?? [], content: { sections: [], ...(input.node!.details === undefined ? {} : { mindmapDetails: input.node!.details }) }, metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 } };
          await deps.elements.put(node); await deps.relations.append([{ id: `mindmap.${input.parentId}.${id}`, from: input.parentId!, to: id, kind: "child", createdAt: now } as Relation]); return { node: nodeOf(node) };
        }, verify: async ({ node }) => ({ status: (await deps.elements.get(node.id)) && (await deps.relations.list()).some(item => item.kind === "child" && item.from === input.parentId && item.to === node.id) ? "verified" : "failed", details: "Created node and parent relation were read back." }), refs: ({ node }) => [{ type: "mindmapNode", id: node.id, label: node.title }],
      });
      if (input.action === "update_node") return executeSafeWrite({
        toolName: "rich_mindmap_manage", operationRepo, context: input.context, options: input.options, inputForHash: input, changes: [{ operation: "update", resource: "mindmapNode", id: input.nodeId }],
        execute: async () => { const current = await getNode(input.nodeId!); const patch = input.patch as NodePatch; const saved: Element = { ...current, ...(patch.title === undefined ? {} : { title: patch.title }), ...(patch.subtitle === undefined ? {} : { subtitle: patch.subtitle ?? undefined }), ...(patch.tags === undefined ? {} : { tags: patch.tags }), ...(patch.type === undefined ? {} : { type: patch.type }), ...(patch.details === undefined ? {} : { content: { ...contentOf(current), mindmapDetails: patch.details } }), metadata: { ...current.metadata, updatedAt: new Date().toISOString() } }; await deps.elements.put(saved); return { node: nodeOf(saved) }; },
        verify: async ({ node }) => ({ status: (await deps.elements.get(node.id))?.metadata.updatedAt === node.updatedAt ? "verified" : "failed", details: "Updated node was read back." }), refs: ({ node }) => [{ type: "mindmapNode", id: node.id, label: node.title }],
      });
      return executeSafeWrite({
        toolName: "rich_mindmap_manage", operationRepo, context: input.context, options: input.options, destructive: true, inputForHash: input, changes: [{ operation: "delete", resource: "mindmapNode", id: input.nodeId }],
        execute: async () => { if (input.nodeId === input.rootId) throw new RichMcpError("VALIDATION_ERROR", "The mindmap root cannot be deleted."); await getNode(input.nodeId!); const deletedNodeIds = [...descendants(input.nodeId!)]; await deps.relations.removeForElements(deletedNodeIds); await deps.elements.removeMany(deletedNodeIds); return { deletedNodeIds }; },
        verify: async ({ deletedNodeIds }) => ({ status: (await Promise.all(deletedNodeIds.map(id => deps.elements.get(id)))).every(node => !node) ? "verified" : "failed", details: "Deleted nodes were checked for absence." }),
      });
    },
  });
}
