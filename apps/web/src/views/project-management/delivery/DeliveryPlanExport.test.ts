import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDeliveryExportFilename, buildDeliveryExportRows, buildDeliveryExportWorkbook, buildGanttExportRows, buildGanttExportTimeline } from "./DeliveryPlanExport.js";

test("交付计划导出文件名包含项目名称和秒级时间序号", () => {
  assert.equal(
    buildDeliveryExportFilename("SAFE 报送", new Date(2026, 8, 2, 8, 34, 56)),
    "SAFE 报送_交付计划_20260902_083456.xlsx",
  );
});

test("交付计划导出保留列表的 WBS、层级、计划日期和依赖", () => {
  const rows = buildDeliveryExportRows([
    { id: "phase", title: "实施", kind: "phase", status: "doing", wbsCode: "1", depth: 0, phaseIndex: 0, progress: 40, startDate: "2026-09-01", dueDate: "2026-09-10", baselineDueDate: "2026-09-09", periodDays: 7, actualPersonDays: 2, dependencyIds: [], owner: "张三" },
    { id: "task", parentId: "phase", title: "联调", kind: "task", status: "todo", wbsCode: "1.1", depth: 1, phaseIndex: 0, progress: 0, startDate: "2026-09-03", actualStartDate: "2026-09-04", dueDate: "2026-09-12", baselineDueDate: "2026-09-10", periodDays: 6, actualPersonDays: 1, dependencyIds: ["phase"], owner: "李四" },
  ]);

  assert.deepEqual(rows[0], ["WBS / 事项", "类型 / 所属", "状态", "自动进度", "进度偏移", "计划开始时间", "实际开始时间", "实际结束时间", "周期（工作日）", "计划结束时间", "实际人天", "前置依赖", "负责人"]);
  assert.deepEqual(rows[2], ["1.1 联调", "任务 / 实施", "待开始", "0%", "0 天", "2026-09-03", "2026-09-04", "2026-09-12", "6 天", "2026-09-10", "1 人天", "1 实施", "李四"]);
});

test("甘特图导出时间轴覆盖任务日期并保留今天标记", () => {
  const timeline = buildGanttExportTimeline([
    { id: "task", title: "联调", kind: "task", status: "doing", wbsCode: "1", depth: 0, phaseIndex: 0, progress: 30, startDate: "2026-09-03", dueDate: "2026-09-05" },
  ], "2026-09-04");

  assert.deepEqual(timeline.dates, ["2026-09-03", "2026-09-04", "2026-09-05"]);
  assert.equal(timeline.todayIndex, 1);
});

test("甘特图导出为日期列，并标识任务、里程碑和今天", () => {
  const rows = buildGanttExportRows([
    { id: "task", title: "联调", kind: "task", status: "doing", wbsCode: "1", depth: 0, phaseIndex: 0, progress: 30, startDate: "2026-09-03", dueDate: "2026-09-05" },
    { id: "milestone", title: "完成", kind: "milestone", status: "todo", wbsCode: "", depth: 1, phaseIndex: 0, progress: 0, startDate: "2026-09-05", dueDate: "2026-09-05" },
  ], "2026-09-04");

  assert.deepEqual(rows[0], ["WBS / 任务名称", "负责人", "状态", "09/03", "今天 09/04", "09/05"]);
  assert.deepEqual(rows[1], ["1 联调", "—", "进行中 30%", "■", "■", "■"]);
  assert.deepEqual(rows[2], ["⚑ 完成", "—", "节点", "", "", "⚑"]);
});

test("导出工作簿固定包含甘特图和 Excel 列表两个 Sheet", () => {
  const workbook = buildDeliveryExportWorkbook([
    { id: "task", title: "联调", kind: "task", status: "doing", wbsCode: "1", depth: 0, phaseIndex: 0, progress: 30, startDate: "2026-09-03", dueDate: "2026-09-05" },
  ], "2026-09-04");

  assert.deepEqual(workbook.SheetNames, ["甘特图", "Excel 列表"]);
  assert.equal(workbook.Sheets["甘特图"]?.A2?.v, "1 联调");
  assert.equal(workbook.Sheets["Excel 列表"]?.A2?.v, "1 联调");
});
