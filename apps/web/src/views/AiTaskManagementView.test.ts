import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AiTaskManagementView.tsx", import.meta.url), "utf8");

describe("AI task management view", () => {
  it("opens one type-specific task table at a time with status filtering and review actions", () => {
    expect(source).toContain("AI 任务管理");
    expect(source).toContain("任务清单");
    expect(source).toContain("ConfigurableDataGrid");
    expect(source).toContain("选择任务类型");
    expect(source).toContain("状态筛选");
    expect(source).toContain("待认领");
    expect(source).toContain("继续处理");
    expect(source).toContain("解决");
    expect(source).not.toContain("TaskWorkbench");
  });
});
