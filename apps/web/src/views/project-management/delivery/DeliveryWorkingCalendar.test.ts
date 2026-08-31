import assert from "node:assert/strict";
import { test } from "node:test";
import { addWorkingDays, china2026HolidayDates, ganttTimelineDates, syncDeliverySchedule, workingDaysBetween } from "./DeliveryPlanModel.js";

test("预置 2026 年中国法定节假日，不含调休补班日", () => {
  assert.equal(china2026HolidayDates.length, 33);
  assert.deepEqual(china2026HolidayDates.slice(0, 3), ["2026-01-01", "2026-01-02", "2026-01-03"]);
  assert.deepEqual(china2026HolidayDates.slice(-7), ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]);
  assert.equal(china2026HolidayDates.includes("2026-02-14"), false);
  assert.equal(china2026HolidayDates.includes("2026-10-10"), false);
});

test("假期不计入任务的工作日和基线截止日期", () => {
  const holidays = ["2026-10-02"];

  assert.equal(addWorkingDays("2026-10-01", 3, holidays), "2026-10-06");
  assert.equal(workingDaysBetween("2026-10-01", "2026-10-06", holidays), 3);
  assert.deepEqual(
    syncDeliverySchedule({ startDate: "2026-10-01", periodDays: 1 }, { periodDays: 3 }, holidays),
    { periodDays: 3, baselineDueDate: "2026-10-06" },
  );
});

test("任务工作日最小为一天", () => {
  assert.deepEqual(
    syncDeliverySchedule({ startDate: "2026-10-01", periodDays: 3 }, { periodDays: 0 }),
    { periodDays: 1, baselineDueDate: "2026-10-01" },
  );
});

test("工作日时间轴剔除周末和配置的假期", () => {
  assert.deepEqual(
    ganttTimelineDates("2026-10-01", "2026-10-06", "working", ["2026-10-02"]),
    ["2026-10-01", "2026-10-05", "2026-10-06"],
  );
});
