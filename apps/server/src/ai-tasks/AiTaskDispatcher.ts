import type { McpTask } from "../repos/McpTaskRepo.js";
import { PersistentTaskService } from "../mcp-v2/tasks/persistentTaskService.js";
import { parseAiTaskRequest, type AiTaskExecutor as AiTaskExecutorName, type AiTaskRequest } from "./types.js";

export interface AiTaskExecutor {
  executor: AiTaskExecutorName;
  available(projectId: string): Promise<boolean>;
  execute(task: McpTask): Promise<{ externalTaskId?: string; progressSummary?: string } | void>;
}

export class AiTaskDispatcher {
  private readonly executors = new Map<AiTaskExecutorName, AiTaskExecutor>();

  constructor(private readonly tasks: PersistentTaskService, executors: AiTaskExecutor[]) {
    for (const executor of executors) this.executors.set(executor.executor, executor);
  }

  async publish(input: unknown): Promise<McpTask> {
    const request = parseAiTaskRequest(input);
    const executor = this.executors.get(request.executor);
    if (!executor || !await executor.available(request.projectId)) throw new Error(`AI executor ${request.executor} is unavailable.`);
    return this.tasks.create({
      type: "deliverable-ai-task",
      title: request.instructions.slice(0, 160),
      request,
      backend: request.executor,
    });
  }

  async drain(taskId: string): Promise<McpTask> {
    const task = await this.tasks.get(taskId);
    const request = parseAiTaskRequest(task.request) as AiTaskRequest;
    const executor = this.executors.get(request.executor);
    if (!executor) throw new Error(`AI executor ${request.executor} is not configured.`);
    const running = task.status === "queued" ? await this.tasks.transition(task.id, "running", { progressSummary: `Dispatched to ${request.executor}.` }) : task;
    if (running.status !== "running") return running;
    try {
      const result = await executor.execute(running);
      if (result?.externalTaskId) await this.tasks.bindExternal(task.id, request.executor, result.externalTaskId, result.progressSummary);
      return await this.tasks.get(task.id);
    } catch (error) {
      await this.tasks.transition(task.id, "failed", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}
