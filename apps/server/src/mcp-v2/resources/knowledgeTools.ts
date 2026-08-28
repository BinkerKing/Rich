import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Element } from "@ke/domain";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

export function registerKnowledgeTools(
  registry: RichToolRegistry,
  elements: ElementsRepo,
  operationRepo?: McpOperationRepo,
): void {
  registry.register({
    name: "rich_knowledge_manage",
    title: "Manage Rich knowledge",
    description: "Read a specific knowledge record or list filtered knowledge records. Use precise actions after the target resource is known.",
    category: "manage",
    inputSchema: z.object({
      action: z.enum(["get", "list", "create", "update", "delete"]),
      id: z.string().trim().min(1).optional(),
      type: z.string().trim().min(1).optional(),
      tag: z.string().trim().min(1).optional(),
      input: z.object({
        title: z.string().trim().min(1).max(280).optional(),
        type: z.string().trim().min(1).optional(),
        subtitle: z.string().max(280).nullable().optional(),
        domain: z.string().max(80).nullable().optional(),
        tags: z.array(z.string().min(1).max(80)).max(30).optional(),
        content: z.unknown().optional(),
      }).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      context: richContextSchema,
      options: richOptionsSchema,
    }).superRefine((input, issueContext) => {
      if (input.action === "get" && !input.id) {
        issueContext.addIssue({ code: "custom", path: ["id"], message: "id is required for get." });
      }
      if ((input.action === "update" || input.action === "delete") && !input.id) {
        issueContext.addIssue({ code: "custom", path: ["id"], message: `id is required for ${input.action}.` });
      }
      if (input.action === "create" && (!input.input?.title || !input.input.type)) {
        issueContext.addIssue({ code: "custom", path: ["input"], message: "input.title and input.type are required for create." });
      }
      if (input.action === "update" && !input.input) {
        issueContext.addIssue({ code: "custom", path: ["input"], message: "input is required for update." });
      }
    }),
    annotations: { readOnly: false, destructive: true, idempotent: true },
    examples: [
      { description: "Get one knowledge record.", input: { action: "get", id: "knowledge-mcp" } },
      { description: "List concept records tagged MCP.", input: { action: "list", type: "concept", tag: "MCP" } },
    ],
    verification: "The returned item IDs come directly from the knowledge repository.",
    handler: async ({ action, id, type, tag, input, limit, context, options }) => {
      if (action === "get") {
        const item = await elements.get(id!);
        if (!item) throw new RichMcpError("NOT_FOUND", `Knowledge record ${id} was not found.`);
        return richSuccess("rich_knowledge_manage", { item }, {
          refs: [{ type: "knowledge", id: item.id, label: item.title }],
        });
      }
      if (action === "create") {
        return executeSafeWrite({
          toolName: "rich_knowledge_manage",
          operationRepo,
          context,
          options,
          inputForHash: { action, input },
          changes: [{ operation: "create", resource: "knowledge" }],
          execute: async () => {
            const now = new Date().toISOString();
            const item: Element = {
              id: `knowledge-${randomUUID()}`,
              type: input!.type as Element["type"],
              title: input!.title!,
              ...(input!.subtitle === undefined ? {} : { subtitle: input!.subtitle ?? undefined }),
              ...(input!.domain === undefined ? {} : { domain: input!.domain ?? undefined }),
              tags: input!.tags ?? [],
              content: input!.content ?? { sections: [] },
              metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
            };
            await elements.put(item);
            return { item };
          },
          verify: async result => ({
            status: await elements.get(result.item.id) ? "verified" : "failed",
            details: "Knowledge record was read back after creation.",
          }),
          refs: result => [{ type: "knowledge", id: result.item.id, label: result.item.title }],
        });
      }
      if (action === "update") {
        const current = await elements.get(id!);
        if (!current) throw new RichMcpError("NOT_FOUND", `Knowledge record ${id} was not found.`);
        return executeSafeWrite({
          toolName: "rich_knowledge_manage",
          operationRepo,
          context,
          options,
          inputForHash: { action, id, input },
          changes: [{ operation: "update", resource: "knowledge", id }],
          execute: async () => {
            const item: Element = {
              ...current,
              ...(input!.title === undefined ? {} : { title: input!.title }),
              ...(input!.type === undefined ? {} : { type: input!.type as Element["type"] }),
              ...(input!.subtitle === undefined ? {} : { subtitle: input!.subtitle ?? undefined }),
              ...(input!.domain === undefined ? {} : { domain: input!.domain ?? undefined }),
              ...(input!.tags === undefined ? {} : { tags: input!.tags }),
              ...(input!.content === undefined ? {} : { content: input!.content }),
              metadata: { ...current.metadata, updatedAt: new Date().toISOString() },
            };
            await elements.put(item);
            return { item };
          },
          verify: async result => {
            const saved = await elements.get(result.item.id);
            return {
              status: saved && saved.metadata.updatedAt === result.item.metadata.updatedAt ? "verified" : "failed",
              details: "Knowledge record was read back after update.",
            };
          },
          refs: result => [{ type: "knowledge", id: result.item.id, label: result.item.title }],
        });
      }
      if (action === "delete") {
        const current = await elements.get(id!);
        if (!current) throw new RichMcpError("NOT_FOUND", `Knowledge record ${id} was not found.`);
        return executeSafeWrite({
          toolName: "rich_knowledge_manage",
          operationRepo,
          context,
          options,
          destructive: true,
          inputForHash: { action, id },
          changes: [{ operation: "delete", resource: "knowledge", id }],
          execute: async () => {
            await elements.removeMany([id!]);
            return { id: id!, deleted: true };
          },
          verify: async result => ({
            status: await elements.get(result.id) ? "failed" : "verified",
            details: "Knowledge record absence was checked after deletion.",
          }),
        });
      }
      const all = await elements.list();
      const normalizedTag = tag?.toLocaleLowerCase();
      const items = all
        .filter(item => !type || item.type === type)
        .filter(item => !normalizedTag || item.tags?.some(itemTag => itemTag.toLocaleLowerCase() === normalizedTag))
        .slice(0, limit)
        .map(item => ({
          id: item.id,
          type: item.type,
          title: item.title,
          subtitle: item.subtitle,
          tags: item.tags,
          updatedAt: item.metadata?.updatedAt,
        }));
      return richSuccess("rich_knowledge_manage", { items }, {
        refs: items.map(item => ({ type: "knowledge", id: item.id, label: item.title })),
      });
    },
  });
}
