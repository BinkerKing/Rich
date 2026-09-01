import { describe, expect, it } from "vitest";
import type { GreatMeRepo } from "../src/repos/GreatMeRepo.js";
import { syncProjectPlanTasks } from "../src/services/projectPlanTaskSync.js";

class MemoryGreatMeRepo implements GreatMeRepo {
  constructor(public value: unknown) {}
  async get() { return this.value; }
  async put(value: unknown) { this.value = value; }
}

describe("project plan task sync", () => {
  it("keeps only open delivery tasks and includes the project name", async () => {
    const repo = new MemoryGreatMeRepo({ version: 4, tasks: [{ id: "personal", title: "个人任务" }] });
    await syncProjectPlanTasks(repo, { id: "project-a", title: "数据治理" }, [
      { id: "open", projectId: "project-a", moduleKey: "deliveryPlan", title: "核对字段", sortOrder: 0, content: { kind: "task", status: "doing", dueDate: "2026-09-05" }, createdAt: "", updatedAt: "" },
      { id: "future", projectId: "project-a", moduleKey: "deliveryPlan", title: "未来待办", sortOrder: 1, content: { kind: "task", status: "todo", startDate: "2026-09-05" }, createdAt: "", updatedAt: "" },
      { id: "today", projectId: "project-a", moduleKey: "deliveryPlan", title: "今天开始", sortOrder: 2, content: { kind: "task", status: "todo", startDate: new Date().toISOString().slice(0, 10) }, createdAt: "", updatedAt: "" },
      { id: "done", projectId: "project-a", moduleKey: "deliveryPlan", title: "已完成", sortOrder: 3, content: { kind: "task", status: "done" }, createdAt: "", updatedAt: "" },
      { id: "phase", projectId: "project-a", moduleKey: "deliveryPlan", title: "阶段", sortOrder: 4, content: { kind: "phase", status: "doing" }, createdAt: "", updatedAt: "" },
    ]);
    expect(repo.value).toMatchObject({ version: 5, tasks: [
      { id: "personal", title: "个人任务" },
      { id: "project-task-open", title: "核对字段", projectName: "数据治理", date: new Date().toISOString().slice(0, 10), source: "project" },
      { id: "project-task-today", title: "今天开始", projectName: "数据治理", date: new Date().toISOString().slice(0, 10), source: "project" },
    ] });
  });

  it("replaces stale project tasks without changing personal tasks", async () => {
    const repo = new MemoryGreatMeRepo({ tasks: [
      { id: "personal", title: "个人任务" },
      { id: "old", title: "旧项目任务", source: "project", projectId: "project-a" },
      { id: "other", title: "其他项目任务", source: "project", projectId: "project-b" },
    ] });
    await syncProjectPlanTasks(repo, { id: "project-a", title: "项目 A" }, []);
    expect(repo.value).toMatchObject({ tasks: [
      { id: "personal" }, { id: "other", projectId: "project-b" },
    ] });
  });

  it("does not write again when the project task snapshot is unchanged", async () => {
    const task = { id: "project-task-open", title: "核对字段", done: false, date: new Date().toISOString().slice(0, 10), badge: "项目", goalId: "", note: "", source: "project", projectId: "project-a", projectName: "项目 A", projectTaskId: "open" };
    const repo = new MemoryGreatMeRepo({ version: 4, tasks: [task] });
    await syncProjectPlanTasks(repo, { id: "project-a", title: "项目 A" }, [
      { id: "open", projectId: "project-a", moduleKey: "deliveryPlan", title: "核对字段", sortOrder: 0, content: { kind: "task", status: "doing", dueDate: "2026-09-05" }, createdAt: "", updatedAt: "" },
    ]);
    expect(repo.value).toEqual({ version: 4, tasks: [task] });
  });
});
