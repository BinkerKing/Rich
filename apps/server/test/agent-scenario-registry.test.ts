import { describe, expect, it, vi } from "vitest";
import { AiTaskDispatcher, type AiTaskExecutor } from "../src/ai-tasks/AiTaskDispatcher.js";
import { PersistentTaskService } from "../src/mcp-v2/tasks/persistentTaskService.js";
import type { McpTask, McpTaskListOptions, McpTaskRepo } from "../src/repos/McpTaskRepo.js";
import { DeliverableAnalysisScenario } from "../src/agent-scenarios/deliverableAnalysisScenario.js";
import { ScenarioRegistry } from "../src/agent-scenarios/ScenarioRegistry.js";

class MemoryTasks implements McpTaskRepo {
  tasks = new Map<string, McpTask>();
  create(task: McpTask) { this.tasks.set(task.id, structuredClone(task)); }
  get(id: string) { return structuredClone(this.tasks.get(id) ?? null); }
  list(options: McpTaskListOptions = {}) { return [...this.tasks.values()].filter(task => !options.status || task.status === options.status); }
  count(options: Pick<McpTaskListOptions, "status"> = {}) { return this.list(options).length; }
  save(task: McpTask) { this.tasks.set(task.id, structuredClone(task)); }
}

const input = {
  scenario: "deliverable_analysis",
  projectId: "project-1",
  deliverableId: "deliverable-1",
  executor: "hermes",
  instructions: "Analyse the report",
  acceptanceCriteria: [],
  contextSnapshot: {
    version: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    deliverable: { folderPath: "07-交付/report", requirementHtml: "" },
    records: [],
    files: [],
  },
};

describe("ScenarioRegistry", () => {
  it("registers the deliverable scenario and its task-scoped tools", () => {
    const registry = new ScenarioRegistry([new DeliverableAnalysisScenario()]);
    expect(registry.get("deliverable_analysis").toolManifest).toEqual([
      "rich_task_context_get",
      "rich_deliverable_history_get",
      "rich_task_report_result",
    ]);
  });

  it("rejects an unknown scenario before persisting a task", async () => {
    const repo = new MemoryTasks();
    const executor: AiTaskExecutor = { executor: "hermes", available: vi.fn(async () => true), execute: vi.fn() };
    const dispatcher = new AiTaskDispatcher(
      new PersistentTaskService(repo),
      [executor],
      undefined,
      new ScenarioRegistry([new DeliverableAnalysisScenario()]),
    );

    await expect(dispatcher.publish({ ...input, scenario: "missing" })).rejects.toThrow(/unknown AI task scenario/i);
    expect(repo.tasks.size).toBe(0);
  });

  it("persists the selected scenario with the task request", async () => {
    const executor: AiTaskExecutor = { executor: "hermes", available: vi.fn(async () => true), execute: vi.fn() };
    const dispatcher = new AiTaskDispatcher(
      new PersistentTaskService(new MemoryTasks()),
      [executor],
      undefined,
      new ScenarioRegistry([new DeliverableAnalysisScenario()]),
    );

    const task = await dispatcher.publish(input);
    expect(task.request).toMatchObject({ scenario: "deliverable_analysis" });
  });
});
