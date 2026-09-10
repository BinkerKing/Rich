import { expect, it } from "vitest";
import { recordStepTarget, stepRecordEntries } from "./stepRecordEntries.js";
import type { WorkbenchTask } from "@ke/domain";

it("keeps newest useful activity while suppressing internal execution lifecycle noise", () => {
  const task = { commands: [{ id: "c", events: [
    { id: "start", at: "2026-09-05T01:00:00Z", text: "开始：调用工具 · rich_workbench_manage" },
    { id: "end", at: "2026-09-05T01:00:01Z", text: "结束：调用工具 · rich_workbench_manage" },
    { id: "dispatch", at: "2026-09-05T01:00:02Z", text: "已向 Codex 发送执行指令" },
    { id: "command", at: "2026-09-05T01:00:03Z", text: "开始：执行命令" },
    { id: "result", at: "2026-09-05T01:00:04Z", stepId: "one", text: "已保存确认项" },
    { id: "error", at: "2026-09-05T01:00:05Z", stepId: "two", text: "执行停止：写入失败" },
  ] }], records: [{ id: "old", kind: "progress", createdAt: "2026-09-05T00:00:00Z", stepId: "three", text: "准备工作" }] } as WorkbenchTask;
  expect(stepRecordEntries(task).map(entry => entry.text)).toEqual(["执行停止：写入失败", "已保存确认项", "准备工作"]);
});

it("deduplicates a repeated execution record for the same step", () => {
  const task = { commands: [{ id: "c", events: [{ id: "event", at: "2026-09-05T01:00:00Z", stepId: "one", text: "部署已完成" }] }], records: [{ id: "record", kind: "progress", createdAt: "2026-09-05T00:59:00Z", stepId: "one", text: "部署已完成" }] } as WorkbenchTask;
  expect(stepRecordEntries(task)).toHaveLength(1);
});

it("keeps only the newest record for each smallest step", () => {
  const task = { commands: [{ id: "c", events: [{ id: "old", at: "2026-09-05T01:00:00Z", stepId: "one", text: "开始处理" }, { id: "new", at: "2026-09-05T01:01:00Z", stepId: "one", text: "正在处理配置" }] }] } as WorkbenchTask;
  expect(stepRecordEntries(task).map(entry => entry.text)).toEqual(["正在处理配置"]);
});

it("uses the smallest relevant child step for a parent-scoped record", () => {
  const task = { steps: [{ id: "parent", title: "大任务" }, { id: "child-a", parentId: "parent", title: "最小任务 A" }, { id: "child-b", parentId: "parent", title: "最小任务 B" }], checkpoints: [{ id: "c", stepId: "child-a" }] } as WorkbenchTask;
  expect(recordStepTarget(task, "parent")).toEqual({ id: "child-a", label: "最小任务 A" });
  expect(recordStepTarget(task, "child-b")).toEqual({ id: "child-b", label: "最小任务 B" });
});
