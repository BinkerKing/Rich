import { z } from "zod";
import type { WorkbenchService } from "../../task-workbench/service.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { richSuccess } from "../registry/response.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

export function registerWorkbenchTools(registry: RichToolRegistry, tasks: WorkbenchService, operationRepo: McpOperationRepo) {
  registry.register({
    name: "rich_workbench_manage", title: "任务工作台：需求、计划、步骤与成果", category: "plan",
    description: "Manage plan-based business tasks bound to a Rich Codex conversation (not runtime jobs). list/get/create/update/plan/step/record/resource/confirm/checkpoint/answer/history. Create requires input.title, requirement, conversationId (Rich conversation record ID). Mutations require taskId and expectedVersion from get. plan.input={steps:[{id,parentId?,title,goal,acceptance,status,evidence}]}; step.input={id,status,evidence}; record.input={stepId?,kind:progress|conclusion|decision|question,text,evidence?,resolved?}; resource.input={stepId?,kind:material|intermediate|final,title,format?:'file'|'link'|'information',location?,content?,version?,summary?}; confirm.input={target:requirement|plan,evidence:user's explicit confirmation}. checkpoint.input={id,stepId,title,description?,phase:before|during,required?,options?:[{value,label,allowsExecution}]}; no options means text input. answer.input={id,answer,answerMode?:option|text} only records an explicit user answer. Changing a checkpoint resets its answer. Never invent confirmation or completion. Returns task version after writes. Existing steps must be retained. create/update support prd (complete Markdown PRD, not a fragment) and requirementChangeSummary. When prd exists, requirement field changes must include an updated full prd. Executed steps are immutable; adapt only unexecuted steps, then reconfirm the plan. First answers supplement the PRD without revoking approval. Changed established answers revoke approval. update.requirementUpdateKind=supplement preserves existing approved scope and approval; change (default) invalidates approval. Any actual change to agreed scope/objectives/acceptance requires change, including contradictory first answers; do not classify those as supplements. Requirement versions are created only on explicit user confirmation.",
    inputSchema: z.object({
      action: z.enum(["list", "get", "create", "update", "plan", "step", "record", "resource", "confirm", "checkpoint", "answer", "history"]),
      taskId: z.string().min(1).optional(), expectedVersion: z.number().int().positive().optional(),
      input: z.record(z.string(), z.unknown()).optional(), context: richContextSchema, options: richOptionsSchema,
    }).superRefine((value, ctx) => {
      if (!["list", "create"].includes(value.action) && !value.taskId) ctx.addIssue({ code: "custom", path: ["taskId"], message: "taskId required" });
      if (!["list", "get", "history", "create"].includes(value.action) && !value.expectedVersion) ctx.addIssue({ code: "custom", path: ["expectedVersion"], message: "Read the task version before writing" });
      if (!["list", "get", "history"].includes(value.action) && !value.input) ctx.addIssue({ code: "custom", path: ["input"], message: "input required" });
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "Read the current task before updating a step.", input: { action: "get", taskId: "work-task-id" } }],
    verification: "Reads back the committed task version; this verifies persistence, not business correctness.",
    handler: async ({ action, taskId, expectedVersion, input, context, options }) => {
      if (action === "list") return richSuccess("rich_workbench_manage", { tasks: await tasks.list() });
      if (action === "get") return richSuccess("rich_workbench_manage", { task: await tasks.get(taskId!) });
      if (action === "history") { await tasks.get(taskId!); return richSuccess("rich_workbench_manage", { versions: await tasks.repo.history(taskId!) }); }
      return executeSafeWrite({
        toolName: "rich_workbench_manage", operationRepo, context, options, inputForHash: { action, taskId, expectedVersion, input },
        changes: [{ operation: action, resource: "workbenchTask", id: taskId }],
        execute: async () => ({ task: action === "create" ? await tasks.create(input) : await tasks.write(taskId!, { action, expectedVersion, input }) }),
        verify: async ({ task }) => ({ status: (await tasks.get(task.id)).version >= task.version ? "verified" : "failed", details: "Task version read back." }),
        refs: ({ task }) => [{ type: "workbenchTask", id: task.id, label: task.title }],
      });
    },
  });
}
