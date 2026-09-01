import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./DeliveryWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../ProjectsView.css", import.meta.url), "utf8");

test("删除任务下的交付物活动时，同步删除关联的交付物工作台记录", () => {
  assert.match(source, /deletedActivity\?\.kind === "deliverable"/);
  assert.match(source, /const linkedActivityKey = `\$\{task\.id\}:\$\{activityId\}`/);
  assert.match(source, /listProjectManagementModuleItems\(projectId, "deliverables", undefined, true\)/);
  assert.match(source, /deliverable\.content\.linkedActivityKey === linkedActivityKey/);
  assert.match(source, /archiveDeliverableFolder\(projectId, deliverable\.content\.folderPath\)/);
  assert.match(source, /deleteProjectManagementModuleItem\(projectId, deliverable\.id\)/);
});

test("新增交付物时同步创建带任务和交付物编号的目录", () => {
  assert.match(source, /deliverableFolderPath\(taskCode, task\.title, deliverableNumber, activity\.text, deliverablesRoot\)/);
  assert.match(source, /createDeliverableFolder\(projectId, folderPath\)/);
  const start = source.indexOf('if (activity.kind === "deliverable")');
  const mkdir = source.indexOf("await api.createDeliverableFolder(projectId, folderPath)", start);
  const create = source.indexOf('await api.createProjectManagementModuleItem(projectId, "deliverables"', start);
  assert.ok(mkdir >= start && create > mkdir);
});

test("甘特图日历设置与交付计划顶部工具栏同一行", () => {
  assert.match(source, /view === "gantt" && <>.*<div className="delivery-gantt-calendar-actions delivery__toolbar-calendar-actions"/s);
  assert.doesNotMatch(source, /return <>\s*<div className="delivery-gantt-calendar-actions"/);
});

test("依赖详情默认关闭，打开后才向甘特图传递连线开关", () => {
  assert.match(source, /const \[showDependencies, setShowDependencies\] = useState\(false\)/);
  assert.match(source, /onClick=\{\(\) => setShowDependencies\(current => !current\)\}>详情<\/button>/);
  assert.match(source, /showDependencies=\{showDependencies\}/);
});

test("交付计划默认使用工作日时间轴", () => {
  assert.match(source, /const \[calendarMode, setCalendarMode\] = useState<GanttCalendarMode>\("working"\)/);
});

test("交付计划区分计划与实际起止时间", () => {
  assert.match(source, /actualStartDate: storedActualStartDate \|\| \(status === "todo" \? undefined : actualStartDateFor\(/);
  assert.match(source, /计划开始时间/);
  assert.match(source, /实际开始时间/);
  assert.match(source, /实际结束时间/);
  assert.match(source, /计划结束时间/);
  assert.match(source, /delivery-task-drawer__date-pairs[\s\S]*计划开始时间[\s\S]*计划结束时间[\s\S]*实际开始时间[\s\S]*实际结束时间/);
});

test("新建任务默认今天开始、下一个工作日结束，实际起止保持为空", () => {
  assert.match(source, /const taskSchedule = childTaskScheduleDefaults\(undefined, isoToday\(\)\)/);
  assert.match(source, /const \[actualStartDate, setActualStartDate\] = useState\(""\)/);
  assert.match(source, /const \[dueDate, setDueDate\] = useState\(kind === "task" \? ""/);
  assert.match(source, /计划开始时间[\s\S]*计划结束时间[\s\S]*实际开始时间[\s\S]*实际结束时间/);
});

test("甘特图把等待实际开始的计划区间标为黄色", () => {
  assert.match(source, /actualStartDateFor\(row, isoToday\(\)\)/);
  assert.match(source, /delivery-gantt-split__actual-start-gap/);
  assert.match(source, /const end = actualStartDate;/);
  assert.match(styles, /delivery-gantt-split__actual-start-gap \{[^}]*background:#fde68a/);
});

test("甘特图把提前结束后的计划剩余区间标为深灰色", () => {
  assert.match(source, /const actualEndGap = \(row: DeliveryGanttRow\)/);
  assert.match(source, /row\.status !== "done" \|\| !row\.dueDate \|\| row\.dueDate >= baselineDue\(row\)/);
  assert.match(source, /delivery-gantt-split__actual-end-gap/);
  assert.match(styles, /delivery-gantt-split__actual-end-gap \{[^}]*background:#334155/);
});

test("当天开始任务的粗竖线按状态着色", () => {
  assert.match(source, /row\.kind === "task" && row\.startDate === isoToday\(\)/);
  assert.match(source, /delivery-gantt-split__today-start is-\$\{row\.status\}/);
  assert.match(source, /delivery-gantt-split__today-start/);
  assert.match(source, /has-today-start/);
  assert.match(styles, /\.delivery-gantt-split__time-row \.has-today-start \{ border:2px solid #10b981; \}/);
});

test("当天开始但待开始的粗竖线为黄色", () => {
  assert.match(styles, /delivery-gantt-split__today-start\.is-todo \{ background:#fbbf24/);
  assert.match(styles, /has-today-start\.is-todo \{ border-color:#fbbf24/);
});

test("驾驶舱纳入当天开始的未开始任务，并按状态显示任务编号颜色和计划截止", () => {
  assert.match(source, /row\.status === "doing" \|\| \(row\.status === "todo" && row\.startDate === isoToday\(\)\)/);
  assert.match(source, /plannedDueDate\(task\)/);
  assert.match(source, /delivery-dashboard-task is-\$\{task\.status\}/);
  assert.match(styles, /delivery-dashboard-task\.is-todo .*#ffb22d/);
  assert.match(styles, /delivery-dashboard-task\.is-doing .*#45d49b/);
});

test("驾驶舱任务头部显示今天新增的记录数", () => {
  assert.match(source, /const todayRecordCount = task\.activities\.filter\(activity => activity\.kind === "record" && activity\.createdAt\.slice\(0, 10\) === isoToday\(\)\)\.length;/);
  assert.match(source, /todayRecordCount > 0 && <i className="is-record">今日记录 \{todayRecordCount\}<\/i>/);
  assert.match(styles, /\.delivery-dashboard-task__badges > i\.is-record \{[^}]*color:#8fe8ed/);
});

test("发布结束动态后，任务当天显示已结束、次日从驾驶舱隐藏", () => {
  assert.match(source, /type DeliveryActivityKind = "record" \| "todo" \| "deliverable" \| "risk" \| "reminder" \| "end"/);
  assert.match(source, /activity\.kind === "end"/);
  assert.match(source, /status: activityKind === "end" \? "done" : task\.status/);
  assert.match(source, /row\.endedOn === isoToday\(\)/);
  assert.match(source, /!row\.endedOn \|\| row\.endedOn === isoToday\(\)/);
  assert.match(source, /deadline = task\.endedOn \? "已结束" : plannedDueDate\(task\)/);
  assert.match(source, /\["record", "todo", "deliverable", "risk", "reminder", "end"\] as const/);
});

test("结束动态使用醒目的完成绿色标签", () => {
  assert.match(styles, /\.delivery-dashboard-feed-row\.is-end > i \{ background:#34d399; \}/);
  assert.match(styles, /\.delivery-dashboard-feed-row\.is-end b \{ color:#d1fae5; background:rgba\(6,95,70,\.88\); \}/);
});

test("当天已结束任务在驾驶舱列表末尾显示", () => {
  assert.match(source, /left\.endedOn === isoToday\(\) \? 1 : 0/);
  assert.match(source, /right\.endedOn === isoToday\(\) \? 1 : 0/);
  assert.match(source, /if \(leftEnded !== rightEnded\) return leftEnded - rightEnded/);
});

test("删除结束记录时恢复任务原来的状态和实际结束日期", () => {
  assert.match(source, /previousStatus\?: DeliveryItemStatus/);
  assert.match(source, /previousDueDate\?: string/);
  assert.match(source, /previousStatus: activityKind === "end" \? task\.status : undefined/);
  assert.match(source, /deletedActivity\?\.kind === "end"/);
  assert.match(source, /status: restoreTask \? deletedActivity\.previousStatus \|\| "doing" : task\.status/);
  assert.match(source, /dueDate: restoreTask \? deletedActivity\.previousDueDate \?\? "" : task\.item\.content\.dueDate/);
});

test("甘特图按当前视口可见天数切换逐日网格与日期标签", () => {
  assert.match(source, /const \[timelineZoom, setTimelineZoom\] = useState\(1\)/);
  assert.match(source, /timelineViewportWidth \* \[1, 1\.25, 1\.75, 2\.5\]\[timelineZoom\]!/);
  assert.match(source, /dates\.length \* \[0, 12, 20, 72\]\[timelineZoom\]!/);
  assert.match(source, /const \[timelineViewportWidth, setTimelineViewportWidth\] = useState\(0\)/);
  assert.match(source, /const timelineCanvasWidth = Math\.max\(timelineViewportWidth, timelineWidth \?\? 0\)/);
  assert.match(source, /const timelineCanvasStyle = timelineCanvasWidth \? \{ width: `\$\{timelineCanvasWidth\}px`, minWidth: `\$\{timelineCanvasWidth\}px` \}/);
  assert.match(source, /const visibleDateCount = timelineCanvasWidth && timelineViewportWidth/);
  assert.match(source, /const showDailyGrid = timelineZoom === 3 \|\| visibleDateCount >= 120 \|\| visibleDateCount <= 26/);
  assert.match(source, /const showDailyLabels = timelineZoom === 3 \|\| visibleDateCount <= 26/);
  assert.match(source, /const headerTicks = showDailyLabels \? dailyTicks : dateTicks/);
  assert.match(source, /const gridTicks = showDailyGrid \? dailyTicks : dateTicks/);
  assert.match(source, /aria-label="缩小时间轴" title="缩小时间轴" disabled=\{timelineZoom === 0\} onClick=\{\(\) => setTimelineZoom\(current => Math\.max\(0, current - 1\)\)\}/);
  assert.match(source, /aria-label="放大时间轴" title="放大时间轴" disabled=\{timelineZoom === 3\} onClick=\{\(\) => setTimelineZoom\(current => Math\.min\(3, current \+ 1\)\)\}/);
  assert.match(source, /aria-hidden="true" viewBox="0 0 24 24"/);
  assert.match(source, /style=\{timelineCanvasStyle\}/);
  const zoomStyle = styles.match(/\.delivery-gantt-split__zoom \{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(zoomStyle, /position:absolute/);
  assert.match(styles, /\.delivery-gantt-split__zoom button svg \{ width:15px; height:15px; stroke:currentColor;/);
});

test("分组标题不受分组框宽度裁剪", () => {
  const groupTitleStyle = styles.match(/\.delivery-gantt-split__group-frame > b \{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(groupTitleStyle, /max-width|overflow:hidden|text-overflow/);
});

test("甘特图允许分组、任务和里程碑跨层移动，阶段仅能与阶段排序", () => {
  assert.match(source, /const movingPhase = dragged\.kind === "phase"/);
  assert.match(source, /movingPhase \? target\.kind !== "phase" \|\| placement === "child" : placement !== "child" && target\.kind === "phase"/);
  assert.match(source, /const parentId = movingPhase \? undefined : placement === "child" \? target\.id : target\.parentId/);
  assert.match(source, /draggable=\{row\.kind !== "risk"\}/);
  assert.match(source, /if \(dragged\.kind === "phase"\) \{/);
  assert.match(source, /if \(placement !== "child" && row\.kind === "phase"\) return/);
});

test("交付计划顶部提供双 Sheet Excel 导出", () => {
  assert.match(source, /import \{ buildDeliveryExportRows, buildNativeGanttExport \} from "\.\/DeliveryPlanExport\.js"/);
  assert.match(source, /richWindow\?\.exportDeliveryPlan\?\./);
  assert.match(source, /gantt: buildNativeGanttExport\(rows, isoToday\(\), calendarMode, holidays\)/);
  assert.doesNotMatch(source, /captureDeliveryPlanFrame/);
  assert.doesNotMatch(source, /ganttSnapshotRef/);
});
