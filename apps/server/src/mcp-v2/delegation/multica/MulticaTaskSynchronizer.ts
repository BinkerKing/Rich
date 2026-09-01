import type { McpTaskRepo, McpTaskStatus } from "../../../repos/McpTaskRepo.js";
import { PersistentTaskService } from "../../tasks/persistentTaskService.js";
import type { WorkDelegationPort } from "../WorkDelegationPort.js";

const ACTIVE_STATUSES: McpTaskStatus[] = ["queued", "running", "waiting_input"];

export class MulticaTaskSynchronizer {
  private timer?: NodeJS.Timeout;
  private syncing = false;
  private readonly tasks: PersistentTaskService;
  private _lastAttemptAt?: string;
  private _lastSuccessAt?: string;
  private _lastError?: string;

  constructor(
    private readonly repo: McpTaskRepo,
    private readonly adapter: WorkDelegationPort,
    private readonly options: { intervalMs?: number; onError?: (error: unknown) => void; availabilityCheck?: () => Promise<void> } = {},
  ) {
    this.tasks = new PersistentTaskService(repo, { getExternalStatus: task => adapter.getStatus(task.externalTaskId!) });
  }

  get lastAttemptAt(): string | undefined { return this._lastAttemptAt; }
  get lastSuccessAt(): string | undefined { return this._lastSuccessAt; }
  get lastError(): string | undefined { return this._lastError; }
  get intervalMs(): number { return this.options.intervalMs ?? 30_000; }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.syncOnce(), this.options.intervalMs ?? 30_000);
    this.timer.unref();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async syncOnce(): Promise<void> {
    this._lastAttemptAt = new Date().toISOString();
    if (this.syncing) return;
    this.syncing = true;
    try {
      await this.options.availabilityCheck?.();
      const lists = await Promise.all(ACTIVE_STATUSES.map(status => this.repo.list({ status, limit: 200 })));
      const candidates = lists.flat().filter(task => (task.backend === "multica-cli" || task.backend === "multica") && task.externalTaskId);
      let failed = false;
      for (const task of candidates) {
        try {
          const external = await this.adapter.getStatus(task.externalTaskId!);
          if (task.type === "deliverable-ai-task" && external.status === "succeeded" && task.resultRefs.length === 0) {
            await this.tasks.transition(task.id, "waiting_input", {
              progressSummary: "Multica completed externally; waiting for the assigned Agent to report results through Rich MCP.",
              lastSyncedAt: new Date().toISOString(),
            });
          } else {
            await this.tasks.transition(task.id, external.status, { ...external, lastSyncedAt: new Date().toISOString() });
          }
        }
        catch (error) {
          failed = true;
          this._lastError = error instanceof Error ? error.message : String(error);
          this.options.onError?.(error);
        }
      }
      if (!failed) { this._lastSuccessAt = new Date().toISOString(); this._lastError = undefined; }
    } catch (error) {
      this._lastError = error instanceof Error ? error.message : String(error);
      this.options.onError?.(error);
    } finally {
      this.syncing = false;
    }
  }
}
