import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./DeliveryWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../ProjectsView.css", import.meta.url), "utf8");
const projectWorkspace = readFileSync(new URL("../../ProjectWorkspace.tsx", import.meta.url), "utf8");

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

test("交付计划任务详情发布交付物时使用项目配置的交付目录", () => {
  assert.match(projectWorkspace, /<DeliveryPlanWorkspace projectId=\{project\.id\} projectName=\{project\.title\} deliverablesRoot=\{c\.defaultDeliverablesDirectory\} \/>/);
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

test("驾驶舱纳入进行中及计划今天结束的任务，并按状态显示彩色粗线任务编号和计划截止", () => {
  assert.match(source, /row\.status === "doing" \|\| plannedDueDate\(row\) === isoToday\(\)/);
  assert.match(source, /plannedDueDate\(task\)/);
  assert.match(source, /delivery-dashboard-task is-\$\{task\.status\}/);
  assert.match(styles, /\.delivery-dashboard-task__head > b \{[^}]*border:3px solid currentColor[^}]*background:transparent/s);
  assert.match(styles, /delivery-dashboard-task\.is-todo \.delivery-dashboard-task__head > b \{ color:#ffb22d;/);
  assert.match(styles, /delivery-dashboard-task\.is-doing \.delivery-dashboard-task__head > b \{ color:#45d49b;/);
});

test("驾驶舱压缩顶部栏并扩大贴边工作区", () => {
  assert.match(styles, /\.delivery--dashboard \{[^}]*padding:6px 6px 8px/s);
  assert.match(styles, /\.delivery-dashboard-header \{[^}]*min-height:44px/s);
  assert.match(styles, /\.delivery-dashboard-kpi \{[^}]*min-height:36px/s);
  assert.match(styles, /\.delivery-dashboard-grid \{[^}]*padding:8px/s);
});

test("动态类型选择器使用无箭头的自适应抽屉，并为每种类型保留语义色", () => {
  assert.match(source, /function ActivityKindDrawer\(/);
  assert.match(source, /createPortal\(/);
  assert.match(source, /spaceBelow >= drawerHeight \|\| spaceBelow >= spaceAbove \? "down" : "up"/);
  assert.match(source, /className=\{`delivery-activity-kind__drawer opens-\$\{direction\}`\}/);
  const dashboardTask = source.slice(source.indexOf("function DashboardTask"), source.indexOf("function EditableActivityText"));
  assert.match(dashboardTask, /<ActivityKindDrawer value=\{activityKind\} onChange=\{onKindChange\}\/>/);
  assert.doesNotMatch(dashboardTask, /<select/);
  assert.match(styles, /\.delivery-activity-kind__trigger \{/);
  assert.match(styles, /\.delivery-activity-kind__trigger \{[^}]*justify-content:center[^}]*border:2px solid var\(--kind-color\)[^}]*background:transparent[^}]*font:800/s);
  assert.match(styles, /\.delivery-activity-kind__drawer\.opens-up \{[^}]*transform-origin:bottom/);
  assert.match(styles, /\.delivery-activity-kind__drawer button \{[^}]*justify-content:center[^}]*border:2px solid var\(--kind-color\)[^}]*font:800[^}]*text-align:center/s);
  assert.match(styles, /\.delivery-activity-kind__drawer button i \{[^}]*position:absolute/);
  assert.match(styles, /\.delivery-activity-kind__drawer button\.is-risk \{[^}]*--kind-color:#fb7185/);
});

test("已选类型按钮与抽屉选项复用同一彩色描边样式", () => {
  assert.match(source, /className=\{`delivery-activity-kind__trigger delivery-activity-kind__option is-\$\{value\}`\}/);
  assert.match(source, /className=\{`delivery-activity-kind__option is-\$\{kind\} \$\{value === kind \? "is-selected" : ""\}`\}/);
  assert.match(styles, /\.delivery-activity-kind__option \{[^}]*border:2px solid var\(--kind-color\)[^}]*background:transparent[^}]*font:800/s);
  assert.match(styles, /\.delivery-activity-kind__option\.is-todo \{ --kind-color:#fbbf24; \}/);
});

test("动态输入框使用与深灰工作区一致的中性表面色", () => {
  assert.match(styles, /\.delivery-dashboard-composer > div:not\(\.delivery-activity-kind\) \{[^}]*border:1px solid rgba\(148,163,184,.38\)[^}]*background:#292d32/s);
  assert.match(styles, /\.delivery-dashboard-composer > div:not\(\.delivery-activity-kind\):focus-within \{[^}]*border-color:rgba\(148,163,184,.72\)/);
});

test("动态类型从选择器到已创建列表使用同一套彩色边框标签", () => {
  assert.match(source, /className=\{`delivery-activity-kind-chip is-\$\{activity\.kind\}`\}/);
  assert.match(styles, /\.delivery-activity-kind-chip \{[^}]*border:2px solid var\(--kind-color\)[^}]*background:transparent[^}]*font-weight:800/s);
  assert.match(styles, /\.delivery-activity-kind-chip\.is-todo \{ --kind-color:#fbbf24; \}/);
  assert.match(styles, /\.delivery-activity-kind-chip\.is-risk \{ --kind-color:#fb7185; \}/);
});

test("进行中的任务不会被未完成的旧结束动态归档", () => {
  assert.match(source, /const endedOn = status === "done" \? activities\.filter\(activity => activity\.kind === "end"\)/);
});

test("驾驶舱任务头部显示今天新增的记录数", () => {
  assert.match(source, /const todayRecordCount = task\.activities\.filter\(activity => activity\.kind === "record" && activity\.createdAt\.slice\(0, 10\) === isoToday\(\)\)\.length;/);
  assert.match(source, /todayRecordCount > 0 && <i className="is-record">今日记录 \{todayRecordCount\}<\/i>/);
  assert.match(styles, /\.delivery-dashboard-task__badges > i\.is-record \{[^}]*color:#8fe8ed/);
});

test("待办清单中的交付物提供独立的图标跳转按钮", () => {
  assert.match(source, /delivery-dashboard-summary__todo-open/);
  assert.match(source, /className="delivery-dashboard-summary__todo-open" aria-label="打开交付物"/);
  assert.match(source, /onClick=\{\(\) => requestDeliverableFocus\(activity\.task\.id, activity\.id\)\}>↗<\/button>/);
  assert.match(styles, /\.delivery-dashboard-summary__todo-open \{/);
});

test("待办清单不显示截止日期", () => {
  const todoSummary = source.slice(source.indexOf('<DashboardSummary title="待办清单"'), source.indexOf('<DashboardSummary title="风险提醒"'));
  assert.doesNotMatch(todoSummary, /截止 \$\{dateText/);
  assert.doesNotMatch(todoSummary, /未排期/);
});

test("待办清单显示全部已筛选待办", () => {
  const todoSummary = source.slice(source.indexOf('<DashboardSummary title="待办清单"'), source.indexOf('<DashboardSummary title="风险提醒"'));
  assert.match(todoSummary, /items=\{todos\.map\(activity =>/);
  assert.doesNotMatch(todoSummary, /todos\.slice\(0, 3\)/);
});

test("当天完成的待办按本地日期保留在清单中", () => {
  assert.match(source, /const todos = allActivities\.filter\(activity => \(activity\.kind === "todo" \|\| activity\.kind === "deliverable"\) && \(!activity\.done \|\| isToday\(activity\.completedAt\)\)\);/);
  assert.match(source, /function isToday\(value\?: string\) \{ return Boolean\(value\) && new Date\(value!\)\.toLocaleDateString\("en-CA"\) === isoToday\(\); \}/);
  assert.match(styles, /\.delivery-dashboard-summary__todo\.is-done span \{ text-decoration:line-through;/);
});

test("待办清单只显示一个完成框", () => {
  assert.match(source, /className="delivery-dashboard-summary__todo-toggle"[\s\S]*?>\{activity\.done \? "✓" : ""\}<\/button>/);
  assert.doesNotMatch(source, /delivery-dashboard-summary__todo-toggle[^>]*><i>/);
  assert.match(styles, /\.delivery \.delivery-dashboard-summary__todo-toggle \{[^}]*width:16px[^}]*height:16px[^}]*box-sizing:border-box[^}]*padding:0[^}]*border:2px solid rgba\(255,211,214,.8\)[^}]*border-radius:3px/);
});

test("风险动态可像待办一样关闭和重新打开", () => {
  assert.match(source, /activity\.kind === "todo" \|\| activity\.kind === "deliverable" \|\| activity\.kind === "risk"/);
  assert.match(source, /activity\.kind === "risk" && activity\.done \? "已关闭"/);
  assert.match(source, /activity\.kind === "risk" \? activity\.done \? "重新打开风险" : "关闭风险"/);
  assert.match(source, /const pendingRisks = risks\.filter\(activity => !activity\.done\)/);
  assert.match(styles, /\.delivery-dashboard-activity\.is-risk\.is-done > i \{ background:#53d6a0;/);
});

test("风险持续显示在今日动态，并可在风险提醒中勾选关闭", () => {
  assert.match(source, /\(activity\.kind === "todo" && !activity\.done\) \|\| \(activity\.kind === "risk" && \(!activity\.done \|\| activity\.completedAt\?\.slice\(0, 10\) === isoToday\(\)\)\)/);
  assert.match(source, /className=\{`delivery-dashboard-summary__risk \$\{activity\.done \? "is-done" : ""\}`\}/);
  assert.match(source, /<i>\{activity\.done \? "✓" : ""\}<\/i>/);
  assert.match(styles, /\.delivery-dashboard-summary__risk \{ display:grid; grid-template-columns:20px minmax\(0,1fr\) auto;/);
});

test("当天关闭的风险仍显示在风险提醒中并带删除线", () => {
  assert.match(source, /const risks = allActivities\.filter\(activity => activity\.kind === "risk" && \(!activity\.done \|\| activity\.completedAt\?\.slice\(0, 10\) === isoToday\(\)\)\)/);
  assert.match(source, /className=\{`delivery-dashboard-summary__risk \$\{activity\.done \? "is-done" : ""\}`\}/);
  assert.match(styles, /\.delivery-dashboard-summary__risk\.is-done span \{ text-decoration:line-through;/);
});

test("驾驶舱仅将逾期作为彩色边框通知，其他截止状态只显示加粗文字", () => {
  assert.match(source, /days !== undefined && days < 0 \? "is-overdue"/);
  assert.match(styles, /\.delivery-dashboard-task__head time \{[^}]*border:0/s);
  assert.match(styles, /\.delivery-dashboard-task__head time\.is-critical \{[^}]*border:0[^}]*font-weight:800/s);
  assert.match(styles, /\.delivery-dashboard-task__head time\.is-overdue \{[^}]*font-weight:800/);
  assert.match(styles, /\.delivery-dashboard-task__head time\.is-overdue \{[^}]*border:2px solid currentColor[^}]*background:transparent/);
  assert.doesNotMatch(styles, /border-bottom:3px solid currentColor|delivery-overdue-pulse|background:linear-gradient\(135deg,#ff4d6d,#ff8a00\)/);
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
  assert.match(source, /import \{ buildDeliveryExportFilename, buildDeliveryExportRows, buildNativeGanttExport \} from "\.\/DeliveryPlanExport\.js"/);
  assert.match(source, /richWindow\?\.exportDeliveryPlan\?\./);
  assert.match(source, /gantt: buildNativeGanttExport\(rows, isoToday\(\), calendarMode, holidays\)/);
  assert.match(source, /filename: buildDeliveryExportFilename\(projectName\)/);
  assert.doesNotMatch(source, /captureDeliveryPlanFrame/);
  assert.doesNotMatch(source, /ganttSnapshotRef/);
});

test("甘特图任务详情复用驾驶舱的记录、待办与交付物操作", () => {
  assert.match(source, /function TaskActivityPanel\(/);
  assert.match(source, /<TaskActivityPanel task=\{row\}/);
  assert.match(source, /\["record", "todo", "deliverable", "risk", "reminder", "end"\] as const/);
  assert.match(source, /<ActivityCard key=\{activity\.id\}/);
  assert.match(source, /onAddActivity=\{addActivity\}/);
  assert.match(source, /onToggleActivity=\{toggleActivity\}/);
  assert.match(source, /onUpdateActivityText=\{updateActivityText\}/);
});

test("任务动态与驾驶舱可直接粘贴图片附件，并以缩略图放大查看", () => {
  assert.match(source, /function pastedImageFiles\(event: ClipboardEvent<HTMLInputElement>\)/);
  assert.match(source, /item\.type\.startsWith\("image\/"\)/);
  assert.match(source, /onPaste=\{event => \{ const pastedFiles = pastedImageFiles\(event\);/);
  assert.match(source, /if \(!nextText && files\.length === 0\) return;/);
  assert.match(source, /function ActivityAttachments\(/);
  assert.match(source, /new CustomEvent\("ke-lightbox-open"/);
  assert.match(styles, /\.delivery-dashboard-activity__attachment\.is-image \{[^}]*cursor:zoom-in/);
});

test("编辑已有动态时可直接粘贴图片并追加为附件", () => {
  assert.match(source, /const addActivityAttachments = async \(task: DeliveryItem, activityId: string, files: File\[\]\) =>/);
  assert.match(source, /attachments: \[\.\.\.\(activity\.attachments \|\| \[\]\), \.\.\.attachments\]/);
  assert.match(source, /onAddAttachments=\{\(activityId, files\) => addActivityAttachments\(task, activityId, files\)\}/);
  assert.match(source, /onAddAttachments=\{files => onAddAttachments\(activity\.id, files\)\}/);
  assert.match(source, /void onAddAttachments\(pastedFiles\)/);
});

test("甘特图任务详情默认展开任务信息以便编辑", () => {
  assert.match(source, /const \[infoExpanded, setInfoExpanded\] = useState\(true\)/);
  assert.match(source, /className="delivery-task-drawer__info-toggle"/);
  assert.match(source, /\{infoExpanded && <><div className="delivery-task-drawer__form"/);
  assert.match(source, /className="delivery-task-drawer__info-actions"/);
  assert.doesNotMatch(source, /delivery-task-drawer__risks/);
  assert.doesNotMatch(source, /onAddRisk/);
  assert.match(styles, /\.delivery-task-drawer__panel \{[^}]*width:50%/);
  assert.match(styles, /\.delivery-task-drawer__activities \{[^}]*flex:1 1 auto/);
  assert.match(styles, /\.delivery-task-drawer__activities \.delivery-dashboard-activity \{[^}]*min-height:38px/);
});

test("任务详情紧凑排列字段且动态时间线从顶部堆叠", () => {
  assert.match(source, /className="delivery-task-drawer__name-row delivery-task-drawer__wide"/);
  assert.match(source, /className="delivery-task-drawer__metrics-row delivery-task-drawer__wide"/);
  assert.doesNotMatch(source, /<label><span>自动进度<\/span>/);
  assert.match(styles, /\.delivery-task-drawer__name-row \{[^}]*grid-template-columns:120px minmax\(0,1fr\)/);
  assert.match(styles, /\.delivery-task-drawer__metrics-row \{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.delivery-task-drawer__activities \.delivery-dashboard-timeline \{[^}]*align-content:start/);
});

test("紧凑任务动态直接显示完整文本，不提供多余展开按钮", () => {
  assert.doesNotMatch(source, /delivery-task-drawer__activity-expand/);
  assert.match(styles, /\.delivery-task-drawer__activities \.delivery-dashboard-activity header strong \{[^}]*white-space:normal/);
});

test("任务详情的完成按钮为直角正方形", () => {
  assert.match(styles, /\.delivery-task-drawer__activities \.delivery-dashboard-check \{[^}]*width:24px!important[^}]*height:24px!important[^}]*min-width:24px!important[^}]*min-height:24px!important[^}]*padding:0!important[^}]*border-radius:0/);
});

test("任务详情动态支持右键打开删除菜单", () => {
  assert.match(source, /onDeleteActivity=\{deleteActivity\}/);
  assert.match(source, /const \[activityMenu, setActivityMenu\] = useState<\{ activityId: string; x: number; y: number \}>\(\)/);
  assert.match(source, /onContextMenu=\{event => \{ event\.preventDefault\(\); setActivityMenu\(\{ activityId: activity\.id, x: event\.clientX, y: event\.clientY \}\); \}\}/);
  assert.match(source, /className="delivery-dashboard-activity-menu"/);
  assert.match(source, /onDeleteActivity\(task, activityMenu\.activityId\)/);
});
