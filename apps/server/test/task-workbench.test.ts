import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { WORKBENCH_SCHEMA, SqliteWorkbenchRepo } from "../src/task-workbench/repository.js";
import { WorkbenchService } from "../src/task-workbench/service.js";
import type { WorkbenchTask } from "@ke/domain";
import { buildWorkbenchCommand } from "../src/task-workbench/commands.js";

describe("task workbench", () => {
  let db: Database.Database; let service: WorkbenchService; let task: WorkbenchTask;
  beforeEach(async () => {
    db = new Database(":memory:"); db.exec(WORKBENCH_SCHEMA);
    service = new WorkbenchService(new SqliteWorkbenchRepo(db), { get: async id => id === "chat-1" ? { id, status: "active", conversationId: "runtime-chat-1" } as any : null });
    task = await service.create({ title: "Mapping", requirement: "分析材料", conversationId: "chat-1" });
  });
  afterEach(() => db.close());
  const plan = { steps: [{ id: "s1", title: "阅读", goal: "核对材料", acceptance: "材料清单" }] };
  const write = async (action: string, input: unknown) => task = await service.write(task.id, { action, input, expectedVersion: task.version });

  it("rebases writes over execution logs without overwriting concurrent business changes", async () => {
    await write("plan", plan);
    const readVersion = task.version;
    await service.mutate(task.id, readVersion, next => next.commands.push({ id: "logging", action: "check", taskVersion: readVersion, prompt: "check", status: "running", createdAt: next.updatedAt, updatedAt: next.updatedAt }));
    task = await service.write(task.id, { action: "checkpoint", expectedVersion: readVersion, input: { id: "c", stepId: "s1", title: "确认环境" } });
    expect(task.checkpoints?.[0].id).toBe("c");
    expect(task.commands[0].id).toBe("logging");
    const stale = task.version;
    await write("record", { kind: "decision", text: "用户的新决定" });
    await expect(service.write(task.id, { action: "checkpoint", expectedVersion: stale, input: { id: "other", stepId: "s1", title: "过期写入" } })).rejects.toThrow("请重新读取");
    expect((await service.get(task.id)).checkpoints).toHaveLength(1);
  });
  it("gates execution on explicit answers, including negative choice answers", async () => {
    await write("plan", plan);
    await write("confirm", { target: "requirement", evidence: "确认" });
    await write("confirm", { target: "plan", evidence: "确认" });
    expect(() => buildWorkbenchCommand(task, "execute", "s1")).toThrow("确认项");
    await write("checkpoint", { id: "env", stepId: "s1", title: "环境是否就绪", options: [{ value: "yes", label: "已就绪", allowsExecution: true }, { value: "no", label: "未就绪", allowsExecution: false }] });
    await expect(write("answer", { id: "env", answer: "unknown" })).rejects.toThrow("有效选项");
    await write("answer", { id: "env", answer: "no" });
    await write("confirm", { target: "requirement", evidence: "确认补充信息" });
    await write("confirm", { target: "plan", evidence: "确认计划" });
    expect(() => buildWorkbenchCommand(task, "execute", "s1")).toThrow("确认项");
    await expect(write("step", { id: "s1", status: "running" })).rejects.toThrow("确认项");
    await write("answer", { id: "env", answer: "yes" });
    await write("confirm", { target: "requirement", evidence: "确认环境变更" });
    await write("confirm", { target: "plan", evidence: "重新确认" });
    expect(buildWorkbenchCommand(task, "execute", "s1")).toContain(task.id);
    expect(buildWorkbenchCommand(task, "execute", "s1")).not.toContain(task.prd);
    await write("step", { id: "s1", status: "running" });
    expect(task.steps[0].status).toBe("running");
  });

  it("keeps button prompts bounded while fetching current task state for every action", async () => {
    await write("update", { prd: "# 大型需求\n" + "完整业务要求。".repeat(2000) });
    await write("plan", plan);
    await write("checkpoint", { id: "ready", stepId: "s1", title: "执行条件" });
    await write("answer", { id: "ready", answer: "已就绪" });
    await write("confirm", { target: "requirement", evidence: "确认" });
    await write("confirm", { target: "plan", evidence: "确认" });
    for (const action of ["clarify", "refine", "optimize", "execute", "check", "play"] as const) {
      const prompt = buildWorkbenchCommand(task, action, "s1");
      expect(prompt).toContain(task.id);
      expect(prompt).toContain(`按钮发起版本：${task.version}`);
      expect(prompt).toContain("仅步骤 s1「阅读」及其子步骤");
      expect(prompt).toContain("rich_workbench_manage get");
      expect(prompt).toContain("最新 expectedVersion");
      expect(prompt).not.toContain(task.prd);
      expect(prompt).not.toContain("create.input");
      expect(prompt.length).toBeLessThan(700);
    }
    expect(buildWorkbenchCommand(task, "execute")).toContain("执行范围：整个任务");
  });

  it("accepts explicit free text alongside preset choices and preserves it in the PRD", async () => {
    await write("plan", plan);
    const question = { id: "target", stepId: "s1", title: "目标环境", options: [{ value: "local", label: "本机", allowsExecution: true }, { value: "no", label: "未具备", allowsExecution: false }] };
    await write("checkpoint", question);
    await expect(write("answer", { id: "target", answer: "自定义环境" })).rejects.toThrow("有效选项");
    await write("answer", { id: "target", answer: "独立 Linux 测试机", answerMode: "text" });
    expect(task.checkpoints?.[0].answerMode).toBe("text");
    expect(task.prd).toContain("独立 Linux 测试机");
    await write("checkpoint", question);
    expect(task.checkpoints?.[0].answer).toBe("独立 Linux 测试机");
    await write("confirm", { target: "requirement", evidence: "确认" });
    await write("confirm", { target: "plan", evidence: "确认" });
    expect(() => buildWorkbenchCommand(task, "execute", "s1")).not.toThrow();
    await write("answer", { id: "target", answer: "no", answerMode: "option" });
    await expect(write("step", { id: "s1", status: "running" })).rejects.toThrow("确认项");
  });
  it("retains answers through plan edits and invalidates changed questions", async () => {
    await write("plan", plan);
    const question = { id: "version", stepId: "s1", title: "目标版本", options: [] };
    await write("checkpoint", question);
    await write("answer", { id: "version", answer: "v1.2" });
    await write("plan", plan);
    await write("checkpoint", question);
    expect(task.checkpoints?.[0].answer).toBe("v1.2");
    await write("step", { id: "s1", status: "done", evidence: "已核对" });
    await write("checkpoint", { ...question, title: "重新确认目标版本" });
    expect(task.checkpoints?.[0].answer).toBeUndefined();
    expect(task.steps[0].status).toBe("blocked");
    expect(task.records.some(record => record.text.includes("v1.2"))).toBe(true);
  });

  it("inherits parent conditions and prevents bypassing them through child state writes", async () => {
    await write("plan", { steps: [{ id: "parent", title: "部署" }, { id: "child", parentId: "parent", title: "启动" }] });
    await write("checkpoint", { id: "database", stepId: "parent", title: "数据库地址" });
    await write("checkpoint", { id: "port", stepId: "child", title: "端口" });
    await write("answer", { id: "port", answer: "3000" });
    await expect(write("step", { id: "child", status: "running" })).rejects.toThrow("确认项");
    await write("answer", { id: "database", answer: "localhost:5432" });
    await write("step", { id: "child", status: "running" });
    await write("answer", { id: "database", answer: "localhost:5433" });
    expect(task.steps.find(step => step.id === "child")?.status).toBe("todo");
    expect(task.planConfirmed).toBe(false);
  });

  it("persists information without a file, address references, and legacy file resources", async () => {
    await write("resource", { kind: "material", format: "information", title: "数据库连接", content: "host: localhost\nport: 5432\ndatabase: project" });
    await write("resource", { kind: "material", format: "link", title: "SVN 地址", location: "svn://example/repo" });
    await write("resource", { kind: "material", title: "已有文件", location: "/tmp/existing.md" });
    const saved = await service.get(task.id);
    expect(saved.resources).toHaveLength(3);
    expect(saved.resources[0].content).toContain("5432");
    expect(saved.resources[0].location).toBe("");
    await expect(write("resource", { kind: "material", title: "空材料" })).rejects.toThrow("地址或信息");
    await expect(write("resource", { kind: "material", format: "link", title: "无地址", content: "说明" })).rejects.toThrow("需要地址");
  });

  it("persists an independent task and rejects unknown conversation bindings", async () => {
    expect(await new SqliteWorkbenchRepo(db).get(task.id)).toEqual(task);
    await expect(service.create({ title: "bad", requirement: "x", conversationId: "missing" })).rejects.toThrow("对话");
  });
  it("atomically saves versions and rejects lost updates", async () => {
    const version = task.version;
    await write("plan", plan);
    await expect(service.write(task.id, { action: "update", expectedVersion: version, input: { title: "stale" } })).rejects.toThrow("重新读取");
    expect((await service.repo.history(task.id)).map(item => item.version)).toEqual([2, 1]);
    expect((await service.get(task.id)).title).toBe("Mapping");
  });
  it("prevents archiving or rebinding while a command is running", async () => {
    task = await service.mutate(task.id, task.version, current => {
      current.commands.push({ id: "running", action: "clarify", taskVersion: current.version, prompt: "clarify", status: "running", createdAt: current.createdAt, updatedAt: current.createdAt });
    });
    await expect(write("update", { status: "archived" })).rejects.toThrow("不能归档");
    await expect(write("update", { conversationId: "missing" })).rejects.toThrow("对话");
    expect((await service.get(task.id)).status).toBe("draft");
  });
  it("rejects cycles and missing resource/record scope without persisting", async () => {
    await expect(write("plan", { steps: [{ id: "a", parentId: "b", title: "A" }, { id: "b", parentId: "a", title: "B" }] })).rejects.toThrow("循环");
    await expect(write("record", { stepId: "missing", kind: "conclusion", text: "ok" })).rejects.toThrow("步骤不存在");
    expect((await service.get(task.id)).version).toBe(1);
  });
  it("invalidates approval when scope changes but preserves it on progress", async () => {
    await write("plan", plan);
    await write("checkpoint", { id: "c", stepId: "s1", title: "前置环境", options: [] });
    await write("answer", { id: "c", answer: "测试环境就绪" });
    await write("confirm", { target: "requirement", evidence: "用户确认当前理解" });
    await write("confirm", { target: "plan", evidence: "用户确认计划" });
    await write("step", { id: "s1", status: "running" });
    expect(task.planConfirmed).toBe(true);
    await expect(write("step", { id: "s1", goal: "新的范围" })).rejects.toThrow("已执行步骤不能修改");
    expect(task.planConfirmed).toBe(true);
    await write("update", { requirement: "新需求", prd: "# 新需求\n\n更新后的完整需求" });
    expect(task.requirementConfirmed).toBe(false);
  });
  it("keeps executed plan content fixed while reconfirming edits to future steps", async () => {
    await write("plan", { steps: [{ id: "s1", title: "执行部分" }, { id: "s2", title: "未来步骤" }] });
    await write("checkpoint", { id: "c", stepId: "s1", title: "环境" });
    await write("answer", { id: "c", answer: "测试环境" });
    await write("confirm", { target: "requirement", evidence: "确认" });
    await write("confirm", { target: "plan", evidence: "确认" });
    await write("step", { id: "s1", status: "done", evidence: "实际结果" });
    const executed = { ...task.steps[0] };
    await expect(write("plan", { steps: task.steps.map(s => s.id === "s1" ? { ...s, title: "改写历史" } : s) })).rejects.toThrow("已执行步骤不能修改");
    await expect(write("plan", { steps: [...task.steps].reverse() })).rejects.toThrow("不能调整顺序");
    await write("plan", { steps: task.steps.map(s => s.id === "s2" ? { ...s, goal: "新的待执行目标" } : s) });
    expect(task.steps[0]).toEqual(executed);
    expect(task.requirementConfirmed).toBe(true);
    expect(task.planConfirmed).toBe(false);
    await write("confirm", { target: "plan", evidence: "确认未来步骤调整" });
    expect(task.planConfirmed).toBe(true);
    await expect(write("step", { id: "s1", status: "todo" })).rejects.toThrow("不能重置");
  });
  it("keeps the confirmed plan while Codex refines a running step into child steps", async () => {
    await write("plan", plan);
    await write("checkpoint", { id: "c", stepId: "s1", title: "环境" });
    await write("answer", { id: "c", answer: "已就绪" });
    await write("confirm", { target: "requirement", evidence: "确认" });
    await write("confirm", { target: "plan", evidence: "确认" });
    await write("step", { id: "s1", status: "running" });
    await write("plan", { steps: [...task.steps, { id: "s1-a", parentId: "s1", title: "准备配置" }, { id: "s1-b", parentId: "s1", title: "启动应用" }] });
    expect(task.planConfirmed).toBe(true);
    expect(task.steps.find(step => step.id === "s1")?.status).toBe("running");
    await write("plan", { steps: [...task.steps, { id: "s2", title: "新增主步骤" }] });
    expect(task.planConfirmed).toBe(false);
  });
  it("supplements the current requirement without reconfirmation but gates changes to established answers", async () => {
    await write("update", { prd: "# 项目 PRD\n\n## 目标\n保留原有要求", requirementChangeSummary: "整理正文" });
    await write("plan", plan);
    await write("confirm", { target: "requirement", evidence: "确认 v1" });
    await write("confirm", { target: "plan", evidence: "确认" });
    const baseline = await service.repo.requirementHistory(task.id);
    await write("checkpoint", { id: "version", stepId: "s1", title: "版本" });
    await write("answer", { id: "version", answer: "1.2" });
    expect(task.prd).toContain("保留原有要求");
    expect(task.prd).toContain("1.2");
    expect(task.requirementConfirmed).toBe(true);
    expect(task.planConfirmed).toBe(true);
    const supplemented = await service.repo.requirementHistory(task.id);
    expect(supplemented).toHaveLength(1);
    expect(supplemented[0].updatedAt).toBe(baseline[0].updatedAt);
    expect(supplemented[0].prd).toContain("1.2");
    await write("answer", { id: "version", answer: "1.3" });
    expect(task.requirementConfirmed).toBe(false);
    expect(task.planConfirmed).toBe(false);
    expect(await service.repo.requirementHistory(task.id)).toEqual(supplemented);
    expect(task.prd).not.toContain("1.2");
    expect(task.prd).toContain("1.3");
    await write("confirm", { target: "requirement", evidence: "确认 v2" });
    const versions = await service.repo.requirementHistory(task.id);
    expect(versions).toHaveLength(2);
    expect(versions[0].prd).not.toContain("1.3");
    expect(versions[1].prd).toContain("1.3");
    expect(versions[1].requirementChangeSummary).toContain("版本");
  });
  it("preserves approval for explicit supplements but requires it for requirement changes", async () => {
    await write("plan", plan);
    await write("update", { prd: "# 需求\n\n完成部署与测试", requirementUpdateKind: "supplement" });
    expect(task.requirementConfirmed).toBe(false);
    await write("confirm", { target: "requirement", evidence: "确认" });
    await write("confirm", { target: "plan", evidence: "确认" });
    await write("update", { prd: "# 需求\n\n完成部署与测试\n\n## 环境资料\nTomcat 路径已补充", requirementUpdateKind: "supplement" });
    expect(task.requirementConfirmed).toBe(true);
    expect(task.planConfirmed).toBe(true);
    expect(await service.repo.requirementHistory(task.id)).toHaveLength(1);
    await write("update", { prd: "# 需求\n\n仅部署，取消测试", requirementUpdateKind: "change" });
    expect(task.requirementConfirmed).toBe(false);
    expect(task.planConfirmed).toBe(false);
  });
  it("requires evidence, retains executed steps, and does not conflate a report with delivery", async () => {
    await write("plan", plan);
    await write("checkpoint", { id: "c", stepId: "s1", title: "前置环境", options: [] });
    await write("answer", { id: "c", answer: "测试环境就绪" });
    await expect(write("step", { id: "s1", status: "done" })).rejects.toThrow("依据");
    await write("step", { id: "s1", status: "done", evidence: "输出材料清单.md" });
    await expect(write("plan", { steps: [] })).rejects.toThrow("不能删除");
    await expect(write("plan", plan)).rejects.toThrow("覆盖执行记录");
    await expect(write("update", { status: "completed" })).rejects.toThrow("最终产物");
    await write("confirm", { target: "requirement", evidence: "用户确认" });
    await write("confirm", { target: "plan", evidence: "用户确认" });
    await write("resource", { kind: "final", title: "报告", location: "/tmp/report.md" });
    await write("update", { status: "completed" });
    expect(task.status).toBe("completed");
  });
});
