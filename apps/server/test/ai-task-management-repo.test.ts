import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { SqliteAiTaskManagementRepo } from "../src/repos/SqliteAiTaskManagementRepo.js";

describe("AI task management repository", () => {
  it("creates a task, atomically claims it, and preserves concise result nodes", () => {
    const db = openDb(":memory:");
    const repo = new SqliteAiTaskManagementRepo(db);
    const task = {
      id: "ai-task-1",
      rootTaskId: "ai-task-1",
      sceneId: "bug_fix" as const,
      sceneVersion: 1,
      title: "首页列表无法刷新",
      status: "ready" as const,
      input: { text: "列表完成后没有刷新", images: [], materials: [] },
      payload: { page: ["首页"] },
      contextSummary: "初始问题：列表没有刷新。",
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:00.000Z",
    };

    repo.create(task);
    expect(repo.get(task.id)).toEqual(task);
    expect(repo.claim(task.id, "codex-app")).toMatchObject({ ok: true, task: { status: "claimed", claimedBy: "codex-app" } });
    expect(repo.claim(task.id, "another-agent")).toMatchObject({ ok: false, conflict: { currentAgentId: "codex-app" } });

    repo.addNode({
      id: "node-1", taskId: task.id, sequence: 1, kind: "result", statusAfter: "needs_review",
      analysis: "未订阅任务更新事件。", result: "已补充刷新事件。", carryForward: "后续检查切页后的订阅重连。",
      resourceIds: [], createdBy: "external_ai", createdAt: "2026-09-13T00:05:00.000Z",
    });
    expect(repo.listNodes(task.id)).toEqual([expect.objectContaining({ id: "node-1", result: "已补充刷新事件。" })]);
  });
});
