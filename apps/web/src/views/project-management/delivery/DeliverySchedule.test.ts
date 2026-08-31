import assert from "node:assert/strict";
import { test } from "node:test";
import * as schedule from "./DeliveryPlanModel.js";

test("周期与基线截止日期按工作日双向换算", () => {
  const sync = (schedule as typeof schedule & {
    syncDeliverySchedule?: (current: { startDate?: string; baselineDueDate?: string; periodDays?: number }, patch: Record<string, unknown>) => Record<string, unknown>;
  }).syncDeliverySchedule;

  assert.ok(sync, "应提供交付计划日期联动计算");
  assert.deepEqual(sync({ startDate: "2026-09-01", periodDays: 1 }, { periodDays: 4 }), {
    periodDays: 4,
    baselineDueDate: "2026-09-04",
  });
  assert.deepEqual(sync({ startDate: "2026-09-01", periodDays: 3 }, { baselineDueDate: "2026-09-04" }), {
    baselineDueDate: "2026-09-04",
    periodDays: 4,
  });
});

test("新下级任务使用父任务开始日、空当前截止和一个工作日基线", () => {
  const defaults = (schedule as typeof schedule & {
    childTaskScheduleDefaults?: (parentStartDate?: string, today?: string) => Record<string, unknown>;
  }).childTaskScheduleDefaults;

  assert.ok(defaults, "应提供新下级任务的日期默认值");
  assert.deepEqual(defaults("2026-08-28", "2026-08-31"), {
    startDate: "2026-08-28",
    dueDate: "",
    baselineDueDate: "2026-08-28",
    periodDays: 1,
    actualPersonDays: 0,
  });
});

test("甘特条形占满截止日期所在的自然日方格", () => {
  const endBoundary = (schedule as typeof schedule & {
    ganttEndBoundary?: (date: string) => string;
  }).ganttEndBoundary;

  assert.ok(endBoundary, "应提供甘特结束日的右边界计算");
  assert.equal(endBoundary("2026-09-03"), "2026-09-04");
  assert.equal(endBoundary("2026-09-04"), "2026-09-05");
  assert.equal(endBoundary("2026-09-03"), "2026-09-04", "1–3 日任务的右边界应与 4 日开始任务的左边界相接");
});
