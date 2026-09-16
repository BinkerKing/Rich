import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { WorkbenchDocumentService, DocumentOperation } from "../../workbench-document/service.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { richSuccess } from "../registry/response.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

export function registerWorkbenchDocumentTools(registry: RichToolRegistry, documents: WorkbenchDocumentService, operationRepo: McpOperationRepo) {
  registry.register({
    name: "rich_workbench_document", title: "工作台文档：卡片与更新提议", category: "plan",
    description: "Read workbench documents and predefined modules. Agents may create empty heading outlines and submit substantive update proposals, but cannot accept proposals or save user drafts. For outline, input.operations may use the concise form [{type:'heading', title:'章节标题', level?:1}] and Rich creates the stable IDs and empty cards. For proposals, use full operations or concise {type:'rich_text', text:'内容'} / {type:'module', title:'问题清单', content:{key:'question_list',rows:[...]}} cards.",
    inputSchema: z.object({
      action: z.enum(["list", "get", "modules", "outline", "propose"]), documentId: z.string().min(1).optional(), expectedVersion: z.number().int().positive().optional(),
      input: z.object({ summary: z.string().optional(), operations: z.array(z.unknown()).optional() }).optional(), context: richContextSchema, options: richOptionsSchema,
    }).superRefine((value, ctx) => {
      if (["get", "outline", "propose"].includes(value.action) && !value.documentId) ctx.addIssue({ code: "custom", path: ["documentId"], message: "documentId required" });
      if (["outline", "propose"].includes(value.action) && !value.expectedVersion) ctx.addIssue({ code: "custom", path: ["expectedVersion"], message: "expectedVersion required" });
      if (["outline", "propose"].includes(value.action) && !value.input?.operations) ctx.addIssue({ code: "custom", path: ["input"], message: "operations required" });
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [
      { description: "Read a workbench document before updating it.", input: { action: "get", documentId: "workbench-document-id" } },
      { description: "Create only empty document headings.", input: { action: "outline", documentId: "workbench-document-id", expectedVersion: 1, input: { operations: [{ type: "heading", title: "迁移范围与前置确认", level: 1 }] } } },
    ],
    verification: "Outline writes are read back from the document; proposals are persisted for user confirmation without changing the document.",
    handler: async ({ action, documentId, expectedVersion, input, context, options }) => {
      if (action === "list") return richSuccess("rich_workbench_document", { documents: await documents.repo.list() });
      if (action === "modules") return richSuccess("rich_workbench_document", { modules: (await import("../../workbench-document/moduleCatalog.js")).listWorkbenchModules() });
      if (action === "get") return richSuccess("rich_workbench_document", { document: await documents.get(documentId!) });
      const operations = normalizeOperations(input!.operations ?? []);
      return executeSafeWrite({ toolName: "rich_workbench_document", operationRepo, context, options, inputForHash: { action, documentId, expectedVersion, input }, changes: [{ operation: action, resource: "workbenchDocument", id: documentId }],
        execute: async () => action === "outline" ? documents.outline(documentId!, expectedVersion!, { operations }) : documents.propose(documentId!, expectedVersion!, { summary: input!.summary ?? "", operations }),
        verify: async result => ({ status: "verified", details: action === "outline" ? `Document version ${(result as { version: number }).version} saved.` : "Proposal persisted for user confirmation." }),
      });
    },
  });
}

function normalizeOperations(input: unknown[]): DocumentOperation[] {
  return input.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("操作必须是对象");
    const operation = value as Record<string, unknown>;
    if (operation.type === "heading" && typeof operation.title === "string") {
      return { type: "insert", index, card: { id: `workbench-card-${randomUUID()}`, type: "heading", order: index, title: operation.title, content: null, properties: {} } };
    }
    if (operation.type === "insertCard" && isHeadingCard(operation.card)) {
      return { type: "insert", index, card: { id: `workbench-card-${randomUUID()}`, type: "heading", order: index, title: operation.card.content.text, content: null, properties: {} } };
    }
    if (operation.type === "rich_text" && typeof operation.text === "string") {
      return { type: "insert", index, card: { id: `workbench-card-${randomUUID()}`, type: "rich_text", order: index, content: operation.text, properties: {} } };
    }
    if (operation.type === "module" && typeof operation.title === "string") {
      return { type: "insert", index, card: { id: `workbench-card-${randomUUID()}`, type: "module", order: index, title: operation.title, content: operation.content ?? null, properties: {} } };
    }
    return operation as unknown as DocumentOperation;
  });
}

function isHeadingCard(value: unknown): value is { type: "heading"; content: { text: string } } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const card = value as Record<string, unknown>;
  if (card.type !== "heading" || !card.content || typeof card.content !== "object" || Array.isArray(card.content)) return false;
  return typeof (card.content as Record<string, unknown>).text === "string";
}
