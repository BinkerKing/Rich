import { z } from "zod";
import { getProjectDictionaryInfo, saveProjectDictionaryInfo } from "../../modules/project-dictionary-info/projectDictionaryInfoService.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { ProjectManagementRepo } from "../../repos/ProjectManagementRepo.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

export function registerDictionaryInfoTools(
  registry: RichToolRegistry,
  repo: Pick<ProjectManagementRepo, "listModuleItems" | "createModuleItem" | "updateModuleItem">,
  operationRepo?: McpOperationRepo,
): void {
  registry.register({
    name: "rich_dictionary_info_manage",
    title: "Manage project dictionary information library",
    description: "Read or replace the project-level data dictionary information library. Use HTML produced for the Rich rich-text editor.",
    category: "manage",
    inputSchema: z.object({
      action: z.enum(["get", "update"]),
      projectId: z.string().trim().min(1),
      html: z.string().max(1_000_000).optional(),
      context: richContextSchema,
      options: richOptionsSchema,
    }).superRefine((input, issues) => {
      if (input.action === "update" && input.html === undefined) issues.addIssue({ code: "custom", path: ["html"], message: "html is required." });
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "Save the Mapping knowledge base.", input: { action: "update", projectId: "project-rich", html: "<h1>Mapping knowledge base</h1><p>...</p>", context: { requestId: "dictionary-info-1" } } }],
    verification: "Writes are verified by reading the saved information library back.",
    handler: async input => {
      if (input.action === "get") {
        const info = await getProjectDictionaryInfo(repo, input.projectId);
        return richSuccess("rich_dictionary_info_manage", { info }, { refs: [{ type: "dictionaryInfo", id: input.projectId, label: "数据字典信息库" }] });
      }
      return executeSafeWrite({
        toolName: "rich_dictionary_info_manage", operationRepo, context: input.context, options: input.options,
        inputForHash: input, changes: [{ operation: "update", resource: "dictionaryInfo", id: input.projectId }],
        execute: async () => ({ info: await saveProjectDictionaryInfo(repo, input.projectId, input.html!) }),
        verify: async result => {
          const current = await getProjectDictionaryInfo(repo, input.projectId);
          return { status: current.html === result.info.html ? "verified" : "failed", details: `Information library was read back after update (expected ${result.info.html.length} chars, got ${current.html.length}).` };
        },
        refs: () => [{ type: "dictionaryInfo", id: input.projectId, label: "数据字典信息库" }],
      });
    },
  });
}
