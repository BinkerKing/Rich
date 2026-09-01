import type { AiTaskRequest } from "../ai-tasks/types.js";

export interface AgentTaskScenario {
  id: string;
  taskType: string;
  toolManifest: readonly string[];
  parseInput(value: unknown): AiTaskRequest;
  title(input: AiTaskRequest): string;
}
