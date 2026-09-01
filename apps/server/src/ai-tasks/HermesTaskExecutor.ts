import type { McpTask } from "../repos/McpTaskRepo.js";
import type { AiTaskExecutor } from "./AiTaskDispatcher.js";
import { parseAiTaskRequest } from "./types.js";
import { DeliverableAnalysisScenario } from "../agent-scenarios/deliverableAnalysisScenario.js";
import { ScenarioRegistry } from "../agent-scenarios/ScenarioRegistry.js";

type HermesTaskExecutorOptions = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  fetcher?: typeof fetch;
};

export class HermesTaskExecutor implements AiTaskExecutor {
  readonly executor = "hermes" as const;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly fetcher: typeof fetch;

  constructor(
    options: HermesTaskExecutorOptions = {},
    private readonly scenarios = new ScenarioRegistry([new DeliverableAnalysisScenario()]),
  ) {
    this.baseUrl = options.baseUrl ?? process.env.HERMES_BASE_URL ?? "http://127.0.0.1:8642";
    this.apiKey = options.apiKey ?? process.env.HERMES_API_KEY;
    this.model = options.model ?? process.env.HERMES_MODEL ?? "hermes";
    this.fetcher = options.fetcher ?? fetch;
  }

  async available(): Promise<boolean> {
    try { return (await this.fetcher(`${this.baseUrl}/v1/models`, { headers: this.headers(), signal: AbortSignal.timeout(2_000) })).ok; }
    catch { return false; }
  }

  async execute(task: McpTask): Promise<void> {
    const request = parseAiTaskRequest(task.request);
    const scenario = this.scenarios.get(request.scenario);
    const response = await this.fetcher(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, stream: false, messages: [{ role: "user", content: taskPrompt(task.id, request.profile, scenario.toolManifest) }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Hermes HTTP ${response.status}.`);
  }

  private headers(): Record<string, string> { return this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}; }
}

function taskPrompt(taskId: string, profile: string, toolManifest: readonly string[]): string {
  return [
    `You are executing Rich task ${taskId}.`,
    `Permission profile: ${profile}.`,
    `You may call only these task-scoped MCP tools: ${toolManifest.join(", ")}.`,
    "Call rich_task_context_get with this task ID before working when it is available.",
    toolManifest.includes("rich_task_report_result") ? "When complete, call rich_task_report_result with verification evidence." : "Report completion through the scenario's declared tools.",
    "Do not use shell commands, direct file-system access, or unscoped Rich tools.",
  ].join("\n");
}
