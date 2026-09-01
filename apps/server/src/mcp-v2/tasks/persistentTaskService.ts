import { randomUUID } from "node:crypto";
import type { McpTask, McpTaskListOptions, McpTaskRepo, McpTaskStatus } from "../../repos/McpTaskRepo.js";
import { RichMcpError } from "../registry/errors.js";

export interface CreateTaskInput {
  type: string;
  title: string;
  request: unknown;
  backend?: string;
  externalTaskId?: string;
  conversationId?: string;
  requestId?: string;
}

export interface TaskTransitionPatch {
  progressSummary?: string;
  resultRefs?: McpTask["resultRefs"];
  error?: string;
  reviewStatus?: McpTask["reviewStatus"];
  reviewNotes?: string;
  lastSyncedAt?: string;
}

export interface PersistentTaskServiceOptions {
  cancelExternal?: (task: McpTask) => Promise<void>;
  getExternalStatus?: (task: McpTask) => Promise<TaskTransitionPatch & { status: McpTaskStatus }>;
}

const ALLOWED: Record<McpTaskStatus, McpTaskStatus[]> = {
  queued: ["running", "waiting_input", "succeeded", "failed", "cancelled"],
  running: ["waiting_input", "succeeded", "failed", "cancelled"],
  waiting_input: ["running", "succeeded", "failed", "cancelled"],
  succeeded: [], failed: [], cancelled: [],
};
const TERMINAL = new Set<McpTaskStatus>(["succeeded", "failed", "cancelled"]);

export class PersistentTaskService {
  constructor(private readonly repo: McpTaskRepo, private readonly options: PersistentTaskServiceOptions = {}) {}

  async create(input: CreateTaskInput): Promise<McpTask> {
    const now = new Date().toISOString();
    const task: McpTask = {
      id: randomUUID(), type: input.type, title: input.title, request: input.request, status: "queued", resultRefs: [],
      ...(input.backend ? { backend: input.backend } : {}), ...(input.externalTaskId ? { externalTaskId: input.externalTaskId } : {}),
      ...(input.conversationId ? { conversationId: input.conversationId } : {}), ...(input.requestId ? { requestId: input.requestId } : {}),
      createdAt: now, updatedAt: now,
    };
    await this.repo.create(task);
    return task;
  }

  async get(id: string): Promise<McpTask> {
    const task = await this.repo.get(id);
    if (!task) throw new RichMcpError("NOT_FOUND", `Work task ${id} was not found.`);
    return task;
  }

  async list(options: McpTaskListOptions = {}): Promise<McpTask[]> {
    return this.repo.list(options);
  }

  async count(options: Pick<McpTaskListOptions, "status"> = {}): Promise<number> {
    return this.repo.count(options);
  }

  async sync(id: string): Promise<McpTask> {
    const current = await this.get(id);
    if (!current.externalTaskId || !this.options.getExternalStatus || TERMINAL.has(current.status)) return current;
    const external = await this.options.getExternalStatus(current);
    return this.transition(id, external.status, { ...external, lastSyncedAt: new Date().toISOString() });
  }

  async annotate(id: string, patch: TaskTransitionPatch): Promise<McpTask> {
    const current = await this.get(id);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await this.repo.save(next);
    return next;
  }

  async transition(id: string, status: McpTaskStatus, patch: TaskTransitionPatch = {}): Promise<McpTask> {
    const current = await this.get(id);
    if (current.status === status) {
      return Object.keys(patch).length > 0 ? this.annotate(id, patch) : current;
    }
    if (!ALLOWED[current.status].includes(status)) {
      throw new RichMcpError("CONFLICT", `Cannot transition work task from ${current.status} to ${status}.`);
    }
    const now = new Date().toISOString();
    const next: McpTask = {
      ...current, ...patch, status, updatedAt: now,
      ...(status === "running" && !current.startedAt ? { startedAt: now } : {}),
      ...(TERMINAL.has(status) ? { finishedAt: now } : {}),
    };
    await this.repo.save(next);
    return next;
  }

  async cancel(id: string, reason?: string): Promise<McpTask> {
    const task = await this.get(id);
    if (TERMINAL.has(task.status)) {
      throw new RichMcpError("CONFLICT", `Work task ${id} is already ${task.status}.`);
    }
    if (task.externalTaskId) {
      if (!this.options.cancelExternal) {
        throw new RichMcpError("DEPENDENCY_UNAVAILABLE", `No cancellation adapter is configured for ${task.backend ?? "external"}.`, { retryable: true });
      }
      await this.options.cancelExternal(task);
    }
    return this.transition(id, "cancelled", { progressSummary: reason ?? "Cancelled by user." });
  }
}
