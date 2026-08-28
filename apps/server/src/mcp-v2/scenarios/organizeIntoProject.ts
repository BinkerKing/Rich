import { z } from "zod";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { ProjectManagementModuleKey, ProjectManagementRepo, ProjectModuleItemInput } from "../../repos/ProjectManagementRepo.js";
import { executeIdempotently } from "../registry/idempotency.js";
import { richFailure, richSuccess } from "../registry/response.js";
import type { RichToolChange } from "../registry/types.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { richContextSchema, richOptionsSchema } from "../resources/schemas.js";

const decisionSchema = z.object({ title: z.string().trim().min(1).max(280), detail: z.string().trim().min(1).optional() });
const todoSchema = z.object({
  title: z.string().trim().min(1).max(280), detail: z.string().trim().min(1).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(), dueAt: z.string().trim().min(1).optional(),
});

export function registerOrganizeIntoProjectTool(registry: RichToolRegistry, projects: ProjectManagementRepo, operationRepo?: McpOperationRepo): void {
  registry.register({
    name: "rich_project_organize_conversation", title: "整理对话到项目", category: "capture",
    description: "一次把对话摘要、已确认决定和待办分别整理到 Rich 项目的适当信息结构中。",
    inputSchema: z.object({
      projectId: z.string().trim().min(1),
      conversation: z.object({ id: z.string().min(1).optional(), summary: z.string().trim().min(1) }),
      decisions: z.array(decisionSchema).max(30).default([]),
      todos: z.array(todoSchema).max(50).default([]),
      context: richContextSchema,
      options: richOptionsSchema,
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "把本轮对话的结论和任务整理进 Rich 项目", input: {
      projectId: "rich", conversation: { id: "chat-1", summary: "确认 MCP 2.0 方案" },
      decisions: [{ title: "按场景组织工具" }], todos: [{ title: "实现委派端口" }], context: { requestId: "organize-1" },
    } }],
    verification: "Reads all created project records back from their modules.",
    handler: async input => {
      const intended = buildItems(input.conversation, input.decisions, input.todos);
      const changes: RichToolChange[] = intended.map(item => ({ operation: "create", resource: `project.${item.moduleKey}` }));
      if (input.options?.dryRun) {
        return richSuccess("rich_project_organize_conversation", { dryRun: true, intended }, {
          changes, verification: { status: "skipped", details: "Dry-run; no project records were written." },
        });
      }
      if (!operationRepo) {
        return richFailure("rich_project_organize_conversation", {
          code: "DEPENDENCY_UNAVAILABLE", message: "Persistent MCP operation storage is not configured.", retryable: true,
        });
      }
      return executeIdempotently(operationRepo, {
        toolName: "rich_project_organize_conversation", requestId: input.context?.requestId ?? "", input,
      }, async () => {
        const items = [];
        const failed: Array<{ moduleKey: ProjectManagementModuleKey; title: string; error: string }> = [];
        for (const item of intended) {
          try {
            items.push(await projects.createModuleItem(input.projectId, item));
          } catch (error) {
            failed.push({ moduleKey: item.moduleKey, title: item.title, error: error instanceof Error ? error.message : "Unknown write failure" });
          }
        }
        const refs = items.map(item => ({ type: "projectItem", id: item.id, label: item.title }));
        if (failed.length > 0) {
          return richFailure("rich_project_organize_conversation", {
            code: "TASK_FAILED", message: "Some conversation records could not be organized into the project.", retryable: true,
            details: { failed, createdIds: items.map(item => item.id) },
          }, { refs, changes, verification: { status: "failed", details: `${items.length} created; ${failed.length} failed.` }, warnings: ["发生部分写入；请保留 createdIds，仅重试失败记录。"] });
        }
        const modules = new Set(intended.map(item => item.moduleKey));
        const saved = (await Promise.all(Array.from(modules).map(moduleKey => projects.listAllModuleItems(input.projectId, moduleKey)))).flat();
        const verified = items.every(item => saved.some(candidate => candidate.id === item.id));
        return richSuccess("rich_project_organize_conversation", { items }, {
          refs, changes, verification: { status: verified ? "verified" : "failed", details: "Created records were read back from project modules." },
        });
      });
    },
  });
}

function buildItems(
  conversation: { id?: string; summary: string },
  decisions: Array<{ title: string; detail?: string }>,
  todos: Array<{ title: string; detail?: string; priority?: string; dueAt?: string }>,
): ProjectModuleItemInput[] {
  const source = conversation.id ? { conversationId: conversation.id } : {};
  return [
    { moduleKey: "description", title: `对话摘要：${conversation.summary.slice(0, 80)}`, content: { summary: conversation.summary, source } },
    ...decisions.map(decision => ({ moduleKey: "scenarios" as const, title: decision.title, subtitle: decision.detail, content: { kind: "decision", detail: decision.detail, source } })),
    ...todos.map(todo => ({ moduleKey: "todos" as const, title: todo.title, subtitle: todo.detail, content: { detail: todo.detail, priority: todo.priority, dueAt: todo.dueAt, source } })),
  ];
}
