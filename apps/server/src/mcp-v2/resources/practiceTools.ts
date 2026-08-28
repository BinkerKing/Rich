import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Element } from "@ke/domain";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

export function registerPracticeResourceTools(registry: RichToolRegistry, elements: ElementsRepo, operationRepo?: McpOperationRepo): void {
  registry.register({
    name: "rich_practice_manage",
    title: "Manage practice projects",
    description: "List, get, create, or update Rich practice-project records. Detailed child orchestration remains a scenario workflow.",
    category: "manage",
    inputSchema: z.object({
      action: z.enum(["list", "get", "create", "update"]),
      id: z.string().min(1).optional(),
      input: z.object({
        title: z.string().min(1).max(280).optional(),
        subtitle: z.string().max(280).nullable().optional(),
        tags: z.array(z.string().min(1).max(80)).max(30).optional(),
        content: z.unknown().optional(),
      }).optional(),
      context: richContextSchema,
      options: richOptionsSchema,
    }).superRefine((input, issues) => {
      if ((input.action === "get" || input.action === "update") && !input.id) issues.addIssue({ code: "custom", path: ["id"], message: "id is required." });
      if ((input.action === "create" || input.action === "update") && !input.input) issues.addIssue({ code: "custom", path: ["input"], message: "input is required." });
      if (input.action === "create" && !input.input?.title) issues.addIssue({ code: "custom", path: ["input", "title"], message: "title is required." });
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [
      { description: "List practice projects.", input: { action: "list" } },
      { description: "Create a practice project.", input: { action: "create", input: { title: "MCP 实战" }, context: { requestId: "create-practice-1" } } },
    ],
    verification: "Writes are verified by reading the practice element back.",
    handler: async ({ action, id, input, context, options }) => {
      if (action === "list") {
        const items = (await elements.list()).filter(item => item.type === "practice");
        return richSuccess("rich_practice_manage", { items }, { refs: items.map(item => ({ type: "practice", id: item.id, label: item.title })) });
      }
      if (action === "get") {
        const item = await elements.get(id!);
        if (!item || item.type !== "practice") throw new RichMcpError("NOT_FOUND", `Practice ${id} was not found.`);
        return richSuccess("rich_practice_manage", { item }, { refs: [{ type: "practice", id: item.id, label: item.title }] });
      }
      const current = action === "update" ? await elements.get(id!) : null;
      if (action === "update" && (!current || current.type !== "practice")) throw new RichMcpError("NOT_FOUND", `Practice ${id} was not found.`);
      return executeSafeWrite({
        toolName: "rich_practice_manage",
        operationRepo,
        context,
        options,
        inputForHash: { action, id, input },
        changes: [{ operation: action, resource: "practice", ...(id ? { id } : {}) }],
        execute: async () => {
          const now = new Date().toISOString();
          const item: Element = current
            ? {
                ...current,
                ...(input!.title === undefined ? {} : { title: input!.title }),
                ...(input!.subtitle === undefined ? {} : { subtitle: input!.subtitle ?? undefined }),
                ...(input!.tags === undefined ? {} : { tags: input!.tags }),
                ...(input!.content === undefined ? {} : { content: input!.content }),
                metadata: { ...current.metadata, updatedAt: now },
              }
            : {
                id: `practice-${randomUUID()}`,
                type: "practice",
                title: input!.title!,
                ...(input!.subtitle ? { subtitle: input!.subtitle } : {}),
                tags: input!.tags?.includes("实战项目") ? input!.tags : ["实战项目", ...(input!.tags ?? [])],
                content: input!.content ?? {},
                metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
              };
          await elements.put(item);
          return { item };
        },
        verify: async result => ({ status: await elements.get(result.item.id) ? "verified" : "failed", details: "Practice was read back after write." }),
        refs: result => [{ type: "practice", id: result.item.id, label: result.item.title }],
      });
    },
  });
}
