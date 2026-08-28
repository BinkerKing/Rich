import { z } from "zod";
import type { ProjectManagementRepo } from "../../repos/ProjectManagementRepo.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

const projectModuleKeySchema = z.enum([
  "description",
  "dictionary",
  "automation",
  "workflow",
  "scenarios",
  "environments",
  "deploymentSteps",
  "monitoring",
  "codeVersions",
  "todos",
  "folder",
]);

export function registerProjectTools(
  registry: RichToolRegistry,
  projects: ProjectManagementRepo,
  operationRepo?: McpOperationRepo,
): void {
  registry.register({
    name: "rich_project_manage",
    title: "Manage Rich projects",
    description: "Read a project summary, search project records, or list one project module. Use when the project and desired resource operation are explicit.",
    category: "manage",
    inputSchema: z.object({
      action: z.enum(["summary", "search", "list", "create_item", "update_item", "delete_item"]),
      projectId: z.string().trim().min(1),
      id: z.string().trim().min(1).optional(),
      query: z.string().trim().min(1).optional(),
      moduleKey: projectModuleKeySchema.optional(),
      parentId: z.string().trim().min(1).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      input: z.object({
        title: z.string().max(280).optional(),
        subtitle: z.string().max(280).nullable().optional(),
        parentId: z.string().min(1).nullable().optional(),
        sortOrder: z.number().int().optional(),
        content: z.record(z.string(), z.unknown()).optional(),
      }).optional(),
      context: richContextSchema,
      options: richOptionsSchema,
    }).superRefine((input, issueContext) => {
      if (input.action === "search" && !input.query) {
        issueContext.addIssue({ code: "custom", path: ["query"], message: "query is required for search." });
      }
      if (input.action === "list" && !input.moduleKey) {
        issueContext.addIssue({ code: "custom", path: ["moduleKey"], message: "moduleKey is required for list." });
      }
      if (input.action === "create_item" && (!input.moduleKey || !input.input?.title)) {
        issueContext.addIssue({ code: "custom", path: ["input"], message: "moduleKey and input.title are required for create_item." });
      }
      if ((input.action === "update_item" || input.action === "delete_item") && (!input.moduleKey || !input.id)) {
        issueContext.addIssue({ code: "custom", path: ["id"], message: `moduleKey and id are required for ${input.action}.` });
      }
      if (input.action === "update_item" && !input.input) {
        issueContext.addIssue({ code: "custom", path: ["input"], message: "input is required for update_item." });
      }
    }),
    annotations: { readOnly: false, destructive: true, idempotent: true },
    examples: [
      { description: "Get a project summary.", input: { action: "summary", projectId: "project-rich" } },
      { description: "List project todos.", input: { action: "list", projectId: "project-rich", moduleKey: "todos" } },
    ],
    verification: "Project data is read directly from the project-management repository.",
    handler: async ({ action, projectId, id, query, moduleKey, parentId, limit, input, context, options }) => {
      if (action === "summary") {
        const summary = await projects.getSummary(projectId);
        return richSuccess("rich_project_manage", { summary }, {
          refs: [{ type: "project", id: projectId }],
        });
      }
      if (action === "search") {
        const results = await projects.searchAll(projectId, query!, limit);
        return richSuccess("rich_project_manage", { results }, {
          refs: results.map(result => ({ type: "projectItem", id: result.entityId, label: result.title })),
        });
      }
      if (action === "create_item") {
        return executeSafeWrite({
          toolName: "rich_project_manage",
          operationRepo,
          context,
          options,
          inputForHash: { action, projectId, moduleKey, input },
          changes: [{ operation: "create", resource: "projectItem" }],
          execute: async () => ({ item: await projects.createModuleItem(projectId, {
            moduleKey: moduleKey!,
            title: input!.title!,
            subtitle: input!.subtitle,
            parentId: input!.parentId,
            sortOrder: input!.sortOrder,
            content: input!.content,
          }) }),
          verify: async result => {
            const items = await projects.listAllModuleItems(projectId, moduleKey!);
            return { status: items.some(item => item.id === result.item.id) ? "verified" : "failed", details: "Project item was read back after creation." };
          },
          refs: result => [{ type: "projectItem", id: result.item.id, label: result.item.title }],
        });
      }
      if (action === "update_item") {
        return executeSafeWrite({
          toolName: "rich_project_manage",
          operationRepo,
          context,
          options,
          inputForHash: { action, projectId, id, moduleKey, input },
          changes: [{ operation: "update", resource: "projectItem", id }],
          execute: async () => {
            const item = await projects.updateModuleItem(projectId, id!, input!);
            if (!item) throw new RichMcpError("NOT_FOUND", `Project item ${id} was not found.`);
            return { item };
          },
          verify: async result => {
            const items = await projects.listAllModuleItems(projectId, moduleKey!);
            return { status: items.some(item => item.id === result.item.id && item.updatedAt === result.item.updatedAt) ? "verified" : "failed", details: "Project item was read back after update." };
          },
          refs: result => [{ type: "projectItem", id: result.item.id, label: result.item.title }],
        });
      }
      if (action === "delete_item") {
        return executeSafeWrite({
          toolName: "rich_project_manage",
          operationRepo,
          context,
          options,
          destructive: true,
          inputForHash: { action, projectId, id, moduleKey },
          changes: [{ operation: "delete", resource: "projectItem", id }],
          execute: async () => {
            const deleted = await projects.deleteModuleItem(projectId, id!);
            if (!deleted) throw new RichMcpError("NOT_FOUND", `Project item ${id} was not found.`);
            return { id: id!, deleted };
          },
          verify: async result => {
            const items = await projects.listAllModuleItems(projectId, moduleKey!);
            return { status: items.some(item => item.id === result.id) ? "failed" : "verified", details: "Project item absence was checked after deletion." };
          },
        });
      }
      const items = await projects.listModuleItems(projectId, moduleKey!, parentId);
      return richSuccess("rich_project_manage", { items }, {
        refs: items.map(item => ({ type: "projectItem", id: item.id, label: item.title })),
      });
    },
  });
}
