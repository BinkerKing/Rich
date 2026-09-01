import type { McpTask } from "../repos/McpTaskRepo.js";
import type { AiTaskExecutor } from "./AiTaskDispatcher.js";
import { parseAiTaskRequest } from "./types.js";

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

  constructor(options: HermesTaskExecutorOptions = {}) {
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
    const response = await this.fetcher(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, stream: false, messages: [{ role: "user", content: taskPrompt(task.id, parseAiTaskRequest(task.request).profile) }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Hermes HTTP ${response.status}.`);
  }

  private headers(): Record<string, string> { return this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}; }
}

function taskPrompt(taskId: string, profile: string): string {
  return [
    `You are executing Rich deliverable task ${taskId}.`,
    `Permission profile: ${profile}.`,
    "Call rich_task_context_get with this task ID before working.",
    "Create output only with rich_task_write_file; it allows new files only inside the assigned deliverable folder.",
    "When complete, call rich_task_report_result with verification evidence.",
    "Do not use shell commands, direct file-system access, or unscoped Rich tools.",
  ].join("\n");
}
