import assert from "node:assert/strict";
import { test } from "node:test";
import { actualStartDateFor, buildDeliveryDashboard, buildGanttRows, buildGanttTimelineRange, plannedDueDate } from "./DeliveryPlanModel.js";

test("实际开始时间默认跟随计划开始，未开始且已到期时显示为今天", () => {
  assert.equal(actualStartDateFor({ id: "future", title: "未来任务", startDate: "2026-09-03", status: "todo" }, "2026-09-01"), "2026-09-03");
  assert.equal(actualStartDateFor({ id: "pending", title: "等待任务", startDate: "2026-08-28", status: "todo" }, "2026-09-01"), "2026-09-01");
  assert.equal(actualStartDateFor({ id: "started", title: "执行任务", startDate: "2026-08-28", actualStartDate: "2026-08-30", status: "doing" }, "2026-09-01"), "2026-08-30");
});

test("驾驶舱截止日期优先使用计划结束时间，并兼容旧任务的截止日期", () => {
  assert.equal(plannedDueDate({ id: "scheduled", title: "联调", status: "doing", dueDate: "2026-09-12", baselineDueDate: "2026-09-05" }), "2026-09-05");
  assert.equal(plannedDueDate({ id: "legacy", title: "旧任务", status: "doing", dueDate: "2026-09-12" }), "2026-09-12");
});

test("交付计划按日期生成甘特行，并将逾期未完成事项标识为风险", () => {
  const rows = buildGanttRows([
    { id: "done", title: "需求基线", startDate: "2026-08-01", dueDate: "2026-08-10", status: "done" },
    { id: "late", title: "联调测试", startDate: "2026-08-12", dueDate: "2026-08-20", status: "doing" },
  ], "2026-08-28");

  assert.equal(rows[0]?.progress, 100);
  assert.equal(rows[1]?.isAtRisk, true);
});

test("进度根据计划天数和进度偏移自动计算", () => {
  const rows = buildGanttRows([
    { id: "scheduled", title: "开发", startDate: "2026-08-01", baselineDueDate: "2026-08-11", status: "doing" },
    { id: "offset", title: "测试", startDate: "2026-08-01", baselineDueDate: "2026-08-11", progressOffsetDays: 2, status: "doing" },
  ], "2026-08-06");

  assert.equal(rows.find(row => row.id === "scheduled")?.progress, 50);
  assert.equal(rows.find(row => row.id === "offset")?.progress, 70);
});

test("驾驶舱汇总临期、阻塞和完成进度", () => {
  const dashboard = buildDeliveryDashboard([
    { id: "a", title: "开发", startDate: "2026-08-01", dueDate: "2026-09-30", status: "doing" },
    { id: "b", title: "联调报告", startDate: "2026-08-15", dueDate: "2026-08-29", status: "todo" },
    { id: "c", title: "接口确认", startDate: "2026-08-12", dueDate: "2026-08-20", status: "blocked" },
    { id: "d", title: "范围确认", startDate: "2026-08-01", dueDate: "2026-08-10", status: "done" },
  ], "2026-08-28");

  assert.equal(dashboard.completed, 1);
  assert.equal(dashboard.blocked, 1);
  assert.equal(dashboard.dueSoon, 1);
  assert.equal("pendingDeliverables" in dashboard, false);
});

test("甘特图仅为阶段和任务分配 WBS，里程碑不占用编号", () => {
  const rows = buildGanttRows([
    { id: "phase", title: "开发阶段", status: "doing", kind: "phase" },
    { id: "task", parentId: "phase", title: "功能开发", status: "doing", kind: "task" },
    { id: "milestone", parentId: "phase", title: "开发完成", dueDate: "2026-09-01", status: "todo", kind: "milestone" },
  ], "2026-08-28");

  assert.deepEqual(rows.map(row => [row.id, row.wbsCode, row.depth, row.kind, row.hasChildren, row.phaseIndex]), [
    ["phase", "1", 0, "phase", true, 0],
    ["task", "1.1", 1, "task", false, 0],
    ["milestone", "", 1, "milestone", false, 0],
  ]);
});

test("分组参与 WBS 层级，但不改变里程碑和风险点的编号规则", () => {
  const rows = buildGanttRows([
    { id: "phase", title: "UAT", status: "doing", kind: "phase" },
    { id: "group", parentId: "phase", title: "法院UAT测试", status: "doing", kind: "group" },
    { id: "nested-group", parentId: "group", title: "历史问题处理", status: "doing", kind: "group" },
    { id: "task", parentId: "nested-group", title: "继续冻结功能", status: "todo", kind: "task" },
    { id: "milestone", parentId: "phase", title: "法院UAT完成", status: "todo", kind: "milestone" },
  ], "2026-08-28");

  assert.deepEqual(rows.map(row => [row.id, row.wbsCode, row.depth, row.hasChildren]), [
    ["phase", "1", 0, true],
    ["group", "1.1", 1, true],
    ["nested-group", "1.1.1", 2, true],
    ["task", "1.1.1.1", 3, false],
    ["milestone", "", 1, false],
  ]);
});

test("里程碑可直接从属于分组或任务，且不占用 WBS 编号", () => {
  const rows = buildGanttRows([
    { id: "phase", title: "UAT", status: "doing", kind: "phase" },
    { id: "group", parentId: "phase", title: "法院UAT测试", status: "doing", kind: "group" },
    { id: "task", parentId: "group", title: "功能测试", status: "doing", kind: "task" },
    { id: "group-milestone", parentId: "group", title: "用例完成", status: "todo", kind: "milestone" },
    { id: "task-milestone", parentId: "task", title: "功能完成", status: "todo", kind: "milestone" },
  ], "2026-08-28");

  assert.deepEqual(rows.map(row => [row.id, row.wbsCode, row.depth]), [
    ["phase", "1", 0],
    ["group", "1.1", 1],
    ["task", "1.1.1", 2],
    ["task-milestone", "", 3],
    ["group-milestone", "", 2],
  ]);
});

test("风险点从属于任务，不占用 WBS 编号", () => {
  const rows = buildGanttRows([
    { id: "phase", title: "开发阶段", status: "doing", kind: "phase" },
    { id: "task-a", parentId: "phase", title: "功能开发", status: "doing", kind: "task" },
    { id: "risk", parentId: "task-a", title: "接口资源未确认", status: "todo", kind: "risk" },
    { id: "task-b", parentId: "phase", title: "系统测试", status: "todo", kind: "task" },
  ], "2026-08-28");

  assert.deepEqual(rows.map(row => [row.id, row.wbsCode]), [
    ["phase", "1"],
    ["task-a", "1.1"],
    ["risk", ""],
    ["task-b", "1.2"],
  ]);
});

test("甘特图以最早开始日期和最晚结束日期为边界，并在超期时扩展到今天", () => {
  const range = buildGanttTimelineRange([
    { id: "phase", title: "UAT", startDate: "2026-08-24", dueDate: "2026-09-30", status: "doing", kind: "phase" },
    { id: "task", title: "历史问题", startDate: "2026-08-27", dueDate: "2026-09-02", status: "doing", kind: "task" },
  ], "2026-09-11");

  assert.equal(new Date(range.startAt).toISOString().slice(0, 10), "2026-08-24");
  assert.equal(new Date(range.endAt).toISOString().slice(0, 10), "2026-09-30");

  const overdue = buildGanttTimelineRange([
    { id: "phase", title: "已超期阶段", startDate: "2026-08-01", dueDate: "2026-08-20", status: "doing", kind: "phase" },
  ], "2026-08-29");
  assert.equal(new Date(overdue.endAt).toISOString().slice(0, 10), "2026-08-29");
});
