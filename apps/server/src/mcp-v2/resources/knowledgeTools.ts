import { z } from "zod";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

export function registerKnowledgeTools(registry: RichToolRegistry, elements: ElementsRepo): void {
  registry.register({
    name: "rich_knowledge_manage",
    title: "Manage Rich knowledge",
    description: "Read a specific knowledge record or list filtered knowledge records. Use precise actions after the target resource is known.",
    category: "manage",
    inputSchema: z.object({
      action: z.enum(["get", "list"]),
      id: z.string().trim().min(1).optional(),
      type: z.string().trim().min(1).optional(),
      tag: z.string().trim().min(1).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      context: richContextSchema,
      options: richOptionsSchema,
    }).superRefine((input, issueContext) => {
      if (input.action === "get" && !input.id) {
        issueContext.addIssue({ code: "custom", path: ["id"], message: "id is required for get." });
      }
    }),
    annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [
      { description: "Get one knowledge record.", input: { action: "get", id: "knowledge-mcp" } },
      { description: "List concept records tagged MCP.", input: { action: "list", type: "concept", tag: "MCP" } },
    ],
    verification: "The returned item IDs come directly from the knowledge repository.",
    handler: async ({ action, id, type, tag, limit }) => {
      if (action === "get") {
        const item = await elements.get(id!);
        if (!item) throw new RichMcpError("NOT_FOUND", `Knowledge record ${id} was not found.`);
        return richSuccess("rich_knowledge_manage", { item }, {
          refs: [{ type: "knowledge", id: item.id, label: item.title }],
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
