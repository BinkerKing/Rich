import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { z } from "zod";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { ProjectManagementRepo, ProjectModuleItem } from "../../repos/ProjectManagementRepo.js";
import type { DeliverablesRepo } from "../../repos/DeliverablesRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "../resources/schemas.js";

const recordKind = z.enum(["requirement", "status", "decision", "issue", "risk", "change", "information", "material", "codex", "question"]);
const fileType = z.enum(["deliverable", "material", "intermediate"]);
const targetSchema = z.object({ projectId: z.string().trim().min(1), deliverableId: z.string().trim().min(1) });
const projectTargetSchema = z.object({ projectId: z.string().trim().min(1) });
const attachmentPathsSchema = z.array(z.string().trim().min(1)).max(50);

type Deliverable = Pick<ProjectModuleItem, "id" | "title" | "subtitle" | "content"> & { content: Record<string, unknown> };

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string { return typeof value === "string" ? value : ""; }

async function findDeliverable(projects: Pick<ProjectManagementRepo, "listAllModuleItems">, standaloneDeliverables: Pick<DeliverablesRepo, "get"> | undefined, projectId: string, deliverableId: string): Promise<Deliverable> {
  const item = (await projects.listAllModuleItems(projectId, "deliverables")).find(candidate => candidate.id === deliverableId);
  const standalone = item ? undefined : await standaloneDeliverables?.get(deliverableId);
  const deliverable = item ?? standalone;
  if (!deliverable || !object(deliverable.content) || deliverable.content.recordType !== "deliverable") {
    throw new RichMcpError("NOT_FOUND", "The specified deliverable was not found in this project.");
  }
  return deliverable as Deliverable;
}

async function updateDeliverable(projects: Pick<ProjectManagementRepo, "updateModuleItem">, standaloneDeliverables: Pick<DeliverablesRepo, "update"> | undefined, projectId: string, deliverableId: string, content: Record<string, unknown>): Promise<Deliverable | null> {
  return (await projects.updateModuleItem(projectId, deliverableId, { content })) ?? await standaloneDeliverables?.update(deliverableId, { content }) ?? null;
}

async function projectRoot(elements: Pick<ElementsRepo, "get">, projectId: string): Promise<string> {
  const project = await elements.get(projectId);
  const localFolder = project?.type === "project" && object(project.content) ? project.content.localFolder : undefined;
  if (typeof localFolder !== "string" || !localFolder.trim()) {
    throw new RichMcpError("DEPENDENCY_UNAVAILABLE", "This project has no local folder configured.");
  }
  return realpath(localFolder);
}

function deliverableFolder(root: string, folderPath: unknown): string {
  const path = text(folderPath).trim();
  if (!path) {
    throw new RichMcpError("VALIDATION_ERROR", "The deliverable has no valid folder path.");
  }
  return resolve(root, path);
}

async function listFiles(root: string, directory: string, relativeBase: string): Promise<Array<{ fileName: string; relativePath: string; size: number; modifiedAt: string; isDirectory: boolean }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const listed = await Promise.all(entries.flatMap(async entry => {
    if (!entry.isFile() && !entry.isDirectory()) return [];
    const absolute = resolve(directory, entry.name);
    const info = await stat(absolute);
    const relativePath = relative(root, absolute).replaceAll("\\", "/");
    const item = { fileName: entry.name, relativePath, size: entry.isFile() ? info.size : 0, modifiedAt: info.mtime.toISOString(), isDirectory: entry.isDirectory() };
    if (!entry.isDirectory()) return [item];
    return [item, ...(await listFiles(root, absolute, relativeBase))];
  }));
  return listed.flat().sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function readableFile(root: string, folder: string, relativePath: string): Promise<string> {
  const target = deliverableFilePath(root, folder, relativePath);
  try {
    const actual = await realpath(target);
    if (!isInside(folder, actual) || !(await stat(actual)).isFile()) throw new Error("not a file");
    return actual;
  } catch {
    throw new RichMcpError("NOT_FOUND", "The requested deliverable file was not found.");
  }
}

async function readableProjectDirectory(root: string, relativePath: string): Promise<string> {
  try {
    const actual = await realpath(resolve(root, relativePath || "."));
    if (!(await stat(actual)).isDirectory()) throw new Error("not a directory");
    return actual;
  } catch {
    throw new RichMcpError("NOT_FOUND", "The requested project directory was not found.");
  }
}

async function readableProjectFile(root: string, relativePath: string): Promise<string> {
  try {
    const actual = await realpath(resolve(root, relativePath));
    if (!(await stat(actual)).isFile()) throw new Error("not a file");
    return actual;
  } catch {
    throw new RichMcpError("NOT_FOUND", "The requested project file was not found.");
  }
}

function isInside(folder: string, path: string): boolean {
  const pathFromFolder = relative(folder, path);
  return pathFromFolder !== "" && !pathFromFolder.startsWith(`..${sep}`) && pathFromFolder !== ".." && !isAbsolute(pathFromFolder);
}

function deliverableFilePath(root: string, folder: string, path: string): string {
  const folderPath = relative(root, folder).replaceAll("\\", "/");
  const target = isAbsolute(path)
    ? resolve(path)
    : path === folderPath || path.startsWith(`${folderPath}/`)
      ? resolve(root, path)
      : resolve(folder, path);
  if (!isInside(folder, target)) {
    throw new RichMcpError("VALIDATION_ERROR", "The file path must be inside the current deliverable folder.");
  }
  return target;
}

async function readTextFile(path: string, maxChars: number): Promise<string> {
  const extension = extname(path).toLowerCase();
  if (extension === ".xlsx" || extension === ".xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await readFile(path), { type: "buffer", cellText: true, cellDates: true });
    return workbook.SheetNames.map(name => `## ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false })}`).join("\n\n").slice(0, maxChars);
  }
  return (await readFile(path, "utf8")).slice(0, maxChars);
}

async function recordAttachments(root: string, folder: string, relativePaths: string[]): Promise<Array<{ fileName: string; relativePath: string; size: number }>> {
  return Promise.all([...new Set(relativePaths)].map(async relativePath => {
    const path = await readableFile(root, folder, relativePath);
    return { fileName: path.split(sep).pop()!, relativePath: relative(root, path).replaceAll("\\", "/"), size: (await stat(path)).size };
  }));
}

export function registerDeliverableWorkspaceTools(
  registry: RichToolRegistry,
  elements: Pick<ElementsRepo, "get">,
  projects: Pick<ProjectManagementRepo, "listAllModuleItems" | "updateModuleItem">,
  operationRepo?: McpOperationRepo,
  standaloneDeliverables?: Pick<DeliverablesRepo, "get" | "update">,
): void {
  const getDeliverable = (projectId: string, deliverableId: string) => findDeliverable(projects, standaloneDeliverables, projectId, deliverableId);
  registry.register({
    name: "rich_deliverable_file_write", title: "写入交付物文本文件", category: "manage",
    description: "将 UTF-8 文本写入当前交付物目录。路径可使用交付物目录内的相对路径，或该目录内的项目相对路径。",
    inputSchema: targetSchema.extend({ relativePath: z.string().trim().min(1), content: z.string().max(1_000_000), context: richContextSchema, options: richOptionsSchema }), annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "写入交付物说明", input: { projectId: "project-id", deliverableId: "deliverable-id", relativePath: "说明.md", content: "# 说明" } }],
    verification: "Writes and reads back the exact UTF-8 file inside the specified deliverable.",
    handler: async ({ projectId, deliverableId, relativePath, content, context, options }) => executeSafeWrite({
      toolName: "rich_deliverable_file_write", operationRepo, context, options, inputForHash: { projectId, deliverableId, relativePath, content }, changes: [{ operation: "write", resource: "deliverableFile", id: relativePath }],
      execute: async () => {
        const item = await getDeliverable(projectId, deliverableId);
        const root = await projectRoot(elements, projectId); const target = deliverableFilePath(root, deliverableFolder(root, item.content.folderPath), relativePath);
        await mkdir(resolve(target, ".."), { recursive: true }); await writeFile(target, content, "utf8");
        return { deliverableId: item.id, relativePath: relative(root, target).replaceAll("\\", "/"), absolutePath: target, content };
      },
      verify: async result => ({ status: await readFile(result.absolutePath, "utf8") === result.content ? "verified" : "failed", details: "Written file was read back from the deliverable." }),
      refs: result => [{ type: "projectItem", id: result.deliverableId }, { type: "file", id: result.absolutePath }],
    }),
  });
  registry.register({
    name: "rich_deliverable_file_copy", title: "复制项目文件到交付物", category: "manage",
    description: "将项目文件复制到当前交付物目录。目标路径可使用交付物目录内的相对路径，或该目录内的项目相对路径。",
    inputSchema: targetSchema.extend({ sourceRelativePath: z.string().trim().min(1), destinationRelativePath: z.string().trim().min(1), context: richContextSchema, options: richOptionsSchema }), annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "复制项目材料", input: { projectId: "project-id", deliverableId: "deliverable-id", sourceRelativePath: "09-材料/基线.pdf", destinationRelativePath: "基线.pdf" } }],
    verification: "Copies a project file and verifies the destination byte size inside the specified deliverable.",
    handler: async ({ projectId, deliverableId, sourceRelativePath, destinationRelativePath, context, options }) => executeSafeWrite({
      toolName: "rich_deliverable_file_copy", operationRepo, context, options, inputForHash: { projectId, deliverableId, sourceRelativePath, destinationRelativePath }, changes: [{ operation: "copy", resource: "deliverableFile", id: destinationRelativePath }],
      execute: async () => {
        const item = await getDeliverable(projectId, deliverableId);
        const root = await projectRoot(elements, projectId); const source = await readableProjectFile(root, sourceRelativePath); const target = deliverableFilePath(root, deliverableFolder(root, item.content.folderPath), destinationRelativePath);
        await mkdir(resolve(target, ".."), { recursive: true }); await copyFile(source, target);
        return { deliverableId: item.id, relativePath: relative(root, target).replaceAll("\\", "/"), absolutePath: target, size: (await stat(source)).size };
      },
      verify: async result => ({ status: (await stat(result.absolutePath)).size === result.size ? "verified" : "failed", details: "Copied file size was verified in the deliverable." }),
      refs: result => [{ type: "projectItem", id: result.deliverableId }, { type: "file", id: result.absolutePath }],
    }),
  });
  registry.register({
    name: "rich_deliverable_get", title: "查看交付物信息", category: "query",
    description: "读取一个精确指定的交付物：基本信息、需求说明、要求记录、版本及文件元数据。",
    inputSchema: targetSchema, annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "查看当前固定交付物", input: { projectId: "project-id", deliverableId: "deliverable-id" } }],
    verification: "Reads the exact deliverable record from the project-management repository.",
    handler: async ({ projectId, deliverableId }) => {
      const item = await getDeliverable(projectId, deliverableId);
      const root = await projectRoot(elements, projectId);
      return richSuccess("rich_deliverable_get", { deliverable: { id: item.id, title: item.title, subtitle: item.subtitle, ...item.content, folderPath: deliverableFolder(root, item.content.folderPath) } }, { refs: [{ type: "projectItem", id: item.id, label: item.title }] });
    },
  });
  registry.register({
    name: "rich_deliverable_files_get", title: "查看交付物目录和文件清单", category: "query",
    description: "递归读取一个交付物目录的层级和文件清单，并合并页面维护的文件类型、版本、备注。",
    inputSchema: targetSchema, annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "读取交付物文件目录", input: { projectId: "project-id", deliverableId: "deliverable-id" } }],
    verification: "Lists only paths inside the specified deliverable folder.",
    handler: async ({ projectId, deliverableId }) => {
      const item = await getDeliverable(projectId, deliverableId);
      const root = await projectRoot(elements, projectId);
      const folder = deliverableFolder(root, item.content.folderPath);
      const metadata = new Map((Array.isArray(item.content.fileMeta) ? item.content.fileMeta : []).flatMap(meta => object(meta) && text(meta.relativePath) ? [[text(meta.relativePath), meta] as const] : []));
      const files = (await listFiles(root, folder, text(item.content.folderPath))).map(file => ({ ...file, ...(metadata.get(file.relativePath) ? { metadata: metadata.get(file.relativePath) } : {}) }));
      return richSuccess("rich_deliverable_files_get", { folderPath: folder, files: files.map(file => ({ ...file, absolutePath: resolve(root, file.relativePath) })) }, { refs: [{ type: "projectItem", id: item.id, label: item.title }] });
    },
  });
  registry.register({
    name: "rich_deliverable_file_read", title: "读取交付物文件内容", category: "query",
    description: "读取当前交付物目录内一个明确文件的文本内容；Excel 会转换为 CSV 文本。",
    inputSchema: targetSchema.extend({ relativePath: z.string().trim().min(1), maxChars: z.number().int().min(1_000).max(100_000).default(40_000) }), annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "读取一个交付材料", input: { projectId: "project-id", deliverableId: "deliverable-id", relativePath: "07-交付/UAT/验收说明.md" } }],
    verification: "Reads only a regular file inside the specified deliverable folder.",
    handler: async ({ projectId, deliverableId, relativePath, maxChars }) => {
      const item = await getDeliverable(projectId, deliverableId);
      const root = await projectRoot(elements, projectId);
      const folder = deliverableFolder(root, item.content.folderPath);
      const file = await readableFile(root, folder, relativePath);
      const content = await readTextFile(file, maxChars);
      return richSuccess("rich_deliverable_file_read", { relativePath: relative(root, file).replaceAll("\\", "/"), absolutePath: file, content, truncated: content.length >= maxChars }, { refs: [{ type: "projectItem", id: item.id, label: item.title }, { type: "file", id: file }] });
    },
  });
  registry.register({
    name: "rich_project_files_get", title: "查看项目目录和文件清单", category: "query",
    description: "递归读取项目本地目录中任意子目录的层级和文件清单。仅可读取，不会修改文件。",
    inputSchema: projectTargetSchema.extend({ relativePath: z.string().trim().default("") }), annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "查看项目中的一代源码目录", input: { projectId: "project-id", relativePath: "01-代码/一代" } }],
    verification: "Lists only paths inside the configured project folder.",
    handler: async ({ projectId, relativePath }) => {
      const root = await projectRoot(elements, projectId);
      const folder = await readableProjectDirectory(root, relativePath);
      const files = await listFiles(root, folder, relativePath);
      return richSuccess("rich_project_files_get", { folderPath: folder, files: files.map(file => ({ ...file, absolutePath: resolve(root, file.relativePath) })) }, { refs: [{ type: "file", id: folder, label: "项目目录" }] });
    },
  });
  registry.register({
    name: "rich_project_file_read", title: "读取项目文件内容", category: "query",
    description: "读取项目本地目录中任意明确文件的文本内容；Excel 会转换为 CSV 文本。仅可读取，不会修改文件。",
    inputSchema: projectTargetSchema.extend({ relativePath: z.string().trim().min(1), maxChars: z.number().int().min(1_000).max(100_000).default(40_000) }), annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{ description: "读取项目中一段 SQL 源码", input: { projectId: "project-id", relativePath: "01-代码/PROC_SAFE_SAC.sql" } }],
    verification: "Reads only a regular file inside the configured project folder.",
    handler: async ({ projectId, relativePath, maxChars }) => {
      const root = await projectRoot(elements, projectId);
      const file = await readableProjectFile(root, relativePath);
      const content = await readTextFile(file, maxChars);
      return richSuccess("rich_project_file_read", { relativePath: relative(root, file).replaceAll("\\", "/"), absolutePath: file, content, truncated: content.length >= maxChars }, { refs: [{ type: "file", id: file }] });
    },
  });
  registry.register({
    name: "rich_deliverable_record_create", title: "新增交付物记录", category: "manage",
    description: "在指定交付物中新建要求、进展、决策、问题、风险、变更、信息、材料或 Codex 操作记录。若记录关联文件，必须传入交付物目录内已有文件的路径以挂接附件。不会创建 AI 任务记录。",
    inputSchema: targetSchema.extend({ kind: recordKind, text: z.string().trim().min(1).max(10_000), attachmentRelativePaths: attachmentPathsSchema.default([]), context: richContextSchema, options: richOptionsSchema }), annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "新增一条带文件链接的交付物要求记录", input: { projectId: "project-id", deliverableId: "deliverable-id", kind: "requirement", text: "验收前需要完成业务确认。", attachmentRelativePaths: ["07-交付/UAT/验收说明.md"] } }],
    verification: "Reads the deliverable back and confirms the created record exists.",
    handler: async ({ projectId, deliverableId, kind, text: recordText, attachmentRelativePaths, context, options }) => executeSafeWrite({
      toolName: "rich_deliverable_record_create", operationRepo, context, options,
      inputForHash: { projectId, deliverableId, kind, text: recordText, attachmentRelativePaths }, changes: [{ operation: "create", resource: "deliverableRecord" }],
      execute: async () => {
        const item = await getDeliverable(projectId, deliverableId);
        const root = await projectRoot(elements, projectId);
        const attachments = await recordAttachments(root, deliverableFolder(root, item.content.folderPath), attachmentRelativePaths);
        const record = { id: `codex-${randomUUID()}`, kind, text: recordText, createdAt: new Date().toISOString(), informationType: kind === "material" ? "material" : "information", attachments, author: "Codex" };
        const records = [...(Array.isArray(item.content.records) ? item.content.records : []), record];
        const updated = await updateDeliverable(projects, standaloneDeliverables, projectId, item.id, { ...item.content, records });
        if (!updated) throw new RichMcpError("NOT_FOUND", "The deliverable was no longer available.");
        return { record, deliverableId: item.id };
      },
      verify: async result => {
        const item = await getDeliverable(projectId, result.deliverableId);
        const found = Array.isArray(item.content.records) && item.content.records.some(record => object(record) && record.id === result.record.id);
        return { status: found ? "verified" : "failed", details: "Created record was read back from the deliverable." };
      }, refs: result => [{ type: "projectItem", id: result.deliverableId }, { type: "record", id: result.record.id, label: result.record.text }],
    }),
  });
  registry.register({
    name: "rich_deliverable_record_update", title: "编辑交付物记录", category: "manage",
    description: "编辑指定交付物中一条已有的人工记录，也可替换其文件附件。附件只能引用交付物目录内已有文件；AI 任务和 AI 任务结果不可通过本工具修改。",
    inputSchema: targetSchema.extend({ recordId: z.string().trim().min(1), kind: recordKind.optional(), text: z.string().trim().min(1).max(10_000).optional(), attachmentRelativePaths: attachmentPathsSchema.optional(), context: richContextSchema, options: richOptionsSchema }).superRefine((value, ctx) => { if (!value.kind && !value.text && value.attachmentRelativePaths === undefined) ctx.addIssue({ code: "custom", message: "At least one editable field is required." }); }), annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "更新一条要求记录", input: { projectId: "project-id", deliverableId: "deliverable-id", recordId: "record-id", text: "更新后的要求" } }],
    verification: "Reads the deliverable back and confirms the requested record fields changed.",
    handler: async ({ projectId, deliverableId, recordId, kind, text: recordText, attachmentRelativePaths, context, options }) => executeSafeWrite({
      toolName: "rich_deliverable_record_update", operationRepo, context, options,
      inputForHash: { projectId, deliverableId, recordId, kind, text: recordText, attachmentRelativePaths }, changes: [{ operation: "update", resource: "deliverableRecord", id: recordId }],
      execute: async () => {
        const item = await getDeliverable(projectId, deliverableId);
        const records = Array.isArray(item.content.records) ? item.content.records : [];
        const existing = records.find(record => object(record) && record.id === recordId);
        if (!existing) throw new RichMcpError("NOT_FOUND", "The specified deliverable record was not found.");
        if (existing.kind === "ai_task" || existing.kind === "ai_task_result") throw new RichMcpError("PERMISSION_DENIED", "AI task records cannot be edited with this tool.");
        const root = await projectRoot(elements, projectId);
        const attachments = attachmentRelativePaths === undefined ? undefined : await recordAttachments(root, deliverableFolder(root, item.content.folderPath), attachmentRelativePaths);
        const record = { ...existing, ...(kind ? { kind, informationType: kind === "material" ? "material" : "information" } : {}), ...(recordText ? { text: recordText } : {}), ...(attachments ? { attachments } : {}) };
        const updated = await updateDeliverable(projects, standaloneDeliverables, projectId, item.id, { ...item.content, records: records.map(current => object(current) && current.id === recordId ? record : current) });
        if (!updated) throw new RichMcpError("NOT_FOUND", "The deliverable was no longer available.");
        return { record, deliverableId: item.id };
      },
      verify: async result => {
        const item = await getDeliverable(projectId, result.deliverableId);
        const found = Array.isArray(item.content.records) && item.content.records.some(record => object(record) && record.id === result.record.id && (!recordText || record.text === recordText) && (!kind || record.kind === kind) && (attachmentRelativePaths === undefined || Array.isArray(record.attachments) && record.attachments.length === attachmentRelativePaths.length));
        return { status: found ? "verified" : "failed", details: "Updated record was read back from the deliverable." };
      }, refs: result => [{ type: "projectItem", id: result.deliverableId }, { type: "record", id: result.record.id }],
    }),
  });
  registry.register({
    name: "rich_deliverable_requirement_update", title: "编辑交付物需求说明", category: "manage",
    description: "更新指定交付物页面的需求说明 HTML。仅修改需求说明，不影响要求记录或文件。",
    inputSchema: targetSchema.extend({ descriptionHtml: z.string().max(100_000), context: richContextSchema, options: richOptionsSchema }), annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "更新交付物需求说明", input: { projectId: "project-id", deliverableId: "deliverable-id", descriptionHtml: "<p>更新后的需求说明</p>" } }],
    verification: "Reads the deliverable back and confirms the exact requirement HTML was stored.",
    handler: async ({ projectId, deliverableId, descriptionHtml, context, options }) => executeSafeWrite({
      toolName: "rich_deliverable_requirement_update", operationRepo, context, options,
      inputForHash: { projectId, deliverableId, descriptionHtml }, changes: [{ operation: "update", resource: "deliverableRequirement", id: deliverableId }],
      execute: async () => {
        const item = await getDeliverable(projectId, deliverableId);
        const updated = await updateDeliverable(projects, standaloneDeliverables, projectId, item.id, { ...item.content, descriptionHtml });
        if (!updated) throw new RichMcpError("NOT_FOUND", "The deliverable was no longer available.");
        return { deliverableId: item.id, descriptionHtml };
      },
      verify: async result => ({ status: (await getDeliverable(projectId, result.deliverableId)).content.descriptionHtml === descriptionHtml ? "verified" : "failed", details: "Requirement description was read back from the deliverable." }),
      refs: result => [{ type: "projectItem", id: result.deliverableId }],
    }),
  });
  registry.register({
    name: "rich_deliverable_settings_update", title: "编辑交付物版本策略", category: "manage",
    description: "更新指定交付物页面的版本策略：仅保留最新或保留版本历史。不会删除现有文件或历史版本。",
    inputSchema: targetSchema.extend({ versionPolicy: z.enum(["latest", "versioned"]), context: richContextSchema, options: richOptionsSchema }), annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "将交付物改为版本控制", input: { projectId: "project-id", deliverableId: "deliverable-id", versionPolicy: "versioned" } }],
    verification: "Reads the deliverable back and confirms the stored version policy.",
    handler: async ({ projectId, deliverableId, versionPolicy, context, options }) => executeSafeWrite({
      toolName: "rich_deliverable_settings_update", operationRepo, context, options,
      inputForHash: { projectId, deliverableId, versionPolicy }, changes: [{ operation: "update", resource: "deliverableSettings", id: deliverableId }],
      execute: async () => {
        const item = await getDeliverable(projectId, deliverableId);
        const updated = await updateDeliverable(projects, standaloneDeliverables, projectId, item.id, { ...item.content, versionPolicy });
        if (!updated) throw new RichMcpError("NOT_FOUND", "The deliverable was no longer available.");
        return { deliverableId: item.id, versionPolicy };
      },
      verify: async result => ({ status: (await getDeliverable(projectId, result.deliverableId)).content.versionPolicy === versionPolicy ? "verified" : "failed", details: "Version policy was read back from the deliverable." }),
      refs: result => [{ type: "projectItem", id: result.deliverableId }],
    }),
  });
  registry.register({
    name: "rich_deliverable_file_meta_update", title: "编辑交付物文件信息", category: "manage",
    description: "编辑指定交付物目录中已有文件的类型、版本和备注；不改动文件内容或磁盘路径。",
    inputSchema: targetSchema.extend({ relativePath: z.string().trim().min(1), type: fileType.optional(), version: z.string().trim().max(200).optional(), note: z.string().trim().max(2_000).optional(), context: richContextSchema, options: richOptionsSchema }).superRefine((value, ctx) => { if (!value.type && value.version === undefined && value.note === undefined) ctx.addIssue({ code: "custom", message: "At least one file metadata field is required." }); }), annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{ description: "标注交付物文件版本", input: { projectId: "project-id", deliverableId: "deliverable-id", relativePath: "07-交付/UAT/验收报告.docx", type: "deliverable", version: "V1.0" } }],
    verification: "Confirms the file exists inside the deliverable and reads back its stored metadata.",
    handler: async ({ projectId, deliverableId, relativePath, type, version, note, context, options }) => executeSafeWrite({
      toolName: "rich_deliverable_file_meta_update", operationRepo, context, options,
      inputForHash: { projectId, deliverableId, relativePath, type, version, note }, changes: [{ operation: "update", resource: "deliverableFileMeta", id: relativePath }],
      execute: async () => {
        const item = await getDeliverable(projectId, deliverableId);
        const root = await projectRoot(elements, projectId);
        await readableFile(root, deliverableFolder(root, item.content.folderPath), relativePath);
        const current = Array.isArray(item.content.fileMeta) ? item.content.fileMeta.filter(object) : [];
        const existing = current.find(meta => meta.relativePath === relativePath);
        const metadata = { ...(existing ?? { relativePath, type: "material", version: "" }), ...(type ? { type } : {}), ...(version !== undefined ? { version } : {}), ...(note !== undefined ? { note } : {}) };
        const updated = await updateDeliverable(projects, standaloneDeliverables, projectId, item.id, { ...item.content, fileMeta: [...current.filter(meta => meta.relativePath !== relativePath), metadata] });
        if (!updated) throw new RichMcpError("NOT_FOUND", "The deliverable was no longer available.");
        return { deliverableId: item.id, metadata };
      },
      verify: async result => {
        const item = await getDeliverable(projectId, result.deliverableId);
        const found = Array.isArray(item.content.fileMeta) && item.content.fileMeta.some(meta => object(meta) && meta.relativePath === relativePath && (!type || meta.type === type) && (version === undefined || meta.version === version) && (note === undefined || meta.note === note));
        return { status: found ? "verified" : "failed", details: "File metadata was read back from the deliverable." };
      }, refs: result => [{ type: "projectItem", id: result.deliverableId }, { type: "file", id: relativePath }],
    }),
  });
}
