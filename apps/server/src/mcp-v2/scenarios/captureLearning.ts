import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Element } from "@ke/domain";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "../resources/schemas.js";
import type { PersistentTaskService } from "../tasks/persistentTaskService.js";

export function registerCaptureLearningTool(
  registry: RichToolRegistry,
  elements: ElementsRepo,
  tasks: PersistentTaskService,
  operationRepo?: McpOperationRepo,
): void {
  registry.register({
    name: "rich_learning_capture", title: "沉淀 Agent 工作经验", category: "capture",
    description: "把 Agent 任务中可复用的做法、陷阱和验证方式沉淀为 Rich 知识，并保留来源任务引用。",
    inputSchema: z.object({
      taskId: z.string().min(1), title: z.string().trim().min(1).max(280), learning: z.string().trim().min(1),
      applicability: z.string().trim().min(1).optional(), tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
      context: richContextSchema, options: richOptionsSchema,
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "把一次任务中的 SQLite 处理经验沉淀下来", input: {
      taskId: "task-id", title: "重建 SQLite 原生模块", learning: "切换 Node 后执行 rebuild。", context: { requestId: "learning-1" },
    } }],
    verification: "Reads the learning record back and keeps a source work-task reference.",
    handler: input => executeSafeWrite({
      toolName: "rich_learning_capture", operationRepo, context: input.context, options: input.options,
      inputForHash: input, changes: [{ operation: "create", resource: "knowledge" }],
      execute: async () => {
        const task = await tasks.get(input.taskId);
        const now = new Date().toISOString();
        const item: Element = {
          id: `learning-${randomUUID()}`, type: "knowledge", title: input.title, tags: input.tags,
          content: { kind: "learning", learning: input.learning, applicability: input.applicability, sourceTask: { id: task.id, title: task.title } },
          metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", richness: 1 },
        };
        await elements.put(item);
        return { item, task };
      },
      verify: async result => ({ status: await elements.get(result.item.id) ? "verified" : "failed", details: "Learning record was read back after capture." }),
      refs: result => [
        { type: "knowledge", id: result.item.id, label: result.item.title },
        { type: "work_task", id: result.task.id, label: result.task.title },
      ],
    }),
  });
}
