import { z } from "zod";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { RichMcpError } from "../registry/errors.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "../resources/schemas.js";
import type { PersistentTaskService } from "../tasks/persistentTaskService.js";

export function registerReviewWorkResultTool(registry: RichToolRegistry, tasks: PersistentTaskService, operationRepo?: McpOperationRepo): void {
  registry.register({
    name: "rich_work_review_result", title: "验收 Agent 工作结果", category: "review",
    description: "根据产物和验证结果，记录对已完成 Agent 任务的接受、拒绝或人工复核决定。",
    inputSchema: z.object({
      taskId: z.string().min(1), decision: z.enum(["accepted", "rejected", "needs_human"]),
      notes: z.string().trim().min(1), context: richContextSchema, options: richOptionsSchema,
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "接受测试通过的 Agent 结果", input: { taskId: "task-id", decision: "accepted", notes: "验收通过", context: { requestId: "review-1" } } }],
    verification: "Reads the review decision back from the persistent Rich task.",
    handler: input => executeSafeWrite({
      toolName: "rich_work_review_result", operationRepo, context: input.context, options: input.options,
      inputForHash: input, changes: [{ operation: "review", resource: "work_task", id: input.taskId }],
      execute: async () => {
        const current = await tasks.get(input.taskId);
        if (current.status !== "succeeded" && current.status !== "failed") {
          throw new RichMcpError("CONFLICT", "Only completed or failed work can be reviewed.");
        }
        return { task: await tasks.annotate(input.taskId, { reviewStatus: input.decision, reviewNotes: input.notes }) };
      },
      verify: async result => ({ status: (await tasks.get(input.taskId)).reviewStatus === result.task.reviewStatus ? "verified" : "failed" }),
      refs: result => [{ type: "work_task", id: result.task.id, label: result.task.title }],
    }),
  });
}
