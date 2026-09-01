import { z } from "zod";
import { parseAiTaskRequest } from "../../ai-tasks/types.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import type { PersistentTaskService } from "./persistentTaskService.js";

function assertHermesTask(task: Awaited<ReturnType<PersistentTaskService["get"]>>) {
  const request = parseAiTaskRequest(task.request);
  if (request.executor !== "hermes" || task.backend !== "hermes") throw new RichMcpError("PERMISSION_DENIED", "This tool is only available to Hermes deliverable tasks.");
  if (task.status !== "running") throw new RichMcpError("CONFLICT", "The deliverable task is not running.");
  return request;
}

export function registerDeliverableTaskTools(registry: RichToolRegistry, tasks: PersistentTaskService): void {
  registry.register({
    name: "rich_task_context_get", title: "读取交付物任务上下文", category: "query",
    description: "读取指定 Hermes 交付物任务创建时冻结的要求、记录和材料目录。",
    inputSchema: z.object({ taskId: z.string().min(1) }), annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "读取当前任务的冻结上下文", input: { taskId: "task-id" } }], verification: "Returns only the snapshot persisted on the running task.",
    handler: async ({ taskId }) => {
      const task = await tasks.get(taskId); const request = assertHermesTask(task);
      return richSuccess("rich_task_context_get", { contextSnapshot: request.contextSnapshot }, { refs: [{ type: "work_task", id: task.id, label: task.title }] });
    },
  });
  registry.register({
    name: "rich_task_report_result", title: "回报交付物任务结果", category: "manage",
    description: "写入 Hermes 对交付物分析任务的摘要和证据，并将任务提交给人工复核。",
    inputSchema: z.object({ taskId: z.string().min(1), summary: z.string().trim().min(1).max(20_000), evidence: z.array(z.string().trim().min(1).max(1_000)).max(50).default([]) }),
    annotations: { readOnly: false, destructive: false, idempotent: true }, examples: [{ description: "提交分析结论等待人工复核", input: { taskId: "task-id", summary: "分析完成", evidence: ["source.xlsx"] } }], verification: "Reads the completed task and confirms it requires human review.",
    handler: async ({ taskId, summary, evidence }) => {
      const task = await tasks.get(taskId); assertHermesTask(task);
      const resultRefs = [{ type: "analysis_result", id: task.id, label: summary }, ...evidence.map(id => ({ type: "evidence", id }))];
      const completed = await tasks.transition(task.id, "succeeded", { progressSummary: summary, resultRefs, reviewStatus: "needs_human" });
      return richSuccess("rich_task_report_result", { task: completed }, { refs: [{ type: "work_task", id: completed.id, label: completed.title }] });
    },
  });
}
