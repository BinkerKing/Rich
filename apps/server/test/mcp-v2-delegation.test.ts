import { describe, expect, it, vi } from "vitest";
import type { Element } from "@ke/domain";
import { registerDelegationTools } from "../src/mcp-v2/scenarios/delegateWork.js";
import type { WorkDelegationPort, WorkDelegationStatus } from "../src/mcp-v2/delegation/WorkDelegationPort.js";
import { UnavailableDelegationAdapter } from "../src/mcp-v2/delegation/UnavailableDelegationAdapter.js";
import { PersistentTaskService } from "../src/mcp-v2/tasks/persistentTaskService.js";
import { registerTaskTools } from "../src/mcp-v2/tasks/taskTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import type { McpOperationClaim, McpOperationRecord, McpOperationRepo } from "../src/repos/McpOperationRepo.js";
import type { McpTask, McpTaskListOptions, McpTaskRepo } from "../src/repos/McpTaskRepo.js";

class MemoryOperationRepo implements McpOperationRepo {
  private readonly records = new Map<string, McpOperationRecord>();
  claim(toolName: string, requestId: string, inputHash: string): McpOperationClaim {
    const key = `${toolName}:${requestId}`;
    const record = this.records.get(key);
    if (record) return { claimed: false, record };
    this.records.set(key, { toolName, requestId, inputHash, status: "pending", createdAt: new Date().toISOString() });
    return { claimed: true };
  }
  complete(toolName: string, requestId: string, inputHash: string, response: Parameters<McpOperationRepo["complete"]>[3]): void {
    this.records.set(`${toolName}:${requestId}`, { toolName, requestId, inputHash, status: "completed", response, createdAt: new Date().toISOString() });
  }
  abandon(toolName: string, requestId: string): void { this.records.delete(`${toolName}:${requestId}`); }
}

class MemoryTaskRepo implements McpTaskRepo {
  readonly tasks = new Map<string, McpTask>();
  create(task: McpTask): void { this.tasks.set(task.id, structuredClone(task)); }
  get(id: string): McpTask | null { return structuredClone(this.tasks.get(id) ?? null); }
  list(options: McpTaskListOptions = {}): McpTask[] {
    return Array.from(this.tasks.values()).filter(task => !options.status || task.status === options.status).map(task => structuredClone(task));
  }
  save(task: McpTask): void { this.tasks.set(task.id, structuredClone(task)); }
}

class FakeAdapter implements WorkDelegationPort {
  readonly backend = "fake";
  status: WorkDelegationStatus = { status: "running", progressSummary: "正在执行" };
  delegate = vi.fn(async () => ({ externalTaskId: "external-1", status: "running" as const, progressSummary: "已启动" }));
  getStatus = vi.fn(async () => this.status);
  cancel = vi.fn(async () => undefined);
}

function makeHarness(adapter: WorkDelegationPort = new FakeAdapter()) {
  const taskRepo = new MemoryTaskRepo();
  const operationRepo = new MemoryOperationRepo();
  const elements = new Map<string, Element>();
  const tasks = new PersistentTaskService(taskRepo, {
    cancelExternal: task => adapter.cancel(task.externalTaskId!),
    getExternalStatus: task => adapter.getStatus(task.externalTaskId!),
  });
  const registry = new RichToolRegistry();
  registerTaskTools(registry, { tasks, operationRepo });
  registerDelegationTools(registry, {
    adapter, tasks, operationRepo,
    elements: {
      async list() { return Array.from(elements.values()); },
      async get(id) { return elements.get(id) ?? null; },
      async put(element) { elements.set(element.id, element); },
    } as never,
  });
  return { registry, tasks, taskRepo, elements, adapter };
}

describe("MCP 2.0 work delegation", () => {
  it("delegates externally and only then creates a traceable local task", async () => {
    const adapter = new FakeAdapter();
    const { registry, taskRepo } = makeHarness(adapter);
    const response = await registry.invoke("rich_work_delegate", {
      projectId: "rich",
      title: "实现 Rich MCP 2.0",
      instructions: "按计划实现并运行测试",
      acceptanceCriteria: ["测试通过"],
      requiredCapabilities: ["development"],
      contextRefs: [{ type: "project", id: "rich" }],
      context: { requestId: "delegate-1", conversationId: "chat-1" },
    });
    expect(response).toMatchObject({
      ok: true,
      data: { task: { backend: "fake", externalTaskId: "external-1", status: "running" } },
      verification: { status: "verified" },
    });
    expect(adapter.delegate).toHaveBeenCalledWith(expect.objectContaining({ projectId: "rich", requiredCapabilities: ["development"] }));
    expect(taskRepo.tasks.size).toBe(1);
  });

  it("does not create a fake local task when delegation is unavailable or fails", async () => {
    const unavailable = makeHarness(new UnavailableDelegationAdapter("Multica CLI 未配置"));
    await expect(unavailable.registry.invoke("rich_work_delegate", {
      projectId: "rich", title: "执行任务", instructions: "开始", context: { requestId: "unavailable-1" },
    })).resolves.toMatchObject({ ok: false, error: { code: "DEPENDENCY_UNAVAILABLE", retryable: true } });
    expect(unavailable.taskRepo.tasks.size).toBe(0);

    const failedAdapter = new FakeAdapter();
    failedAdapter.delegate.mockRejectedValueOnce(new Error("agent process exited"));
    const failed = makeHarness(failedAdapter);
    await expect(failed.registry.invoke("rich_work_delegate", {
      projectId: "rich", title: "执行任务", instructions: "开始", context: { requestId: "failed-1" },
    })).resolves.toMatchObject({ ok: false, error: { code: "TASK_FAILED", retryable: true } });
    expect(failed.taskRepo.tasks.size).toBe(0);
  });

  it("synchronizes external status when Rich queries the work task", async () => {
    const adapter = new FakeAdapter();
    const { registry } = makeHarness(adapter);
    const delegated = await registry.invoke("rich_work_delegate", {
      projectId: "rich", title: "执行任务", instructions: "开始", context: { requestId: "delegate-sync" },
    });
    const taskId = delegated.ok ? (delegated.data as { task: McpTask }).task.id : "";
    adapter.status = { status: "running", progressSummary: "已完成 60%" };
    await expect(registry.invoke("rich_work_get_status", { taskId })).resolves.toMatchObject({
      ok: true,
      data: { task: { status: "running", progressSummary: "已完成 60%", lastSyncedAt: expect.any(String) } },
    });

    adapter.status = { status: "succeeded", progressSummary: "测试通过", resultRefs: [{ type: "commit", id: "abc123" }] };

    await expect(registry.invoke("rich_work_get_status", { taskId })).resolves.toMatchObject({
      ok: true,
      data: { task: { status: "succeeded", progressSummary: "测试通过", resultRefs: [{ type: "commit", id: "abc123" }] } },
    });
    expect(adapter.getStatus).toHaveBeenCalledTimes(2);
  });

  it("records accept, reject, and human-review decisions on completed work", async () => {
    const { registry, tasks } = makeHarness();
    const first = await tasks.create({ type: "agent", title: "任务一", request: {} });
    await tasks.transition(first.id, "succeeded", { resultRefs: [{ type: "commit", id: "a1" }] });
    const accepted = await registry.invoke("rich_work_review_result", {
      taskId: first.id, decision: "accepted", notes: "测试与需求一致", context: { requestId: "review-1" },
    });
    expect(accepted).toMatchObject({ ok: true, data: { task: { reviewStatus: "accepted", reviewNotes: "测试与需求一致" } } });

    const second = await tasks.create({ type: "agent", title: "任务二", request: {} });
    await tasks.transition(second.id, "succeeded");
    await expect(registry.invoke("rich_work_review_result", {
      taskId: second.id, decision: "rejected", notes: "缺少回归测试", context: { requestId: "review-2" },
    })).resolves.toMatchObject({ ok: true, data: { task: { reviewStatus: "rejected" } } });
  });

  it("captures reusable learning with a source task reference", async () => {
    const { registry, tasks, elements } = makeHarness();
    const task = await tasks.create({ type: "agent", title: "修复 SQLite ABI", request: {} });
    await tasks.transition(task.id, "succeeded");
    const response = await registry.invoke("rich_learning_capture", {
      taskId: task.id, title: "原生模块 ABI 处理", learning: "切换 Node 版本后重建 better-sqlite3。",
      tags: ["sqlite"], context: { requestId: "learning-1" },
    });
    expect(response).toMatchObject({
      ok: true,
      data: { item: { content: { sourceTask: { id: task.id } } } },
      refs: expect.arrayContaining([{ type: "work_task", id: task.id, label: "修复 SQLite ABI" }]),
    });
    expect(elements.size).toBe(1);
  });
});
