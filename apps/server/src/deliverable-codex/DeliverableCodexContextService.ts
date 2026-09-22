import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { realpath } from "node:fs/promises";
import type { AiTaskContextSnapshot } from "../ai-tasks/types.js";
import type { DeliverableTaskContextService } from "../ai-tasks/DeliverableTaskContextService.js";
import { deliverableTaskContextBrief } from "../ai-tasks/deliverableTaskBrief.js";
import type { DeliverableCodexMode } from "../repos/DeliverableCodexConversationRepo.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import { GENERAL_CODEX_SCOPE } from "../task-workbench/instructions.js";

type DeliverableContextMode = DeliverableCodexMode | "task" | "bug";

export interface DeliverableCodexContext {
  scopeKey: string;
  contextVersion: string;
  systemInstruction: string;
  initialContext: string;
  allowedMcpTools: string[];
  workspaceRoot?: string;
}

function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function projectWorkspaceRoot(project: Awaited<ReturnType<ElementsRepo["get"]>>): Promise<string | undefined> {
  const localFolder = project?.type === "project" && object(project.content) ? project.content.localFolder : undefined;
  return typeof localFolder === "string" && localFolder.trim() ? realpath(localFolder) : undefined;
}

function modeInstruction(mode: DeliverableContextMode): string {
  if (mode === "task") return [
    "You are working in Rich task mode for this deliverable.",
    "The initial message only establishes frozen context.",
    "Do not analyze, read materials, use tools, write results, or propose a solution until the user explicitly supplies a task.",
    "When a user task is supplied, use the frozen delivery inputs as the task context and write Rich business results only when the user explicitly asks.",
  ].join("\n");
  if (mode === "bug") return [
    "You are working in Rich bug mode for this deliverable.",
    "Use the provided context to guide reproduction and diagnosis.",
    "Do not write Rich business records or deliverable results.",
  ].join("\n");
  return [
    "You are working in Rich free mode for this deliverable.",
    "Assist with the provided deliverable context through ordinary conversation.",
    "When the user explicitly asks you to create, write, update, summarize into, or otherwise save a deliverable artifact, you MUST use the Rich MCP tools to write it into this deliverable's interface.",
    "Do not merely paste the requested deliverable content into chat when the user asked for it to be saved; confirm the completed Rich MCP write instead.",
    "If you need any clarification, you MUST first call rich_deliverable_record_create with kind: question and phrase one clear question for the user.",
    "Never ask a clarification question only in the chat response. After creating a question record, the chat response must only confirm that the question has been recorded and that you are waiting for the user's answer.",
    "Never use a kind: codex record to give the user a response or completion update. Rich will add the completion feedback as a kind: status record.",
    "Do not create other Rich business records or deliverable results in free mode.",
  ].join("\n");
}

function contextText(projectId: string, deliverableId: string, snapshot: AiTaskContextSnapshot): string {
  const records = snapshot.records.slice(0, 30).map(record => `- [${record.kind}] ${record.text}`).join("\n") || "- None";
  const files = snapshot.files.slice(0, 30).map(file => `- ${file.relativePath} (${file.size} bytes, ${file.type})`).join("\n") || "- None";
  return [
    "## Rich deliverable context",
    `- Project ID: ${projectId}`,
    `- Deliverable ID: ${deliverableId}`,
    `- Deliverable folder: ${snapshot.deliverable.folderPath}`,
    "", "## Requirement", plainText(snapshot.deliverable.requirementHtml) || "- None",
    "", "## Deliverable records", records,
    "", "## Known files", files,
  ].join("\n");
}

function incrementalContextText(projectId: string, deliverableId: string, snapshot: AiTaskContextSnapshot, since: string): string | undefined {
  const records = snapshot.records.filter(record => record.createdAt > since).slice(0, 30);
  if (!records.length) return undefined;
  return [
    "## Rich deliverable incremental context",
    `- Project ID: ${projectId}`,
    `- Deliverable ID: ${deliverableId}`,
    `- Changes recorded after: ${since}`,
    "", "## New deliverable records",
    ...records.map(record => `- [${record.kind}] ${record.text}`),
  ].join("\n");
}

function taskContextText(projectId: string, deliverableId: string, snapshot: AiTaskContextSnapshot, workspaceRoot: string): string {
  return [
    "## Rich task scope",
    `- Project ID: ${projectId}`,
    `- Deliverable ID: ${deliverableId}`,
    "",
    deliverableTaskContextBrief(snapshot, resolve(workspaceRoot, snapshot.deliverable.folderPath)),
  ].join("\n");
}

function versionInput(snapshot: AiTaskContextSnapshot): string {
  return JSON.stringify({
    deliverable: snapshot.deliverable,
    records: snapshot.records,
    files: snapshot.files,
    history: snapshot.history,
  });
}

export class DeliverableCodexContextService {
  constructor(
    private readonly taskContext: Pick<DeliverableTaskContextService, "createSnapshot">,
    private readonly elements: Pick<ElementsRepo, "get">,
    private readonly generalWorkspaceRoot = process.env.RICH_PROJECT_ROOT
      ? resolve(process.env.RICH_PROJECT_ROOT)
      : resolve(process.env.HOME ?? process.cwd(), "Documents", "Ai-WorkSpace", "Rich"),
  ) {}

  async build(input: { projectId: string; deliverableId: string; mode: DeliverableContextMode }): Promise<DeliverableCodexContext> {
    if (input.projectId === GENERAL_CODEX_SCOPE && input.deliverableId === GENERAL_CODEX_SCOPE) {
      return { scopeKey: "workbench:general", contextVersion: "workbench-v1", systemInstruction: "Assist the user in Rich. Use the task workbench for plan-based tasks when requested. For workbench documents, read the document first; only create empty heading outlines automatically, and submit substantive content as a proposal for the user to confirm.", initialContext: "通用 Codex 对话；尚未绑定项目或交付物。", allowedMcpTools: ["rich_workbench_manage", "rich_workbench_document", "rich_ai_task_get", "rich_ai_task_report_result"], workspaceRoot: this.generalWorkspaceRoot };
    }
    const snapshot = await this.taskContext.createSnapshot(input.projectId, input.deliverableId);
    const project = await this.elements.get(input.projectId);
    const workspaceRoot = await projectWorkspaceRoot(project);
    if (input.mode === "task" && !workspaceRoot) throw new Error("当前项目未配置可读取的本地目录。");
    return {
      scopeKey: `deliverable:${input.projectId}:${input.deliverableId}`,
      contextVersion: createHash("sha256").update(versionInput(snapshot)).digest("hex"),
      systemInstruction: modeInstruction(input.mode),
      initialContext: input.mode === "task" ? taskContextText(input.projectId, input.deliverableId, snapshot, workspaceRoot!) : contextText(input.projectId, input.deliverableId, snapshot),
      workspaceRoot,
      allowedMcpTools: input.mode === "task" ? [
        "rich_deliverable_get",
        "rich_deliverable_files_get",
        "rich_deliverable_file_read",
        "rich_project_files_get",
        "rich_project_file_read",
        "rich_deliverable_file_write",
        "rich_deliverable_file_copy",
        "rich_deliverable_requirement_update",
        "rich_deliverable_settings_update",
        "rich_deliverable_record_create",
        "rich_deliverable_record_update",
        "rich_deliverable_file_meta_update",
      ] : input.mode === "free" ? [
        "rich_deliverable_record_create",
        "rich_deliverable_record_update",
        "rich_deliverable_requirement_update",
      ] : [],
    };
  }

  async buildIncrementalContext(input: { projectId: string; deliverableId: string; since: string }): Promise<string | undefined> {
    const snapshot = await this.taskContext.createSnapshot(input.projectId, input.deliverableId);
    return incrementalContextText(input.projectId, input.deliverableId, snapshot, input.since);
  }
}
