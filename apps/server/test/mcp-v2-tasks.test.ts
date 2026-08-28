import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { PersistentTaskService } from "../src/mcp-v2/tasks/persistentTaskService.js";
import { registerTaskTools } from "../src/mcp-v2/tasks/taskTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import { SqliteMcpOperationRepo } from "../src/repos/SqliteMcpOperationRepo.js";
import { SqliteMcpTaskRepo } from "../src/repos/SqliteMcpTaskRepo.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function makeDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "rich-mcp-tasks-"));
  tempDirs.push(directory);
  const path = join(directory, "rich.db");
  const db = openDb(path);
  return { db, path };
}

describe("MCP 2.0 persistent work tasks", () => {
  it("persists tasks across SQLite reopen and filters them by status", async () => {
    const { db, path } = makeDatabase();
    const service = new PersistentTaskService(new SqliteMcpTaskRepo(db));
    const queued = await service.create({ type: "agent", title: "实现搜索", request: { prompt: "优化搜索" } });
    const running = await service.create({ type: "agent", title: "补充测试", request: { prompt: "补测试" } });
    await service.transition(running.id, "running", { progressSummary: "正在分析" });
    db.close();

    const reopened = openDb(path);
    const reopenedService = new PersistentTaskService(new SqliteMcpTaskRepo(reopened));
    await expect(reopenedService.get(queued.id)).resolves.toMatchObject({ title: "实现搜索", status: "queued" });
    await expect(reopenedService.list({ status: "running" })).resolves.toEqual([
      expect.objectContaining({ id: running.id, progressSummary: "正在分析" }),
    ]);
    reopened.close();
  });

  it("enforces the task state machine and rejects terminal transitions", async () => {
    const { db } = makeDatabase();
    const service = new PersistentTaskService(new SqliteMcpTaskRepo(db));
    const task = await service.create({ type: "agent", title: "执行任务", request: {} });

    await expect(service.transition(task.id, "running")).resolves.toMatchObject({ status: "running", startedAt: expect.any(String) });
    await expect(service.transition(task.id, "succeeded", { progressSummary: "完成" })).resolves.toMatchObject({
      status: "succeeded",
      finishedAt: expect.any(String),
    });
    await expect(service.transition(task.id, "running")).rejects.toMatchObject({ code: "CONFLICT" });
    db.close();
  });

  it("exposes status and list tools with a stable response envelope", async () => {
    const { db } = makeDatabase();
    const service = new PersistentTaskService(new SqliteMcpTaskRepo(db));
    const task = await service.create({ type: "agent", title: "整理项目", request: {} });
    const registry = new RichToolRegistry();
    registerTaskTools(registry, { tasks: service, operationRepo: new SqliteMcpOperationRepo(db) });

    await expect(registry.invoke("rich_work_get_status", { taskId: task.id })).resolves.toMatchObject({
      ok: true,
      data: { task: { id: task.id, status: "queued" } },
      refs: [{ type: "work_task", id: task.id }],
    });
    await expect(registry.invoke("rich_work_list", { status: "queued" })).resolves.toMatchObject({
      ok: true,
      data: { tasks: [expect.objectContaining({ id: task.id })] },
    });
    db.close();
  });

  it("requires confirmation and cancels the external task before updating local state", async () => {
    const { db } = makeDatabase();
    const order: string[] = [];
    const cancelExternal = vi.fn(async () => { order.push("external"); });
    const repo = new SqliteMcpTaskRepo(db);
    const service = new PersistentTaskService(repo, { cancelExternal });
    const task = await service.create({
      type: "agent",
      title: "交给 Codex",
      request: {},
      backend: "codex",
      externalTaskId: "codex-1",
    });
    const originalSave = repo.save.bind(repo);
    repo.save = async value => {
      if (value.status === "cancelled") order.push("local");
      return originalSave(value);
    };
    const registry = new RichToolRegistry();
    registerTaskTools(registry, { tasks: service, operationRepo: new SqliteMcpOperationRepo(db) });

    await expect(registry.invoke("rich_work_cancel", {
      taskId: task.id,
      context: { requestId: "cancel-1" },
    })).resolves.toMatchObject({ ok: false, error: { code: "CONFIRMATION_REQUIRED" } });

    await expect(registry.invoke("rich_work_cancel", {
      taskId: task.id,
      reason: "不再需要",
      context: { requestId: "cancel-1" },
      options: { confirmDestructive: true },
    })).resolves.toMatchObject({ ok: true, data: { task: { status: "cancelled" } }, verification: { status: "verified" } });
    expect(cancelExternal).toHaveBeenCalledWith(expect.objectContaining({ externalTaskId: "codex-1" }));
    expect(order).toEqual(["external", "local"]);
    db.close();
  });

  it("does not mark an external task cancelled when no cancellation adapter exists", async () => {
    const { db } = makeDatabase();
    const service = new PersistentTaskService(new SqliteMcpTaskRepo(db));
    const task = await service.create({
      type: "agent",
      title: "外部任务",
      request: {},
      backend: "multica",
      externalTaskId: "multi-1",
    });
    const registry = new RichToolRegistry();
    registerTaskTools(registry, { tasks: service, operationRepo: new SqliteMcpOperationRepo(db) });

    await expect(registry.invoke("rich_work_cancel", {
      taskId: task.id,
      context: { requestId: "cancel-no-adapter" },
      options: { confirmDestructive: true },
    })).resolves.toMatchObject({ ok: false, error: { code: "DEPENDENCY_UNAVAILABLE" } });
    await expect(service.get(task.id)).resolves.toMatchObject({ status: "queued" });
    db.close();
  });
});
