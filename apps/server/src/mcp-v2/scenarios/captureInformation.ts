import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Element } from "@ke/domain";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "../resources/schemas.js";

export function registerCaptureInformationTool(registry: RichToolRegistry, elements: ElementsRepo, operationRepo?: McpOperationRepo): void {
  registry.register({
    name: "rich_knowledge_capture", title: "沉淀对话信息", category: "capture",
    description: "把对话中的事实、想法、决定、需求或经验整理成可追溯的 Rich 知识记录。",
    inputSchema: z.object({
      title: z.string().trim().min(1).max(280),
      kind: z.enum(["fact", "idea", "decision", "requirement", "learning", "note"]),
      summary: z.string().trim().min(1),
      details: z.array(z.string().trim().min(1)).max(50).default([]),
      tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
      source: z.object({ conversationId: z.string().min(1), messageIds: z.array(z.string().min(1)).max(50).default([]) }),
      context: richContextSchema,
      options: richOptionsSchema,
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "把对话中确认的架构决定沉淀到 Rich", input: {
      title: "采用场景型 MCP", kind: "decision", summary: "减少原子工具数量。",
      source: { conversationId: "chat-1" }, context: { requestId: "capture-1" },
    } }],
    verification: "Reads the created knowledge record back by ID.",
    handler: input => executeSafeWrite({
      toolName: "rich_knowledge_capture", operationRepo, context: input.context, options: input.options,
      inputForHash: input, changes: [{ operation: "create", resource: "knowledge" }],
      execute: async () => {
        const now = new Date().toISOString();
        const item: Element = {
          id: `knowledge-${randomUUID()}`, type: "knowledge", title: input.title, tags: input.tags,
          content: { kind: input.kind, summary: input.summary, details: input.details, source: input.source },
          metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
        };
        await elements.put(item);
        return { item };
      },
      verify: async result => ({ status: await elements.get(result.item.id) ? "verified" : "failed", details: "Knowledge record was read back after capture." }),
      refs: result => [{ type: "knowledge", id: result.item.id, label: result.item.title }],
    }),
  });
}
