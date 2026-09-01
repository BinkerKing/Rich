import { parseAiTaskRequest, type AiTaskRequest } from "../ai-tasks/types.js";
import type { AgentTaskScenario } from "./types.js";

function titleText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(quot|amp|lt|gt|nbsp);/gi, (_match, entity: string) => ({ quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " " })[entity.toLowerCase()] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export class DeliverableAnalysisScenario implements AgentTaskScenario {
  readonly id = "deliverable_analysis";
  readonly taskType = "deliverable-ai-task";
  readonly toolManifest = [
    "rich_task_context_get",
    "rich_deliverable_history_get",
    "rich_task_report_result",
  ] as const;

  parseInput(value: unknown): AiTaskRequest {
    const request = parseAiTaskRequest(value);
    if (request.scenario !== this.id) throw new Error(`Expected scenario ${this.id}.`);
    return request;
  }

  title(input: AiTaskRequest): string {
    return titleText(input.instructions).slice(0, 160);
  }
}
