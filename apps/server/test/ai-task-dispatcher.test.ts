import { describe, expect, it, vi } from "vitest";
import { AiTaskDispatcher, type AiTaskExecutor } from "../src/ai-tasks/AiTaskDispatcher.js";
import { PersistentTaskService } from "../src/mcp-v2/tasks/persistentTaskService.js";
import type { McpTask, McpTaskListOptions, McpTaskRepo } from "../src/repos/McpTaskRepo.js";

class MemoryTasks implements McpTaskRepo {
  tasks = new Map<string, McpTask>();
  create(task: McpTask) { this.tasks.set(task.id, structuredClone(task)); }
  get(id: string) { return structuredClone(this.tasks.get(id) ?? null); }
  list(options: McpTaskListOptions = {}) { return [...this.tasks.values()].filter(task => !options.status || task.status === options.status); }
  count(options: Pick<McpTaskListOptions, "status"> = {}) { return this.list(options).length; }
  save(task: McpTask) { this.tasks.set(task.id, structuredClone(task)); }
}

describe("AiTaskDispatcher", () => {
  it("persists a Hermes task before invoking its executor", async () => {
    const executor: AiTaskExecutor = { executor: "hermes", available: vi.fn(async () => true), execute: vi.fn(async () => undefined) };
    const tasks = new PersistentTaskService(new MemoryTasks());
    const dispatcher = new AiTaskDispatcher(tasks, [executor]);
    const task = await dispatcher.publish({
      projectId: "project-1", deliverableId: "deliverable-1", executor: "hermes", instructions: "Create report", acceptanceCriteria: [],
      contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "" }, records: [], files: [] },
    });

    expect(task.status).toBe("queued");
    await dispatcher.drain(task.id);
    expect(executor.execute).toHaveBeenCalledWith(expect.objectContaining({ id: task.id, status: "running" }));
  });

  it("rejects an unavailable executor before creating a task", async () => {
    const executor: AiTaskExecutor = { executor: "multica", available: vi.fn(async () => false), execute: vi.fn() };
    const dispatcher = new AiTaskDispatcher(new PersistentTaskService(new MemoryTasks()), [executor]);
    await expect(dispatcher.publish({
      projectId: "project-1", deliverableId: "deliverable-1", executor: "multica", instructions: "Create report", acceptanceCriteria: [],
      contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "" }, records: [], files: [] },
    })).rejects.toThrow(/unavailable/i);
  });
});
