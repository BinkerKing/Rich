import { z } from "zod";
import type { ProjectManagementRepo } from "../../repos/ProjectManagementRepo.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
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

export function registerProjectTools(registry: RichToolRegistry, projects: ProjectManagementRepo): void {
  registry.register({
    name: "rich_project_manage",
    title: "Manage Rich projects",
    description: "Read a project summary, search project records, or list one project module. Use when the project and desired resource operation are explicit.",
    category: "manage",
    inputSchema: z.object({
      action: z.enum(["summary", "search", "list"]),
      projectId: z.string().trim().min(1),
      query: z.string().trim().min(1).optional(),
      moduleKey: projectModuleKeySchema.optional(),
      parentId: z.string().trim().min(1).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      context: richContextSchema,
      options: richOptionsSchema,
    }).superRefine((input, issueContext) => {
      if (input.action === "search" && !input.query) {
        issueContext.addIssue({ code: "custom", path: ["query"], message: "query is required for search." });
      }
      if (input.action === "list" && !input.moduleKey) {
        issueContext.addIssue({ code: "custom", path: ["moduleKey"], message: "moduleKey is required for list." });
      }
    }),
    annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [
      { description: "Get a project summary.", input: { action: "summary", projectId: "project-rich" } },
      { description: "List project todos.", input: { action: "list", projectId: "project-rich", moduleKey: "todos" } },
    ],
    verification: "Project data is read directly from the project-management repository.",
    handler: async ({ action, projectId, query, moduleKey, parentId, limit }) => {
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
      const items = await projects.listModuleItems(projectId, moduleKey!, parentId);
      return richSuccess("rich_project_manage", { items }, {
        refs: items.map(item => ({ type: "projectItem", id: item.id, label: item.title })),
      });
    },
  });
}
