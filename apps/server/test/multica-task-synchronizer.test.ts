import { describe, expect, it, vi } from "vitest";
import type { WorkDelegationPort } from "../src/mcp-v2/delegation/WorkDelegationPort.js";
import { MulticaTaskSynchronizer } from "../src/mcp-v2/delegation/multica/MulticaTaskSynchronizer.js";
import { PersistentTaskService } from "../src/mcp-v2/tasks/persistentTaskService.js";
import type { McpTask, McpTaskListOptions, McpTaskRepo } from "../src/repos/McpTaskRepo.js";

class MemoryTasks implements McpTaskRepo {
  tasks = new Map<string, McpTask>();
  create(task: McpTask) { this.tasks.set(task.id, structuredClone(task)); }
  get(id: string) { return structuredClone(this.tasks.get(id) ?? null); }
  list(options: McpTaskListOptions = {}) {
    return Array.from(this.tasks.values()).filter(task => !options.status || task.status === options.status).map(task => structuredClone(task));
  }
  save(task: McpTask) { this.tasks.set(task.id, structuredClone(task)); }
}

describe("MulticaTaskSynchronizer", () => {
  it("refreshes only active Multica tasks and persists their external status", async () => {
    const repo = new MemoryTasks();
    const service = new PersistentTaskService(repo);
    const multica = await service.create({ type: "agent", title: "Multica work", request: {}, backend: "multica-cli", externalTaskId: "issue-1" });
    await service.create({ type: "agent", title: "Other work", request: {}, backend: "other", externalTaskId: "other-1" });
    const adapter: WorkDelegationPort = {
      backend: "multica-cli",
      delegate: vi.fn(),
      getStatus: vi.fn(async () => ({ status: "running" as const, progressSummary: "member is coding" })),
      cancel: vi.fn(),
    };
    const synchronizer = new MulticaTaskSynchronizer(repo, adapter);

    await synchronizer.syncOnce();

    expect(adapter.getStatus).toHaveBeenCalledTimes(1);
    expect(adapter.getStatus).toHaveBeenCalledWith("issue-1");
    expect(repo.get(multica.id)).toMatchObject({ status: "running", progressSummary: "member is coding", lastSyncedAt: expect.any(String) });
  });

  it("prevents overlapping sync passes and reports per-task failures", async () => {
    const repo = new MemoryTasks();
    const service = new PersistentTaskService(repo);
    await service.create({ type: "agent", title: "Multica work", request: {}, backend: "multica-cli", externalTaskId: "issue-1" });
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const onError = vi.fn();
    const adapter: WorkDelegationPort = {
      backend: "multica-cli", delegate: vi.fn(), cancel: vi.fn(),
      getStatus: vi.fn(async () => { await pending; throw new Error("network"); }),
    };
    const synchronizer = new MulticaTaskSynchronizer(repo, adapter, { onError });
    const first = synchronizer.syncOnce();
    const overlapping = synchronizer.syncOnce();
    release();
    await Promise.all([first, overlapping]);
    expect(adapter.getStatus).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
