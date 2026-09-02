import { createHash } from "node:crypto";
import type { AiTaskContextSnapshot } from "../ai-tasks/types.js";
import type { DeliverableTaskContextService } from "../ai-tasks/DeliverableTaskContextService.js";
import type { DeliverableCodexMode } from "../repos/DeliverableCodexConversationRepo.js";

export interface DeliverableCodexContext {
  scopeKey: string;
  contextVersion: string;
  systemInstruction: string;
  initialContext: string;
  allowedMcpTools: string[];
  workspaceRoot?: string;
}

const TASK_WRITEBACK_TOOL = "rich_task_report_result";

function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function modeInstruction(mode: DeliverableCodexMode): string {
  if (mode === "task") {
    return [
      "You are working in Rich task mode for this deliverable.",
      "Use the supplied context and tools to assist the user through ordinary conversation.",
      "You may write a deliverable result only when the user explicitly asks you to write it back.",
      "Never write back merely because a turn is complete or because a result appears useful.",
    ].join("\n");
  }
  if (mode === "bug") {
    return [
      "You are working in Rich bug mode for this deliverable.",
      "Focus on reproduction, observations, expected behavior, likely causes, and a minimal verification path.",
      "Do not write Rich business records or deliverable results.",
    ].join("\n");
  }
  return [
    "You are working in Rich free mode for this deliverable.",
    "Assist with the provided deliverable context through ordinary conversation.",
    "Do not write Rich business records or deliverable results.",
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

function versionInput(snapshot: AiTaskContextSnapshot): string {
  return JSON.stringify({
    deliverable: snapshot.deliverable,
    records: snapshot.records,
    files: snapshot.files,
    history: snapshot.history,
  });
}

export class DeliverableCodexContextService {
  constructor(private readonly taskContext: Pick<DeliverableTaskContextService, "createSnapshot">) {}

  async build(input: { projectId: string; deliverableId: string; mode: DeliverableCodexMode }): Promise<DeliverableCodexContext> {
    const snapshot = await this.taskContext.createSnapshot(input.projectId, input.deliverableId);
    return {
      scopeKey: `deliverable:${input.projectId}:${input.deliverableId}`,
      contextVersion: createHash("sha256").update(versionInput(snapshot)).digest("hex"),
      systemInstruction: modeInstruction(input.mode),
      initialContext: contextText(input.projectId, input.deliverableId, snapshot),
      allowedMcpTools: input.mode === "task" ? [TASK_WRITEBACK_TOOL] : [],
    };
  }
}
