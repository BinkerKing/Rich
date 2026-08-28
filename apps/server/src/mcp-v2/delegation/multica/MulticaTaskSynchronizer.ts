import type { McpTaskRepo, McpTaskStatus } from "../../../repos/McpTaskRepo.js";
import { PersistentTaskService } from "../../tasks/persistentTaskService.js";
import type { WorkDelegationPort } from "../WorkDelegationPort.js";

const ACTIVE_STATUSES: McpTaskStatus[] = ["queued", "running", "waiting_input"];

export class MulticaTaskSynchronizer {
  private timer?: NodeJS.Timeout;
  private syncing = false;
  private readonly tasks: PersistentTaskService;

  constructor(
    private readonly repo: McpTaskRepo,
    adapter: WorkDelegationPort,
    private readonly options: { intervalMs?: number; onError?: (error: unknown) => void } = {},
  ) {
    this.tasks = new PersistentTaskService(repo, { getExternalStatus: task => adapter.getStatus(task.externalTaskId!) });
  }

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
    if (this.syncing) return;
    this.syncing = true;
    try {
      const lists = await Promise.all(ACTIVE_STATUSES.map(status => this.repo.list({ status, limit: 200 })));
      const candidates = lists.flat().filter(task => task.backend === "multica-cli" && task.externalTaskId);
      for (const task of candidates) {
        try { await this.tasks.sync(task.id); } catch (error) { this.options.onError?.(error); }
      }
    } finally {
      this.syncing = false;
    }
  }
}
