import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../src/db/sqlite.js";
import { SqliteWorkbenchRepo } from "../src/task-workbench/repository.js";
import { WorkbenchService } from "../src/task-workbench/service.js";
import { WorkbenchCommands } from "../src/task-workbench/commands.js";
import { taskWorkbenchRoutes } from "../src/routes/taskWorkbench.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import { registerWorkbenchTools } from "../src/mcp-v2/resources/workbenchTools.js";
import { SqliteMcpOperationRepo } from "../src/repos/SqliteMcpOperationRepo.js";
import type { WorkbenchTask } from "@ke/domain";

describe("workbench API and MCP", () => {
  let db: ReturnType<typeof openDb>; let directory: string; let tasks: WorkbenchService; let task: WorkbenchTask;
  const conversation = { id: "c1", conversationId: "runtime-c1", projectId: "__general__", deliverableId: "__general__", status: "active" };
  let agents: { start: ReturnType<typeof vi.fn>; sendMessage: ReturnType<typeof vi.fn>; isRunning: ReturnType<typeof vi.fn> };
  let commands: WorkbenchCommands;
  beforeEach(async () => {
    db = openDb(":memory:"); directory = await mkdtemp(join(tmpdir(), "rich-workbench-test-"));
    tasks = new WorkbenchService(new SqliteWorkbenchRepo(db), { get: async () => conversation as any });
    task = await tasks.create({ title: "分析", conversationId: "c1", requirement: "核对 Mapping" });
    agents = { start: vi.fn(async () => ({})), isRunning: vi.fn(() => false), sendMessage: vi.fn(async (_id, _input, onEvent) => {
      await onEvent({ type: "turn", status: "running" });
      return { turn: { status: "succeeded" } };
    }) };
    commands = new WorkbenchCommands(tasks, agents as any, { build: async () => ({ workspaceRoot: directory }) } as any);
  });
  afterEach(async () => { db?.close(); await rm(directory, { recursive: true, force: true }); });
  const post = (path: string, body: unknown) => taskWorkbenchRoutes(tasks, commands, directory).request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("versions requirements only when the user confirms, preserving confirmed baselines across drafts", async () => {
    const app = taskWorkbenchRoutes(tasks, commands, directory);
    const history = async () => {
      const response = await app.request(`/${task.id}/requirement-history`);
      expect(response.status).toBe(200);
      return (await response.json()).versions;
    };
    const update = async (input: unknown) => { task = await tasks.write(task.id, { action: "update", expectedVersion: task.version, input }); };
    const confirm = async () => { task = await tasks.write(task.id, { action: "confirm", expectedVersion: task.version, input: { target: "requirement", evidence: "用户确认" } }); };
    await update({ requirement: "核对 Mapping 并交付字典", acceptance: "字段完整" });
    expect(await history()).toEqual([]);
    await confirm();
    const first = (await history())[0];
    expect(first.version).toBe(1);
    expect(first.requirement).toBe("核对 Mapping 并交付字典");
    await confirm(); // Repeated confirmation of an unchanged, confirmed requirement is not a new version.
    expect(await history()).toEqual([first]);
    for (let i = 0; i < 101; i++) {
      task = await tasks.write(task.id, { action: "record", expectedVersion: task.version, input: { kind: "progress", text: `进展 ${i}` } });
    }
    await update({ requirement: "仅核对 Mapping" });
    await update({ acceptance: "" });
    expect(task.requirementConfirmed).toBe(false);
    expect(await history()).toEqual([first]);
    await confirm();
    const versions = await history();
    expect(versions.map((item: any) => item.version)).toEqual([1, 2]);
    expect(versions[0]).toEqual(first);
    expect(versions[1].requirement).toBe("仅核对 Mapping");
    expect(versions[1].acceptance).toBe("");
    expect(versions[0]).not.toHaveProperty("records");
    await update({ openQuestions: "待补充范围" });
    expect(task.requirementConfirmed).toBe(false);
    expect(task.planConfirmed).toBe(false);
    expect(await history()).toEqual(versions);
    await confirm();
    expect((await history()).map((item: any) => item.version)).toEqual([1, 2, 3]);
    expect((await app.request("/missing/requirement-history")).status).toBe(404);
  });
  it("rejects unconfirmed execution without contacting Codex", async () => {
    const response = await post(`/${task.id}/commands`, { action: "execute", requestId: "run1", expectedVersion: 1 });
    expect(response.status).toBe(409); expect(agents.sendMessage).not.toHaveBeenCalled();
    expect((await tasks.get(task.id)).commands).toHaveLength(0);
  });
  it("accepts MCP checkpoint definitions and user answers through the API with version checks", async () => {
    task = await tasks.write(task.id, { action: "plan", expectedVersion: task.version, input: { steps: [{ id: "s1", title: "部署" }] } });
    const registry = new RichToolRegistry(); registerWorkbenchTools(registry, tasks, new SqliteMcpOperationRepo(db));
    const result = await registry.invoke("rich_workbench_manage", { action: "checkpoint", taskId: task.id, expectedVersion: task.version, input: { id: "env", stepId: "s1", title: "部署环境" }, context: { requestId: "checkpoint1" } });
    expect(result.ok).toBe(true);
    task = await tasks.get(task.id);
    const version = task.version;
    const response = await post(`/${task.id}/write`, { action: "answer", expectedVersion: version, input: { id: "env", answer: "测试环境" } });
    expect(response.status).toBe(200);
    expect((await tasks.get(task.id)).checkpoints?.[0].answer).toBe("测试环境");
    expect((await post(`/${task.id}/write`, { action: "answer", expectedVersion: version, input: { id: "env", answer: "过期覆盖" } })).status).toBe(409);
  });
  it("dispatches exactly once to the bound chat and never marks a task complete on turn end", async () => {
    const body = { action: "clarify", requestId: "clarify1", expectedVersion: 1 };
    expect((await post(`/${task.id}/commands`, body)).status).toBe(202);
    await vi.waitFor(async () => expect((await tasks.get(task.id)).commands[0].status).toBe("finished"));
    expect((await post(`/${task.id}/commands`, body)).status).toBe(202);
    expect(agents.sendMessage).toHaveBeenCalledTimes(1);
    expect(agents.sendMessage.mock.calls[0][0]).toBe("runtime-c1");
    expect(agents.sendMessage.mock.calls[0][1].content).toContain(task.id);
    expect((await tasks.get(task.id)).status).toBe("draft");
  });
  it("records runtime failure and refuses a second command while the conversation is busy", async () => {
    agents.isRunning.mockReturnValue(true);
    expect((await post(`/${task.id}/commands`, { action: "clarify", requestId: "blocked1", expectedVersion: 1 })).status).toBe(409);
    agents.isRunning.mockReturnValue(false); agents.sendMessage.mockRejectedValue(new Error("Codex unavailable"));
    expect((await post(`/${task.id}/commands`, { action: "clarify", requestId: "failure1", expectedVersion: 1 })).status).toBe(202);
    await vi.waitFor(async () => expect((await tasks.get(task.id)).commands[0].error).toBe("Codex unavailable"));
    expect((await tasks.get(task.id)).commands[0].status).toBe("failed");
  });
  it("uploads real material, registers its location and downloads only registered files", async () => {
    const app = taskWorkbenchRoutes(tasks, commands, directory);
    const form = new FormData(); form.append("file", new File(["field,rule\nA,direct"], "mapping.csv")); form.append("expectedVersion", "1");
    const response = await app.request(`/${task.id}/materials`, { method: "POST", body: form });
    expect(response.status).toBe(201);
    const next = (await response.json()).task as WorkbenchTask;
    expect(next.resources[0].kind).toBe("material");
    const file = await app.request(`/${task.id}/resources/${next.resources[0].id}/download`);
    expect(await file.text()).toContain("A,direct");
    expect(file.headers.get("content-type")).toBe("application/octet-stream");
    expect((await app.request(`/${task.id}/resources/missing/download`)).status).toBe(404);
  });
  it("MCP creation is idempotent and validates stale writes through the same application service", async () => {
    const registry = new RichToolRegistry(); registerWorkbenchTools(registry, tasks, new SqliteMcpOperationRepo(db));
    const input = { action: "create", input: { title: "通过 MCP 创建", requirement: "分析文件", conversationId: "c1" }, context: { requestId: "create1" } };
    const first = await registry.invoke("rich_workbench_manage", input);
    expect(first.ok).toBe(true);
    expect(await registry.invoke("rich_workbench_manage", input)).toEqual(first);
    expect(await tasks.list()).toHaveLength(2);
    const update = await registry.invoke("rich_workbench_manage", { action: "plan", taskId: task.id, expectedVersion: 1, input: { steps: [{ id: "s1", title: "核对" }] }, context: { requestId: "plan1" } });
    expect(update.ok).toBe(true);
    const stale = await registry.invoke("rich_workbench_manage", { action: "step", taskId: task.id, expectedVersion: 1, input: { id: "s1", status: "running" }, context: { requestId: "step1" } });
    expect(stale).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});
