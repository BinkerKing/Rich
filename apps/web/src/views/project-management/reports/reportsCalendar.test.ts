import assert from "node:assert/strict";
import test from "node:test";
import { calendarDays } from "./reportsCalendar.js";

test("月历补齐前后月份日期并按周一开始", () => {
  const days = calendarDays("2026-08-30");

  assert.equal(days.length, 42);
  assert.equal(days[0], "2026-07-27");
  assert.equal(days[34], "2026-08-30");
});
