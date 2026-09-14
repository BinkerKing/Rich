import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AiTaskManagementView bug workflow", () => {
  it("shows a red BUG type and location before the task title", () => {
    const source = readFileSync(new URL("./AiTaskManagementView.tsx", import.meta.url), "utf8");
    expect(source).toContain('{ key: "type", name: "类型"');
    expect(source).toContain('{ key: "page", name: "定位"');
    expect(source).toContain('{ key: "redeploy", name: "是否重新部署"');
    expect(source).toContain('redeploy: task.payload.gitDeployLatest === true ? "是" : "否"');
    expect(source).toContain('rich.ai-task-table.bug.columns.v2');
    expect(source).toContain('className="atm-task-type atm-task-type--bug"');
  });

  it("shows inline review actions for a completed bug and continues it in its linked Codex conversation", () => {
    const source = readFileSync(new URL("./AiTaskManagementView.tsx", import.meta.url), "utf8");
    expect(source).toContain('aria-label="验收完成"');
    expect(source).toContain('aria-label="继续处理"');
    expect(source).toContain('className="atm-review-actions"');
    expect(source).toContain('className="atm-review-accept"');
    expect(source).toContain("openBoundCodex({ projectId: \"__general__\"");
    expect(source).toContain("executionTaskId: next.id");
    expect(source).toContain('buildBugCodexContext(next, task.id)');
  });

  it("includes the inherited Bug context and screenshots when continuing in Codex", () => {
    const source = readFileSync(new URL("./AiTaskManagementView.tsx", import.meta.url), "utf8");
    expect(source).toContain('buildBugCodexContext(next, task.id)');
    expect(source).toContain('initialAttachments: bugCodexAttachments(next)');
  });
});
