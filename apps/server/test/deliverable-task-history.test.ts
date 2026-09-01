import { describe, expect, it } from "vitest";
import { DeliverableTaskHistoryService } from "../src/ai-tasks/DeliverableTaskHistoryService.js";
import type { McpTask, McpTaskListOptions, McpTaskRepo } from "../src/repos/McpTaskRepo.js";
import { PersistentTaskService } from "../src/mcp-v2/tasks/persistentTaskService.js";

class MemoryTasks implements McpTaskRepo { tasks: McpTask[] = []; create(task: McpTask) { this.tasks.push(task); } get(id: string) { return this.tasks.find(task => task.id === id) ?? null; } list(_?: McpTaskListOptions) { return this.tasks; } count() { return this.tasks.length; } save(task: McpTask) { this.tasks = this.tasks.map(current => current.id === task.id ? task : current); } }
const request = (deliverableId: string) => ({ projectId: "project-1", deliverableId, executor: "hermes", instructions: "Analyse", acceptanceCriteria: [], contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "" }, records: [], files: [] } });

describe("DeliverableTaskHistoryService", () => {
  it("returns prior tasks for the same deliverable with review state and output refs", async () => {
    const tasks = new PersistentTaskService(new MemoryTasks());
    const previous = await tasks.create({ type: "deliverable-ai-task", title: "Initial analysis", request: request("deliverable-1"), backend: "hermes" });
    await tasks.transition(previous.id, "succeeded", { progressSummary: "Found three gaps", resultRefs: [{ type: "file", id: "analysis.md", label: "Analysis draft" }], reviewStatus: "needs_human" });
    await tasks.create({ type: "deliverable-ai-task", title: "Other", request: request("deliverable-2"), backend: "hermes" });
    const history = await new DeliverableTaskHistoryService(tasks).list("project-1", "deliverable-1");
    expect(history).toEqual([expect.objectContaining({ id: previous.id, summary: "Found three gaps", reviewStatus: "needs_human", resultRefs: [expect.objectContaining({ id: "analysis.md" })] })]);
  });
});
