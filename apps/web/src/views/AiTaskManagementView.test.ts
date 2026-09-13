import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AiTaskManagementView bug workflow", () => {
  it("shows a red BUG type and location before the task title", () => {
    const source = readFileSync(new URL("./AiTaskManagementView.tsx", import.meta.url), "utf8");
    expect(source).toContain('{ key: "type", name: "类型"');
    expect(source).toContain('{ key: "page", name: "定位"');
    expect(source).toContain('task.sceneId === "bug_fix" ? "🔴 BUG"');
  });

  it("lets a completed bug be accepted or continued in its linked Codex conversation", () => {
    const source = readFileSync(new URL("./AiTaskManagementView.tsx", import.meta.url), "utf8");
    expect(source).toContain('aria-label="验收完成"');
    expect(source).toContain('aria-label="继续处理"');
    expect(source).toContain("openBoundCodex({ projectId: \"__general__\"");
    expect(source).toContain("executionTaskId: next.id");
    expect(source).toContain("原始 Bug 任务 ID：${packet.task.id}");
  });
});
