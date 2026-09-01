import { describe, expect, it } from "vitest";
import { registerDeliverableTaskTools } from "../src/mcp-v2/tasks/deliverableTaskTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import { PersistentTaskService } from "../src/mcp-v2/tasks/persistentTaskService.js";
import type { McpTask, McpTaskListOptions, McpTaskRepo } from "../src/repos/McpTaskRepo.js";

class MemoryTasks implements McpTaskRepo { tasks = new Map<string, McpTask>(); create(task: McpTask) { this.tasks.set(task.id, task); } get(id: string) { return this.tasks.get(id) ?? null; } list(_?: McpTaskListOptions) { return [...this.tasks.values()]; } count() { return this.tasks.size; } save(task: McpTask) { this.tasks.set(task.id, task); } }

describe("deliverable task MCP tools", () => {
  it("returns frozen context and records a Hermes result for human review", async () => {
    const tasks = new PersistentTaskService(new MemoryTasks());
    const task = await tasks.create({ type: "deliverable-ai-task", title: "Report", backend: "hermes", request: { projectId: "p", deliverableId: "d", executor: "hermes", instructions: "Analyse", acceptanceCriteria: [], contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "<p>Requirement</p>" }, records: [], files: [] } } });
    await tasks.transition(task.id, "running");
    const registry = new RichToolRegistry(); registerDeliverableTaskTools(registry, tasks);
    const context = await registry.invoke("rich_task_context_get", { taskId: task.id });
    expect(context).toMatchObject({ ok: true, data: { contextSnapshot: { deliverable: { folderPath: "07-交付/report" } } } });
    const result = await registry.invoke("rich_task_report_result", { taskId: task.id, summary: "Analysis complete", evidence: ["source.xlsx"] });
    expect(result).toMatchObject({ ok: true, data: { task: { status: "succeeded", reviewStatus: "needs_human" } } });

    const followUp = await tasks.create({ type: "deliverable-ai-task", title: "Follow up", backend: "hermes", request: task.request });
    await tasks.transition(followUp.id, "running");
    const history = await registry.invoke("rich_deliverable_history_get", { taskId: followUp.id });
    expect(history).toMatchObject({ ok: true, data: { history: [expect.objectContaining({ id: task.id, summary: "Analysis complete" })] } });
  });

  it("allows a running Multica-assigned Agent to use the same task protocol", async () => {
    const tasks = new PersistentTaskService(new MemoryTasks());
    const task = await tasks.create({ type: "deliverable-ai-task", title: "Multica report", backend: "multica", request: { projectId: "p", deliverableId: "d", executor: "multica", instructions: "Analyse", acceptanceCriteria: [], contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "<p>Requirement</p>" }, records: [], files: [] } } });
    await tasks.transition(task.id, "running");
    const registry = new RichToolRegistry(); registerDeliverableTaskTools(registry, tasks);

    expect(await registry.invoke("rich_task_context_get", { taskId: task.id })).toMatchObject({ ok: true });
    expect(await registry.invoke("rich_task_report_result", { taskId: task.id, summary: "Multica analysis complete", evidence: [] })).toMatchObject({ ok: true, data: { task: { status: "succeeded", reviewStatus: "needs_human" } } });
  });
});
