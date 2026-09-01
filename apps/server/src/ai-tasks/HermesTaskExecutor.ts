import type { McpTask } from "../repos/McpTaskRepo.js";
import type { AiTaskExecutor } from "./AiTaskDispatcher.js";
import { parseAiTaskRequest } from "./types.js";
import { DeliverableAnalysisScenario } from "../agent-scenarios/deliverableAnalysisScenario.js";
import { ScenarioRegistry } from "../agent-scenarios/ScenarioRegistry.js";
import { deliverableTaskBrief, effectiveAcceptanceCriteria } from "./deliverableTaskBrief.js";

type HermesTaskExecutorOptions = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  taskTimeoutMs?: number;
  fetcher?: typeof fetch;
};

const DEFAULT_TASK_TIMEOUT_MS = 10 * 60_000;

export function hermesTaskTimeoutMs(value = Number(process.env.HERMES_TASK_TIMEOUT_MS)): number {
  return Number.isFinite(value) && value >= 30_000 ? value : DEFAULT_TASK_TIMEOUT_MS;
}

export class HermesTaskExecutor implements AiTaskExecutor {
  readonly executor = "hermes" as const;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly fetcher: typeof fetch;
  private readonly taskTimeoutMs: number;

  constructor(
    options: HermesTaskExecutorOptions = {},
    private readonly scenarios = new ScenarioRegistry([new DeliverableAnalysisScenario()]),
  ) {
    this.baseUrl = options.baseUrl ?? process.env.HERMES_BASE_URL ?? "http://127.0.0.1:8642";
    this.apiKey = options.apiKey ?? process.env.HERMES_API_KEY;
    this.model = options.model ?? process.env.HERMES_MODEL ?? "hermes";
    this.fetcher = options.fetcher ?? fetch;
    this.taskTimeoutMs = hermesTaskTimeoutMs(options.taskTimeoutMs);
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
      headers: { ...this.headers(), "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ model: this.model, stream: true, session_id: task.id, messages: [{ role: "user", content: taskPrompt(task.id, request, scenario.toolManifest) }] }),
      signal: AbortSignal.timeout(this.taskTimeoutMs),
    });
    if (!response.ok) throw new Error(`Hermes HTTP ${response.status}.`);
    if (!response.body) throw new Error("Hermes returned no response stream.");
    const reader = response.body.getReader();
    while (!(await reader.read()).done) { /* keep the agent request alive until Hermes completes it */ }
  }

  private headers(): Record<string, string> { return this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}; }
}

function taskPrompt(taskId: string, request: ReturnType<typeof parseAiTaskRequest>, toolManifest: readonly string[]): string {
  return [
    `You are executing Rich task ${taskId}.`,
    `Permission profile: ${request.profile}.`,
    "", deliverableTaskBrief(request),
    "", "## Acceptance criteria", ...effectiveAcceptanceCriteria(request).map(item => `- ${item}`),
    "",
    `You may call only these task-scoped MCP tools: ${toolManifest.join(", ")}.`,
    "Call rich_task_context_get with this task ID before working when it is available.",
    toolManifest.includes("rich_task_material_read") ? "Use rich_task_material_read for every listed frozen file before using any local file-reading tool." : "",
    toolManifest.includes("rich_task_reference_read") ? "Use rich_task_reference_read for frozen records that explicitly name a file, such as a code-navigation document." : "",
    toolManifest.includes("rich_task_report_result") ? "When complete, call rich_task_report_result with verification evidence." : "Report completion through the scenario's declared tools.",
    "Do not use shell commands, direct file-system access, or unscoped Rich tools.",
  ].join("\n");
}
