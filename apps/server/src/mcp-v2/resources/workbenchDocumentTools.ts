import { z } from "zod";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { WorkbenchDocumentService, DocumentOperation } from "../../workbench-document/service.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { richSuccess } from "../registry/response.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

export function registerWorkbenchDocumentTools(registry: RichToolRegistry, documents: WorkbenchDocumentService, operationRepo: McpOperationRepo) {
  registry.register({
    name: "rich_workbench_document", title: "工作台文档：卡片与更新提议", category: "plan",
    description: "Read workbench documents and predefined modules. Agents may create empty heading outlines and submit substantive update proposals, but cannot accept proposals or save user drafts.",
    inputSchema: z.object({
      action: z.enum(["list", "get", "modules", "outline", "propose"]), documentId: z.string().min(1).optional(), expectedVersion: z.number().int().positive().optional(),
      input: z.object({ summary: z.string().optional(), operations: z.array(z.unknown()).optional() }).optional(), context: richContextSchema, options: richOptionsSchema,
    }).superRefine((value, ctx) => {
      if (["get", "outline", "propose"].includes(value.action) && !value.documentId) ctx.addIssue({ code: "custom", path: ["documentId"], message: "documentId required" });
      if (["outline", "propose"].includes(value.action) && !value.expectedVersion) ctx.addIssue({ code: "custom", path: ["expectedVersion"], message: "expectedVersion required" });
      if (["outline", "propose"].includes(value.action) && !value.input?.operations) ctx.addIssue({ code: "custom", path: ["input"], message: "operations required" });
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "Read a workbench document before proposing a substantive update.", input: { action: "get", documentId: "workbench-document-id" } }],
    verification: "Outline writes are read back from the document; proposals are persisted for user confirmation without changing the document.",
    handler: async ({ action, documentId, expectedVersion, input, context, options }) => {
      if (action === "list") return richSuccess("rich_workbench_document", { documents: await documents.repo.list() });
      if (action === "modules") return richSuccess("rich_workbench_document", { modules: (await import("../../workbench-document/moduleCatalog.js")).listWorkbenchModules() });
      if (action === "get") return richSuccess("rich_workbench_document", { document: await documents.get(documentId!) });
      const operations = input!.operations as DocumentOperation[];
      return executeSafeWrite({ toolName: "rich_workbench_document", operationRepo, context, options, inputForHash: { action, documentId, expectedVersion, input }, changes: [{ operation: action, resource: "workbenchDocument", id: documentId }],
        execute: async () => action === "outline" ? documents.outline(documentId!, expectedVersion!, { operations }) : documents.propose(documentId!, expectedVersion!, { summary: input!.summary ?? "", operations }),
        verify: async result => ({ status: "verified", details: action === "outline" ? `Document version ${(result as { version: number }).version} saved.` : "Proposal persisted for user confirmation." }),
      });
    },
  });
}
