import { z } from "zod";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { parseAiTaskRequest } from "../../ai-tasks/types.js";
import { DeliverableTaskHistoryService } from "../../ai-tasks/DeliverableTaskHistoryService.js";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import type { PersistentTaskService } from "./persistentTaskService.js";

function assertAgentTask(task: Awaited<ReturnType<PersistentTaskService["get"]>>) {
  const request = parseAiTaskRequest(task.request);
  if (request.scenario !== "deliverable_analysis") throw new RichMcpError("PERMISSION_DENIED", "The task scenario does not allow deliverable tools.");
  if (task.backend !== request.executor) throw new RichMcpError("PERMISSION_DENIED", "The task executor does not match its persisted backend.");
  if (task.status !== "running" && task.status !== "waiting_input") throw new RichMcpError("CONFLICT", "The deliverable task is not active.");
  return request;
}

export function registerDeliverableTaskTools(
  registry: RichToolRegistry,
  tasks: PersistentTaskService,
  elements?: Pick<ElementsRepo, "get">,
): void {
  const history = new DeliverableTaskHistoryService(tasks);
  registry.register({
    name: "rich_task_context_get", title: "读取交付物任务上下文", category: "query",
    description: "读取指定 Agent 交付物任务创建时冻结的要求、记录和材料目录。",
    inputSchema: z.object({ taskId: z.string().min(1) }), annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "读取当前任务的冻结上下文", input: { taskId: "task-id" } }], verification: "Returns only the snapshot persisted on the running task.",
    handler: async ({ taskId }) => {
      const task = await tasks.get(taskId); const request = assertAgentTask(task);
      return richSuccess("rich_task_context_get", { contextSnapshot: request.contextSnapshot }, { refs: [{ type: "work_task", id: task.id, label: task.title }] });
    },
  });
  registry.register({
    name: "rich_task_material_read", title: "读取冻结交付物材料", category: "query",
    description: "读取当前任务快照中明确列出的一个材料文件。不能读取快照以外的路径。",
    inputSchema: z.object({ taskId: z.string().min(1), relativePath: z.string().min(1), maxChars: z.number().int().min(1_000).max(100_000).default(40_000) }),
    annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "读取任务冻结的基线清单", input: { taskId: "task-id", relativePath: "07-交付/report/baseline.md" } }],
    verification: "Returns content only for a file listed in the active task snapshot.",
    handler: async ({ taskId, relativePath, maxChars }) => {
      const task = await tasks.get(taskId); const request = assertAgentTask(task);
      const file = request.contextSnapshot.files.find(item => item.relativePath === relativePath);
      if (!file) throw new RichMcpError("PERMISSION_DENIED", "The requested path is not a frozen material of this task.");
      if (!elements) throw new RichMcpError("DEPENDENCY_UNAVAILABLE", "Project file access is not configured.", { retryable: true });
      const project = await elements.get(request.projectId);
      const localFolder = project?.type === "project" && typeof (project.content as { localFolder?: unknown }).localFolder === "string"
        ? (project.content as { localFolder: string }).localFolder : undefined;
      if (!localFolder) throw new RichMcpError("DEPENDENCY_UNAVAILABLE", "The task project has no local folder configured.", { retryable: true });
      const target = await frozenFilePath(localFolder, file.relativePath);
      if (!target) throw new RichMcpError("NOT_FOUND", "The frozen material file is unavailable at its recorded path.");
      const content = await readMaterial(target, maxChars);
      return richSuccess("rich_task_material_read", { material: { relativePath: file.relativePath, fileName: file.fileName, type: file.type, content, truncated: content.length >= maxChars } }, { refs: [{ type: "work_task", id: task.id, label: task.title }, { type: "file", id: file.relativePath, label: file.fileName }] });
    },
  });
  registry.register({
    name: "rich_task_reference_read", title: "读取冻结记录引用", category: "query",
    description: "读取当前任务冻结记录中明确写出的单个文件引用。目录和未声明的路径不会开放。",
    inputSchema: z.object({ taskId: z.string().min(1), recordId: z.string().min(1), maxChars: z.number().int().min(1_000).max(100_000).default(40_000) }),
    annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "读取冻结记录指向的代码导航", input: { taskId: "task-id", recordId: "record-id" } }],
    verification: "Returns a file only when its path is explicitly present in the selected frozen record.",
    handler: async ({ taskId, recordId, maxChars }) => {
      const task = await tasks.get(taskId); const request = assertAgentTask(task);
      const record = request.contextSnapshot.records.find(item => item.id === recordId);
      const recordedPath = record && recordFilePath(record.text);
      if (!recordedPath) throw new RichMcpError("PERMISSION_DENIED", "The frozen record does not declare a readable file path.");
      const target = await frozenFilePath("/", recordedPath);
      if (!target) throw new RichMcpError("NOT_FOUND", "The frozen record's file is unavailable at its recorded path.");
      const content = await readMaterial(target, maxChars);
      return richSuccess("rich_task_reference_read", { reference: { recordId, kind: record.kind, path: recordedPath, content, truncated: content.length >= maxChars } }, { refs: [{ type: "work_task", id: task.id, label: task.title }, { type: "record", id: recordId }] });
    },
  });
  registry.register({
    name: "rich_deliverable_history_get", title: "读取交付物任务历史", category: "query",
    description: "读取当前交付物此前 AI 任务的结论、产物引用和人工复核状态。",
    inputSchema: z.object({ taskId: z.string().min(1) }), annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "读取当前交付物的历史任务链", input: { taskId: "task-id" } }], verification: "Returns only prior tasks belonging to the same project and deliverable.",
    handler: async ({ taskId }) => {
      const task = await tasks.get(taskId); const request = assertAgentTask(task);
      return richSuccess("rich_deliverable_history_get", { history: await history.list(request.projectId, request.deliverableId, task.id) }, { refs: [{ type: "work_task", id: task.id, label: task.title }] });
    },
  });
  registry.register({
    name: "rich_task_report_result", title: "回报交付物任务结果", category: "manage",
    description: "写入 Agent 对交付物分析任务的摘要和证据，并将任务提交给人工复核。",
    inputSchema: z.object({ taskId: z.string().min(1), summary: z.string().trim().min(1).max(20_000), evidence: z.array(z.string().trim().min(1).max(1_000)).max(50).default([]) }),
    annotations: { readOnly: false, destructive: false, idempotent: true }, examples: [{ description: "提交分析结论等待人工复核", input: { taskId: "task-id", summary: "分析完成", evidence: ["source.xlsx"] } }], verification: "Reads the completed task and confirms it requires human review.",
    handler: async ({ taskId, summary, evidence }) => {
      const task = await tasks.get(taskId); assertAgentTask(task);
      const resultRefs = [{ type: "analysis_result", id: task.id, label: summary }, ...evidence.map(id => ({ type: "evidence", id }))];
      const completed = await tasks.transition(task.id, "succeeded", { progressSummary: summary, resultRefs, reviewStatus: "needs_human" });
      return richSuccess("rich_task_report_result", { task: completed }, { refs: [{ type: "work_task", id: completed.id, label: completed.title }] });
    },
  });
}

async function frozenFilePath(localFolder: string, recordedPath: string): Promise<string | null> {
  const normalized = recordedPath.replaceAll("\\", "/").replace(/^\/+/, "");
  const candidates = [resolve(localFolder, normalized), resolve("/", normalized)];
  for (const candidate of candidates) {
    try {
      const target = await realpath(candidate);
      if ((await stat(target)).isFile()) return target;
    } catch { /* try the next recorded-path interpretation */ }
  }
  return null;
}

function recordFilePath(text: string): string | null {
  const start = text.indexOf("/");
  if (start < 0) return null;
  const value = text.slice(start).trim();
  return value && !value.includes("\n") ? value : null;
}

async function readMaterial(path: string, maxChars: number): Promise<string> {
  const extension = extname(path).toLowerCase();
  if (extension === ".xlsx" || extension === ".xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await readFile(path), { type: "buffer", cellText: true, cellDates: true });
    return workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      return `## ${name}\n${rows}`;
    }).join("\n\n").slice(0, maxChars);
  }
  return (await readFile(path, "utf8")).slice(0, maxChars);
}
