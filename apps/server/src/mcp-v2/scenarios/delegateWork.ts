import { z } from "zod";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { WorkDelegationPort } from "../delegation/WorkDelegationPort.js";
import { RichMcpError } from "../registry/errors.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "../resources/schemas.js";
import type { PersistentTaskService } from "../tasks/persistentTaskService.js";
import { registerCaptureLearningTool } from "./captureLearning.js";
import { registerReviewWorkResultTool } from "./reviewWorkResult.js";

const refSchema = z.object({ type: z.string().min(1), id: z.string().min(1), label: z.string().optional() });

export interface DelegationToolDeps {
  adapter: WorkDelegationPort;
  tasks: PersistentTaskService;
  elements: ElementsRepo;
  operationRepo?: McpOperationRepo;
}

export function registerDelegationTools(registry: RichToolRegistry, deps: DelegationToolDeps): void {
  registry.register({
    name: "rich_work_delegate", title: "委派工作给外部 Agent", category: "delegate",
    description: "把目标、验收标准和 Rich 上下文交给项目默认执行团队，由团队负责人选人，并在 Rich 建立可跟踪任务。",
    inputSchema: z.object({
      projectId: z.string().trim().min(1),
      title: z.string().trim().min(1).max(280), instructions: z.string().trim().min(1),
      acceptanceCriteria: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]),
      requiredCapabilities: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
      workingDirectory: z.string().trim().min(1).optional(),
      contextRefs: z.array(refSchema).max(50).default([]), context: richContextSchema, options: richOptionsSchema,
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "把实现任务交给 Codex，并在 Rich 跟踪", input: {
      projectId: "rich", title: "实现 MCP 任务看板", instructions: "按设计实现并运行测试",
      acceptanceCriteria: ["服务端测试通过"], requiredCapabilities: ["development"], context: { requestId: "delegate-1" },
    } }],
    verification: "Creates a local Rich task only after external delegation succeeds, then reads it back.",
    handler: input => executeSafeWrite({
      toolName: "rich_work_delegate", operationRepo: deps.operationRepo, context: input.context, options: input.options,
      inputForHash: input, changes: [{ operation: "create", resource: "work_task" }],
      execute: async () => {
        let receipt;
        try {
          receipt = await deps.adapter.delegate({
            projectId: input.projectId, title: input.title, instructions: input.instructions,
            acceptanceCriteria: input.acceptanceCriteria, requiredCapabilities: input.requiredCapabilities,
            workingDirectory: input.workingDirectory, contextRefs: input.contextRefs,
          });
        } catch (error) {
          if (error instanceof RichMcpError) throw error;
          throw new RichMcpError("TASK_FAILED", "The external Agent rejected or failed the delegation request.", {
            retryable: true, details: { cause: error instanceof Error ? error.message : "Unknown delegation failure" },
          });
        }
        let task = await deps.tasks.create({
          type: "agent", title: input.title, request: {
            projectId: input.projectId, instructions: input.instructions, acceptanceCriteria: input.acceptanceCriteria,
            requiredCapabilities: input.requiredCapabilities, workingDirectory: input.workingDirectory, contextRefs: input.contextRefs,
          },
          backend: deps.adapter.backend, externalTaskId: receipt.externalTaskId,
          conversationId: input.context?.conversationId, requestId: input.context?.requestId,
        });
        if (receipt.status && receipt.status !== "queued") {
          task = await deps.tasks.transition(task.id, receipt.status, { progressSummary: receipt.progressSummary });
        }
        return { task };
      },
      verify: async result => ({ status: (await deps.tasks.get(result.task.id)).externalTaskId === result.task.externalTaskId ? "verified" : "failed" }),
      refs: result => [{ type: "work_task", id: result.task.id, label: result.task.title }],
    }),
  });

  registerReviewWorkResultTool(registry, deps.tasks, deps.operationRepo);
  registerCaptureLearningTool(registry, deps.elements, deps.tasks, deps.operationRepo);
}
