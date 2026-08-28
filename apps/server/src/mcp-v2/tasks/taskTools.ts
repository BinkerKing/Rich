import { z } from "zod";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "../resources/schemas.js";
import type { PersistentTaskService } from "./persistentTaskService.js";

const statusSchema = z.enum(["queued", "running", "waiting_input", "succeeded", "failed", "cancelled"]);

export interface TaskToolDeps {
  tasks: PersistentTaskService;
  operationRepo?: McpOperationRepo;
}

export function registerTaskTools(registry: RichToolRegistry, deps: TaskToolDeps): void {
  registry.register({
    name: "rich_work_get_status", title: "查询工作任务", category: "query",
    description: "按 Rich 本地任务 ID 查询 Agent 工作状态、进度、结果与外部任务关联。",
    inputSchema: z.object({ taskId: z.string().min(1) }),
    annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "查询某个委派任务的最新状态", input: { taskId: "task-id" } }],
    verification: "Returns the task persisted in Rich.",
    handler: async ({ taskId }) => {
      const task = await deps.tasks.sync(taskId);
      return richSuccess("rich_work_get_status", { task }, { refs: [{ type: "work_task", id: task.id, label: task.title }] });
    },
  });

  registry.register({
    name: "rich_work_list", title: "列出工作任务", category: "query",
    description: "列出 Rich 工作看板中的任务，可按状态筛选。",
    inputSchema: z.object({ status: statusSchema.optional(), limit: z.number().int().min(1).max(200).optional() }),
    annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "列出进行中的 Agent 任务", input: { status: "running" } }],
    verification: "Returns tasks persisted in Rich ordered by latest update.",
    handler: async input => {
      const tasks = await deps.tasks.list(input);
      return richSuccess("rich_work_list", { tasks }, { refs: tasks.map(task => ({ type: "work_task", id: task.id, label: task.title })) });
    },
  });

  registry.register({
    name: "rich_work_cancel", title: "取消工作任务", category: "manage",
    description: "取消 Rich 工作任务。若存在外部 Agent 任务，会先取消外部任务，再更新本地状态。",
    inputSchema: z.object({ taskId: z.string().min(1), reason: z.string().min(1).optional(), context: richContextSchema, options: richOptionsSchema }),
    annotations: { readOnly: false, destructive: true, idempotent: true },
    examples: [{ description: "确认后取消一个 Agent 任务", input: { taskId: "task-id", context: { requestId: "cancel-1" }, options: { confirmDestructive: true } } }],
    verification: "Reads the task back and verifies that it is cancelled.",
    handler: input => executeSafeWrite({
      toolName: "rich_work_cancel", operationRepo: deps.operationRepo, context: input.context, options: input.options,
      inputForHash: input, destructive: true, changes: [{ operation: "cancel", resource: "work_task", id: input.taskId }],
      execute: async () => ({ task: await deps.tasks.cancel(input.taskId, input.reason) }),
      verify: async result => ({ status: (await deps.tasks.get(result.task.id)).status === "cancelled" ? "verified" : "failed" }),
      refs: result => [{ type: "work_task", id: result.task.id, label: result.task.title }],
    }),
  });
}
