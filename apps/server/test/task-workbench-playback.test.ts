import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { WORKBENCH_SCHEMA, SqliteWorkbenchRepo } from "../src/task-workbench/repository.js";
import { WorkbenchService } from "../src/task-workbench/service.js";
import { WorkbenchCommands } from "../src/task-workbench/commands.js";

describe("workbench playback", () => {
  let db: Database.Database; let service: WorkbenchService; let id: string;
  const write = async (action: string, input: unknown) => service.write(id, { action, input, expectedVersion: (await service.get(id)).version });
  beforeEach(async () => {
    db = new Database(":memory:"); db.exec(WORKBENCH_SCHEMA);
    service = new WorkbenchService(new SqliteWorkbenchRepo(db), { get: async () => ({ id: "chat", conversationId: "runtime-chat", status: "active" } as any) });
    id = (await service.create({ title: "播放测试", conversationId: "chat", requirement: "两步交付" })).id;
    await write("plan", { steps: [{ id: "one", title: "第一步" }, { id: "two", title: "第二步" }] });
    await write("confirm", { target: "requirement", evidence: "确认" });
    await write("confirm", { target: "plan", evidence: "确认" });
    for (const stepId of ["one", "two"]) {
      await write("checkpoint", { id: stepId, stepId, title: "环境就绪" });
      await write("answer", { id: stepId, answer: "已确认" });
    }
    await write("confirm", { target: "requirement", evidence: "确认补充后的 PRD" });
    await write("confirm", { target: "plan", evidence: "确认计划" });
  });
  afterEach(() => db.close());
  async function play(send: (...args: any[]) => Promise<any>) {
    const sendMessage = vi.fn(send);
    const commands = new WorkbenchCommands(service, { start: async () => ({}), isRunning: () => false, sendMessage } as any, { build: async () => ({ workspaceRoot: "/tmp" }) } as any);
    await commands.dispatch(id, { action: "play", expectedVersion: (await service.get(id)).version, requestId: "play1" });
    await vi.waitFor(async () => expect(["finished", "failed"]).toContain((await service.get(id)).commands[0].status));
    return { task: await service.get(id), sendMessage };
  }
  const complete = async (_chat: string, input: any, onEvent: any) => {
    const stepId = input.metadata.stepId;
    if (stepId) {
      expect((await service.get(id)).commands[0].activeStepId).toBe(stepId);
      await onEvent({ type: "activity", text: "开始：执行命令" });
      await onEvent({ type: "delta", text: "正在核对实际结果" });
      await write("step", { id: stepId, status: "running" });
      await write("step", { id: stepId, status: "done", evidence: "输出已核验" });
    } else {
      await write("resource", { kind: "final", title: "报告", location: "/tmp/report.md" });
      await write("update", { status: "completed" });
    }
    return { turn: { status: "succeeded" } };
  };
  it("continues between steps, persists real activity, and only completes with verified writeback", async () => {
    const { task, sendMessage } = await play(complete);
    expect(sendMessage.mock.calls.map(call => call[1].metadata.stepId)).toEqual(["one", "two", undefined]);
    expect(task.status).toBe("completed");
    for (const [, input] of sendMessage.mock.calls) {
      expect(input.content).toContain("rich_workbench_manage get");
      expect(input.content).not.toContain("create.input");
      expect(input.content).not.toContain("当前完整 PRD");
      expect(input.content.length).toBeLessThan(700);
    }
    expect(task.commands[0].events?.some(event => event.stepId === "one" && event.text === "开始：执行命令")).toBe(true);
  });
  it("executes the ready step before stopping at a later unanswered condition", async () => {
    await write("checkpoint", { id: "two", stepId: "two", title: "待确认的新条件" });
    await write("confirm", { target: "plan", evidence: "确认修改后的计划" });
    const { task, sendMessage } = await play(complete);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(task.commands[0].activeStepId).toBe("two");
    expect(task.steps[1].status).toBe("todo");
    expect(task.commands[0].events?.at(-1)?.text).toContain("确认项");
  });
  it("stops after a successful turn that did not actually finish its step", async () => {
    const { task, sendMessage } = await play(async () => ({ turn: { status: "succeeded" } }));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(task.steps[0].status).toBe("todo");
    expect(task.status).not.toBe("completed");
  });
  it("stops on runtime failure without starting the next step", async () => {
    const { task, sendMessage } = await play(async () => { throw new Error("connection lost"); });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(task.commands[0].status).toBe("failed");
    expect(task.commands[0].events?.at(-1)?.text).toContain("connection lost");
  });
  it("prepares a new step's conditions and stops without executing it", async () => {
    await write("plan", { steps: [...(await service.get(id)).steps, { id: "three", title: "新步骤" }] });
    await write("confirm", { target: "plan", evidence: "确认" });
    const { task, sendMessage } = await play(async (...args) => args[1].metadata.stepId === "three" ? { turn: { status: "succeeded" } } : complete(args[0], args[1], args[2]));
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(sendMessage.mock.calls[2][1].content).toContain("暂不执行步骤");
    expect(task.steps[2].status).toBe("todo");
    expect(task.commands[0].status).toBe("failed");
    expect(task.commands[0].error).toContain("确认项未成功保存");
    expect(task.commands[0].activeStepId).toBe("three");
  });
  it("uses child confirmations for a grouping step and aggregates without a redundant parent question", async () => {
    await write("plan", { steps: [{ id: "parent", title: "整体" }, ...(await service.get(id)).steps.map(step => ({ ...step, parentId: "parent" }))] });
    await write("confirm", { target: "plan", evidence: "确认" });
    const { task } = await play(complete);
    expect(task.steps.every(step => step.status === "done")).toBe(true);
  });
  it("aggregates a parent only after its child steps actually finish", async () => {
    await write("plan", { steps: [{ id: "parent", title: "整体" }, ...(await service.get(id)).steps.map(step => ({ ...step, parentId: "parent" }))] });
    await write("checkpoint", { id: "parent", stepId: "parent", title: "整体范围" });
    await write("answer", { id: "parent", answer: "确认" });
    await write("confirm", { target: "requirement", evidence: "确认补充后的 PRD" });
    await write("confirm", { target: "plan", evidence: "确认" });
    const { task } = await play(complete);
    expect(task.steps.every(step => step.status === "done")).toBe(true);
    expect(task.status).toBe("completed");
    expect(task.commands[0].events?.some(event => event.stepId === "parent" && event.text.includes("汇总"))).toBe(true);
  });
});
