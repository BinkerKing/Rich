import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AiTaskCapture.tsx", import.meta.url), "utf8");

describe("AiTaskCapture task list", () => {
  it("uses the active project-management menu in the quick task location", () => {
    expect(source).toContain('document.querySelector<HTMLElement>(".prj-ws__nav-btn[aria-selected=\\"true\\"]")');
    expect(source).toContain('return menu ? `${root} / ${menu}` : root;');
  });

  it("places a red BUG label and location before the task title", () => {
    expect(source).toContain("gridTemplateColumns: \"72px 150px minmax(0, 1fr) 150px 142px 92px\"");
    expect(source).toContain("<span>定位</span><span>任务</span>");
    expect(source).toContain('task.sceneId === "bug_fix" ? "#ff6269"');
  });

  it("offers inline accept and continue actions for completed bugs", () => {
    expect(source).toContain('aria-label="验收完成"');
    expect(source).toContain('aria-label="继续处理"');
    expect(source).toContain("api.resolveAiManagedTask(task.id)");
    expect(source).toContain("api.continueAiManagedTask(task.id)");
    expect(source).toContain("原始 Bug 任务 ID：${task.id}");
  });

  it("records bug tasks without a redeploy request by default", () => {
    expect(source).toContain('gitDeployLatest: false');
  });
});
