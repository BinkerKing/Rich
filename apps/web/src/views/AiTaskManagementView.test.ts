import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AiTaskManagementView.tsx", import.meta.url), "utf8");

describe("AI task management view", () => {
  it("opens a type-specific task table with a dismissible, sectioned detail panel", () => {
    expect(source).toContain("AI 任务清单");
    expect(source).toContain("任务清单");
    expect(source).toContain("ConfigurableDataGrid");
    expect(source).toContain("选择任务类型");
    expect(source).toContain("状态筛选");
    expect(source).toContain("待认领");
    expect(source).toContain("继续处理");
    expect(source).toContain("解决");
    expect(source).toContain("删除已选（{selectedTaskIds.size}）");
    expect(source).toContain("setSelectedTaskIds(new Set([...rows].map(String)))");
    expect(source).toContain("删除已选任务及其全部 AI 反馈");
    expect(source).toContain("api.deleteAiManagedTask");
    expect(source).toContain("atm-drawer-backdrop");
    expect(source).toContain("onClick={() => setSelected(undefined)}");
    expect(source).toContain("atm-drawer__section");
    expect(source).toContain("atm-screenshot");
    expect(source).toContain("atm-image-lightbox");
    expect(source).toContain("atm-drawer__close");
    expect(source).toContain("activeRowId={selected}");
    expect(source).not.toContain("TaskWorkbench");
  });
});
