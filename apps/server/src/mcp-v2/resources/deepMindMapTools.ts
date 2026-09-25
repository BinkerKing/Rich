import { z } from "zod";
import type { DeepMindMapsRepo } from "../../repos/DeepMindMapsRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

const inputSchema = z.object({ action: z.enum(["get", "update_root_details"]), mapId: z.string().min(1), details: z.string().max(20000).optional(), context: richContextSchema, options: richOptionsSchema }).superRefine((value, ctx) => { if (value.action === "update_root_details" && value.details === undefined) ctx.addIssue({ code: "custom", path: ["details"], message: "details is required" }); });
export function registerDeepMindMapTools(registry: RichToolRegistry, repo: DeepMindMapsRepo | null): void {
  if (!repo) return;
  registry.register({ name: "rich_deep_mindmap_manage", title: "管理 DeepMindMap", category: "manage", description: "读取并维护 Postgres 持久化的 DeepMindMap；更新根节点详情时写后读回验证。", inputSchema, annotations: { readOnly: false, destructive: false, idempotent: true }, examples: [{ description: "写入主节点详情", input: { action: "update_root_details", mapId: "map-id", details: "<h2>需求</h2><p>已整理</p>" } }], verification: "Writes are read back from Postgres.", handler: async input => {
    const current = await repo.get(input.mapId); if (!current) throw new RichMcpError("NOT_FOUND", "The DeepMindMap was not found.");
    if (input.action === "get") return richSuccess("rich_deep_mindmap_manage", { mindmap: current }, { refs: [{ type: "deepmindmap", id: current.id, label: current.title }] });
    const root = current.map.root; if (!root || typeof root !== "object") throw new RichMcpError("VALIDATION_ERROR", "The DeepMindMap root is invalid.");
    const data = (root as { data?: Record<string, unknown> }).data; if (!data) throw new RichMcpError("VALIDATION_ERROR", "The DeepMindMap root data is invalid.");
    const saved = await repo.update(current.id, { title: current.title, map: { ...current.map, root: { ...(root as Record<string, unknown>), data: { ...data, details: input.details } } }, expectedUpdatedAt: current.updatedAt });
    if (!saved || saved === "conflict") throw new RichMcpError("CONFLICT", "The DeepMindMap changed before the update could be saved.");
    const verified = await repo.get(saved.id);
    if (!verified || (verified.map.root as { data?: { details?: unknown } } | undefined)?.data?.details !== input.details) throw new RichMcpError("INTERNAL_ERROR", "The DeepMindMap write could not be verified.");
    return richSuccess("rich_deep_mindmap_manage", { mindmap: verified }, { refs: [{ type: "deepmindmap", id: verified.id, label: verified.title }] });
  }});
}
