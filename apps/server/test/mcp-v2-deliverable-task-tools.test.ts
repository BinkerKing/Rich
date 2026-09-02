import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { registerDeliverableTaskTools } from "../src/mcp-v2/tasks/deliverableTaskTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import { PersistentTaskService } from "../src/mcp-v2/tasks/persistentTaskService.js";
import type { McpTask, McpTaskListOptions, McpTaskRepo } from "../src/repos/McpTaskRepo.js";
import type { ProjectManagementRepo } from "../src/repos/ProjectManagementRepo.js";

class MemoryTasks implements McpTaskRepo { tasks = new Map<string, McpTask>(); create(task: McpTask) { this.tasks.set(task.id, task); } get(id: string) { return this.tasks.get(id) ?? null; } list(_?: McpTaskListOptions) { return [...this.tasks.values()]; } count() { return this.tasks.size; } save(task: McpTask) { this.tasks.set(task.id, task); } }

const projectElements = (projectId: string, localFolder: string) => ({
  get: async (id: string) => id === projectId ? { id, type: "project", content: { localFolder } } : null,
});

function deliverableProjects() {
  const item = {
    id: "d", projectId: "p", moduleKey: "deliverables" as const, title: "Report", sortOrder: 0,
    createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z",
    content: { recordType: "deliverable", folderPath: "07-交付/report", records: [{ id: "task-record", kind: "ai_task", text: "Analyse", createdAt: "2026-09-02T00:00:00.000Z", attachments: [], informationType: "information", aiTask: { id: "", status: "publishing", executor: "hermes" } }] },
  };
  return {
    item,
    repo: {
      listAllModuleItems: async () => [item],
      updateModuleItem: async (_projectId: string, itemId: string, patch: { content?: Record<string, unknown> }) => {
        if (itemId !== item.id) return null;
        if (patch.content) item.content = patch.content as typeof item.content;
        return item;
      },
    } as Pick<ProjectManagementRepo, "listAllModuleItems" | "updateModuleItem">,
  };
}

describe("deliverable task MCP tools", () => {
  it("writes a detailed result under its originating deliverable task", async () => {
    const folder = await mkdtemp(join(tmpdir(), "rich-task-result-"));
    try {
      const tasks = new PersistentTaskService(new MemoryTasks());
      const task = await tasks.create({ type: "deliverable-ai-task", title: "Report", backend: "hermes", request: { projectId: "p", deliverableId: "d", originRecordId: "task-record", executor: "hermes", instructions: "Analyse", acceptanceCriteria: [], contextSnapshot: { version: 1, createdAt: "2026-09-02T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "" }, records: [], files: [] } } });
      await tasks.transition(task.id, "running");
      const projects = deliverableProjects();
      const registry = new RichToolRegistry(); registerDeliverableTaskTools(registry, tasks, projectElements("p", folder), projects.repo);

      await registry.invoke("rich_task_report_result", { taskId: task.id, summary: "发现两项遗漏", evidence: ["source.xlsx"], reportMarkdown: "# 完整分析\n" });

      const records = projects.item.content.records;
      expect(records).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "ai_task_result", parentRecordId: "task-record", text: "发现两项遗漏" })]));
      const result = records.find(record => record.kind === "ai_task_result") as { aiTaskResult: { report: { relativePath: string } } };
      await expect(readFile(join(folder, result.aiTaskResult.report.relativePath), "utf8")).resolves.toBe("# 完整分析");
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
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

  it("reads only a frozen material file through the task-scoped protocol", async () => {
    const folder = await mkdtemp(join(tmpdir(), "rich-task-material-"));
    await writeFile(join(folder, "baseline.md"), "# Baseline\n- Report A\n", "utf8");
    try {
      const tasks = new PersistentTaskService(new MemoryTasks());
      const task = await tasks.create({ type: "deliverable-ai-task", title: "Read material", backend: "hermes", request: { projectId: "p", deliverableId: "d", executor: "hermes", instructions: "Analyse", acceptanceCriteria: [], contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "<p>Requirement</p>" }, records: [], files: [{ relativePath: "baseline.md", fileName: "baseline.md", size: 22, type: "material" }] } } });
      await tasks.transition(task.id, "running");
      const registry = new RichToolRegistry(); registerDeliverableTaskTools(registry, tasks, projectElements("p", folder));

      expect(await registry.invoke("rich_task_material_read", { taskId: task.id, relativePath: "baseline.md" })).toMatchObject({ ok: true, data: { material: { relativePath: "baseline.md", content: "# Baseline\n- Report A\n" } } });
      expect(await registry.invoke("rich_task_material_read", { taskId: task.id, relativePath: "outside.md" })).toMatchObject({ ok: false, error: { code: "PERMISSION_DENIED" } });
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it("renders a frozen spreadsheet as readable rows for the Agent", async () => {
    const folder = await mkdtemp(join(tmpdir(), "rich-task-material-"));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Report", "Automated"], ["A", "Yes"]]), "Baseline");
    XLSX.writeFile(workbook, join(folder, "baseline.xlsx"));
    try {
      const tasks = new PersistentTaskService(new MemoryTasks());
      const task = await tasks.create({ type: "deliverable-ai-task", title: "Read spreadsheet", backend: "hermes", request: { projectId: "p", deliverableId: "d", executor: "hermes", instructions: "Analyse", acceptanceCriteria: [], contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "<p>Requirement</p>" }, records: [], files: [{ relativePath: "baseline.xlsx", fileName: "baseline.xlsx", size: 100, type: "material" }] } } });
      await tasks.transition(task.id, "running");
      const registry = new RichToolRegistry(); registerDeliverableTaskTools(registry, tasks, projectElements("p", folder));

      expect(await registry.invoke("rich_task_material_read", { taskId: task.id, relativePath: "baseline.xlsx" })).toMatchObject({ ok: true, data: { material: { content: expect.stringContaining("Report,Automated\nA,Yes") } } });
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it("reads a file explicitly referenced by a frozen record", async () => {
    const folder = await mkdtemp(join(tmpdir(), "rich-task-reference-"));
    const navigation = join(folder, "CODE_NAVIGATION.md");
    await writeFile(navigation, "# Source navigation\n", "utf8");
    try {
      const tasks = new PersistentTaskService(new MemoryTasks());
      const task = await tasks.create({ type: "deliverable-ai-task", title: "Read navigation", backend: "hermes", request: { projectId: "p", deliverableId: "d", executor: "hermes", instructions: "Analyse", acceptanceCriteria: [], contextSnapshot: { version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "07-交付/report", requirementHtml: "<p>Requirement</p>" }, records: [{ id: "navigation", kind: "information", text: `代码导航：${navigation}`, createdAt: "2026-09-01T00:00:00.000Z" }], files: [] } } });
      await tasks.transition(task.id, "running");
      const registry = new RichToolRegistry(); registerDeliverableTaskTools(registry, tasks, projectElements("p", folder));

      expect(await registry.invoke("rich_task_reference_read", { taskId: task.id, recordId: "navigation" })).toMatchObject({ ok: true, data: { reference: { recordId: "navigation", content: "# Source navigation\n" } } });
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
