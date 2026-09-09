import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type Dispatch, type DragEvent, type MouseEvent, type ReactNode, type SetStateAction, type WheelEvent } from "react";
import { api, type ProjectModuleItem } from "../../../api/client.js";
import { actualStartDateFor, buildDeliveryDashboard, buildGanttRows, buildGanttTimelineRange, childTaskScheduleDefaults, china2026HolidayDates, ganttEndBoundary, ganttTimelineDates, plannedDueDate, syncDeliverySchedule, workingDaysBetween, type DeliveryItemKind, type DeliveryItemLike, type DeliveryItemStatus, type GanttCalendarMode } from "./DeliveryPlanModel.js";
import { buildDeliveryExportFilename, buildDeliveryExportRows, buildNativeGanttExport } from "./DeliveryPlanExport.js";
import { deliverableFolderPath, linkedDeliverableContent, requestDeliverableFocus } from "../deliverables/DeliverablesModel.js";

type DeliveryActivityKind = "record" | "todo" | "deliverable" | "risk" | "reminder" | "end";
type DeliveryAttachment = { name: string; src: string; size: number };
type DeliveryActivity = { id: string; kind: DeliveryActivityKind; text: string; createdAt: string; done?: boolean; completedAt?: string; author?: string; source?: string; dueDate?: string; previousStatus?: DeliveryItemStatus; previousDueDate?: string; attachments?: DeliveryAttachment[] };
type DeliveryItem = DeliveryItemLike & { item: ProjectModuleItem; activities: DeliveryActivity[]; endedOn?: string };
type PlanView = "gantt" | "table";
type GanttDropPlacement = "before" | "after" | "child";
type GanttExpansionState = { collapsedIds: string[]; milestonePhaseIds: string[]; riskTaskIds: string[] };

function readPlanView(key: string): PlanView {
  try { return window.localStorage.getItem(key) === "table" ? "table" : "gantt"; } catch { return "gantt"; }
}
function readGanttExpansion(key: string): GanttExpansionState {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || "{}");
    const ids = (value: unknown) => Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
    return { collapsedIds: ids(stored.collapsedIds), milestonePhaseIds: ids(stored.milestonePhaseIds), riskTaskIds: ids(stored.riskTaskIds) };
  } catch { return { collapsedIds: [], milestonePhaseIds: [], riskTaskIds: [] }; }
}
function readHolidayDates(key: string): string[] {
  try {
    const dates = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(dates) ? dates.filter((date): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) : [];
  } catch { return []; }
}
async function syncLinkedDeliverableStatus(projectId: string, taskId: string, activity: DeliveryActivity, done: boolean) {
  if (activity.kind !== "deliverable") return;
  const linkedActivityKey = `${taskId}:${activity.id}`;
  const deliverables = await api.listProjectManagementModuleItems(projectId, "deliverables", undefined, true);
  await Promise.all(deliverables.filter(deliverable => deliverable.content.linkedActivityKey === linkedActivityKey).map(deliverable => api.updateProjectManagementModuleItem(projectId, deliverable.id, { content: { ...deliverable.content, status: done ? "accepted" : "preparing" } })));
}
function initializeHolidayDates(key: string): string[] {
  const dates = readHolidayDates(key);
  const presetKey = `${key}:china-2026-preset`;
  try {
    if (window.localStorage.getItem(presetKey)) return dates;
    const initial = [...new Set([...dates, ...china2026HolidayDates])].sort();
    window.localStorage.setItem(key, JSON.stringify(initial));
    window.localStorage.setItem(presetKey, "1");
    return initial;
  } catch { return dates; }
}

function isoToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
function addDays(days: number) { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }
function value(item: ProjectModuleItem, holidays: readonly string[] = []): DeliveryItem {
  const content = item.content;
  const startDate = typeof content.startDate === "string" ? content.startDate : undefined;
  const status = (content.status as DeliveryItemStatus) || "todo";
  const storedActualStartDate = typeof content.actualStartDate === "string" && content.actualStartDate ? content.actualStartDate : undefined;
  const baselineDueDate = typeof content.baselineDueDate === "string" ? content.baselineDueDate : undefined;
  const calculatedPeriodDays = workingDaysBetween(startDate, baselineDueDate, holidays);
  const activities = Array.isArray(content.activities) ? content.activities.flatMap((activity): DeliveryActivity[] => {
    if (!activity || typeof activity !== "object") return [];
    const entry = activity as Record<string, unknown>;
    if ((entry.kind !== "record" && entry.kind !== "todo" && entry.kind !== "deliverable" && entry.kind !== "risk" && entry.kind !== "reminder" && entry.kind !== "end") || typeof entry.text !== "string" || typeof entry.createdAt !== "string") return [];
    const attachments = Array.isArray(entry.attachments) ? entry.attachments.flatMap((attachment): DeliveryAttachment[] => {
      if (!attachment || typeof attachment !== "object") return [];
      const file = attachment as Record<string, unknown>;
      return typeof file.name === "string" && typeof file.src === "string" && typeof file.size === "number" ? [{ name: file.name, src: file.src, size: file.size }] : [];
    }) : [];
    return [{ id: typeof entry.id === "string" ? entry.id : `${entry.createdAt}-${entry.text}`, kind: entry.kind, text: entry.text, createdAt: entry.createdAt, done: entry.done === true, completedAt: typeof entry.completedAt === "string" ? entry.completedAt : undefined, author: typeof entry.author === "string" ? entry.author : undefined, source: typeof entry.source === "string" ? entry.source : undefined, dueDate: typeof entry.dueDate === "string" ? entry.dueDate : undefined, previousStatus: entry.previousStatus === "todo" || entry.previousStatus === "doing" || entry.previousStatus === "blocked" || entry.previousStatus === "done" ? entry.previousStatus : undefined, previousDueDate: typeof entry.previousDueDate === "string" ? entry.previousDueDate : undefined, attachments }];
  }) : [];
  const endedOn = status === "done" ? activities.filter(activity => activity.kind === "end").map(activity => activity.createdAt.slice(0, 10)).sort().at(-1) : undefined;
  return {
    item, id: item.id, title: item.title.replace(/^(?:\d+(?:\.\d+)*|M\d+)\s+/, ""), status,
    startDate,
    actualStartDate: storedActualStartDate || (status === "todo" ? undefined : actualStartDateFor({ startDate, actualStartDate: storedActualStartDate, status }, isoToday())),
    dueDate: typeof content.dueDate === "string" && content.dueDate ? content.dueDate : undefined,
    owner: typeof content.owner === "string" ? content.owner : undefined,
    progress: typeof content.progress === "number" ? content.progress : undefined,
    progressOffsetDays: typeof content.progressOffsetDays === "number" ? content.progressOffsetDays : 0,
    parentId: item.parentId,
    kind: content.kind === "phase" || content.kind === "group" || content.kind === "milestone" || content.kind === "risk" ? content.kind : "task",
    sortOrder: item.sortOrder,
    baselineDueDate,
    periodDays: startDate && baselineDueDate ? calculatedPeriodDays : typeof content.periodDays === "number" ? content.periodDays : calculatedPeriodDays,
    actualPersonDays: typeof content.actualPersonDays === "number" ? content.actualPersonDays : 0,
    dependencyIds: Array.isArray(content.dependencyIds) ? content.dependencyIds.filter((id): id is string => typeof id === "string") : [],
    activities,
    endedOn,
  };
}

async function migrateLegacyDeliverables(projectId: string, items: ProjectModuleItem[]): Promise<ProjectModuleItem[]> {
  let next = [...items];
  for (const deliverable of items.filter(item => item.content.kind === "deliverable" && item.parentId)) {
    const parent = next.find(item => item.id === deliverable.parentId);
    if (!parent) continue;
    const source = `legacy-deliverable:${deliverable.id}`;
    const activities = Array.isArray(parent.content.activities) ? parent.content.activities : [];
    if (!activities.some(activity => activity && typeof activity === "object" && (activity as Record<string, unknown>).source === source)) {
      const updated = await api.updateProjectManagementModuleItem(projectId, parent.id, {
        content: {
          ...parent.content,
          activities: [...activities, { id: crypto.randomUUID(), kind: "deliverable", text: deliverable.title, createdAt: new Date().toISOString(), done: deliverable.content.status === "done", source, dueDate: typeof deliverable.content.dueDate === "string" ? deliverable.content.dueDate : undefined }],
        },
      });
      next = next.map(item => item.id === parent.id ? updated : item);
    }
    await api.deleteProjectManagementModuleItem(projectId, deliverable.id);
    next = next.filter(item => item.id !== deliverable.id);
  }
  return next;
}
function statusLabel(status: DeliveryItemStatus) { return ({ todo: "待开始", doing: "进行中", blocked: "已阻塞", done: "已完成" } as const)[status]; }
function dateText(value?: string) { return value ? value.slice(5).replace("-", "/") : "未排期"; }
function remainingDays(value?: string) {
  return value ? Math.round((Date.parse(`${value}T00:00:00`) - Date.parse(`${isoToday()}T00:00:00`)) / 86_400_000) : undefined;
}
function deadlineText(value?: string) {
  if (!value) return "未设截止";
  const days = remainingDays(value)!;
  if (days === 0) return "今天截止";
  return days > 0 ? `还有 ${days} 天` : `逾期 ${Math.abs(days)} 天`;
}
function deadlineUrgencyClass(value?: string) {
  const days = remainingDays(value);
  return days !== undefined && days < 0 ? "is-overdue" : days !== undefined && days <= 3 ? "is-critical" : days !== undefined && days <= 5 ? "is-near" : "";
}
function kindLabel(kind: DeliveryItemKind) { return ({ phase: "阶段", group: "分组", task: "任务", milestone: "里程碑", risk: "风险点" } as const)[kind]; }
function defaultTitle(kind: DeliveryItemKind) { return kind === "phase" ? "新阶段" : kind === "group" ? "新分组" : kind === "milestone" ? "新里程碑" : "新任务"; }
function activityLabel(kind: DeliveryActivityKind) { return ({ record: "记录", todo: "待办", deliverable: "交付物", risk: "风险", reminder: "催办", end: "结束" } as const)[kind]; }
function pastedImageFiles(event: ClipboardEvent<HTMLInputElement>) {
  return Array.from(event.clipboardData.items).flatMap(item => {
    if (!item.type.startsWith("image/")) return [];
    const file = item.getAsFile();
    return file ? [file] : [];
  });
}
function isImageAttachment(file: DeliveryAttachment) { return /\.(?:png|jpe?g|gif|webp|svg)$/i.test(file.name); }

export function ProjectDashboard({ projectId, onOpenPlan, deliverablesRoot }: { projectId: string; onOpenPlan: () => void; deliverablesRoot?: string }): ReactNode {
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string>();
  const [activityText, setActivityText] = useState("");
  const [activityKind, setActivityKind] = useState<DeliveryActivityKind>("record");
  const [activityFiles, setActivityFiles] = useState<File[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | DeliveryActivityKind>("all");
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityMenu, setActivityMenu] = useState<{ task: DeliveryItem; activityId: string; x: number; y: number }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activityMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activityMenu) return;
    const dismiss = (event: PointerEvent) => {
      if (!activityMenuRef.current?.contains(event.target as Node)) setActivityMenu(undefined);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivityMenu(undefined);
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, [activityMenu]);
  const load = async () => {
    setLoading(true);
    try { setItems((await migrateLegacyDeliverables(projectId, await api.listProjectManagementModuleItems(projectId, "deliveryPlan", undefined, true))).map(item => value(item))); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [projectId]);
  const taskRows = useMemo(() => buildGanttRows(items, isoToday()), [items]);
  const actionItems = taskRows.filter(row => row.kind === "task" && (row.status === "doing" || plannedDueDate(row) === isoToday() || row.endedOn === isoToday()) && (!row.endedOn || row.endedOn === isoToday()) && row.item.content.dashboardHidden !== true).sort((left, right) => {
    const leftEnded = left.endedOn === isoToday() ? 1 : 0;
    const rightEnded = right.endedOn === isoToday() ? 1 : 0;
    if (leftEnded !== rightEnded) return leftEnded - rightEnded;
    return (plannedDueDate(left) || "9999-12-31").localeCompare(plannedDueDate(right) || "9999-12-31");
  });
  const allActivities = actionItems.flatMap(task => task.activities.map(activity => ({ ...activity, task }))).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const todayActivities = allActivities.filter(activity => activity.createdAt.slice(0, 10) === isoToday() || activity.completedAt?.slice(0, 10) === isoToday() || (activity.kind === "todo" && !activity.done) || (activity.kind === "risk" && (!activity.done || activity.completedAt?.slice(0, 10) === isoToday())));
  const activityFeed = (showAllActivities ? allActivities : todayActivities).filter(activity => activityFilter === "all" || activity.kind === activityFilter);
  const todos = allActivities.filter(activity => (activity.kind === "todo" || activity.kind === "deliverable") && (!activity.done || isToday(activity.completedAt)));
  const pendingTodos = todos.filter(activity => !activity.done);
  const risks = allActivities.filter(activity => activity.kind === "risk" && (!activity.done || activity.completedAt?.slice(0, 10) === isoToday()));
  const pendingRisks = risks.filter(activity => !activity.done);
  const completedToday = allActivities.filter(activity => activity.kind === "todo" && activity.done && activity.createdAt.slice(0, 10) === isoToday()).length;
  const itemsById = new Map(items.map(item => [item.id, item]));
  const pathFor = (task: DeliveryItem) => { const path: string[] = []; let parent = task.parentId ? itemsById.get(task.parentId) : undefined; while (parent) { path.unshift(parent.title); parent = parent.parentId ? itemsById.get(parent.parentId) : undefined; } return path.join(" / "); };
  const addActivity = async (task: DeliveryItem) => {
    const text = activityText.trim(); if (!text && activityFiles.length === 0) return;
    setSavingActivity(true);
    try {
      const attachments = await api.uploadAttachments(task.id, activityFiles);
      const activity: DeliveryActivity = { id: crypto.randomUUID(), kind: activityKind, text: text || "图片附件", createdAt: new Date().toISOString(), author: task.owner || "我", dueDate: activityKind === "todo" ? task.dueDate : undefined, previousStatus: activityKind === "end" ? task.status : undefined, previousDueDate: activityKind === "end" ? task.dueDate : undefined, attachments };
      const updated = await api.updateProjectManagementModuleItem(projectId, task.id, { content: { ...task.item.content, status: activityKind === "end" ? "done" : task.status, dueDate: activityKind === "end" ? isoToday() : task.item.content.dueDate, activities: [...task.activities, activity] } });
      if (activity.kind === "deliverable") {
        const taskCode = taskRows.find(row => row.id === task.id)?.wbsCode || String((task.sortOrder ?? 0) + 1);
        const deliverableNumber = task.activities.filter(candidate => candidate.kind === "deliverable").length + 1;
        const folderPath = deliverableFolderPath(taskCode, task.title, deliverableNumber, activity.text, deliverablesRoot);
        await api.createDeliverableFolder(projectId, folderPath);
        await api.createProjectManagementModuleItem(projectId, "deliverables", { title: activity.text, content: linkedDeliverableContent(task.id, activity, folderPath) });
      }
      setItems(current => current.map(item => item.id === task.id ? value(updated) : item));
      setActivityText(""); setActivityFiles([]);
    } finally { setSavingActivity(false); }
  };
  const updateTodo = async (task: DeliveryItem, activityId: string) => {
    const activity = task.activities.find(candidate => candidate.id === activityId);
    const activities = task.activities.map(activity => activity.id === activityId ? { ...activity, done: !activity.done, completedAt: activity.done ? undefined : new Date().toISOString() } : activity);
    const updated = await api.updateProjectManagementModuleItem(projectId, task.id, { content: { ...task.item.content, activities } });
    if (activity) await syncLinkedDeliverableStatus(projectId, task.id, activity, !activity.done);
    setItems(current => current.map(item => item.id === task.id ? value(updated) : item));
  };
  const updateActivityText = async (task: DeliveryItem, activityId: string, text: string) => {
    const nextText = text.trim();
    const activity = task.activities.find(candidate => candidate.id === activityId);
    if (!activity || !nextText || nextText === activity.text) return;
    const activities = task.activities.map(candidate => candidate.id === activityId ? { ...candidate, text: nextText } : candidate);
    const updated = await api.updateProjectManagementModuleItem(projectId, task.id, { content: { ...task.item.content, activities } });
    setItems(current => current.map(item => item.id === task.id ? value(updated) : item));
  };
  const addActivityAttachments = async (task: DeliveryItem, activityId: string, files: File[]) => {
    const attachments = await api.uploadAttachments(task.id, files);
    if (!attachments.length) return;
    const activities = task.activities.map(activity => activity.id === activityId ? { ...activity, attachments: [...(activity.attachments || []), ...attachments] } : activity);
    const updated = await api.updateProjectManagementModuleItem(projectId, task.id, { content: { ...task.item.content, activities } });
    setItems(current => current.map(item => item.id === task.id ? value(updated) : item));
  };
  const deleteActivity = async (task: DeliveryItem, activityId: string) => {
    const deletedActivity = task.activities.find(activity => activity.id === activityId);
    if (deletedActivity?.kind === "deliverable") {
      const linkedActivityKey = `${task.id}:${activityId}`;
      const deliverables = await api.listProjectManagementModuleItems(projectId, "deliverables", undefined, true);
      const linkedDeliverables = deliverables.filter(deliverable => deliverable.content.linkedActivityKey === linkedActivityKey);
      await Promise.all(linkedDeliverables.map(deliverable => typeof deliverable.content.folderPath === "string" && deliverable.content.folderPath ? api.archiveDeliverableFolder(projectId, deliverable.content.folderPath) : undefined));
      await Promise.all(linkedDeliverables.map(deliverable => api.deleteProjectManagementModuleItem(projectId, deliverable.id)));
    }
    const activities = task.activities.filter(activity => activity.id !== activityId);
    const restoreTask = deletedActivity?.kind === "end" && !activities.some(activity => activity.kind === "end");
    const updated = await api.updateProjectManagementModuleItem(projectId, task.id, { content: { ...task.item.content, status: restoreTask ? deletedActivity.previousStatus || "doing" : task.status, dueDate: restoreTask ? deletedActivity.previousDueDate ?? "" : task.item.content.dueDate, activities } });
    setItems(current => current.map(item => item.id === task.id ? value(updated) : item));
    setActivityMenu(undefined);
  };
  const openActivityMenu = (event: MouseEvent<HTMLElement>, task: DeliveryItem, activityId: string) => {
    event.preventDefault();
    setActivityMenu({ task, activityId, x: event.clientX, y: event.clientY });
  };
  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => setActivityFiles(current => [...current, ...Array.from(event.target.files || [])]);
  const appendEmoji = () => setActivityText(current => `${current}${current ? " " : ""}🙂`);
  if (loading) return <section className="delivery delivery--dashboard"><div className="delivery__loading">正在加载项目交付数据…</div></section>;
  if (!items.length) return <section className="delivery delivery--dashboard"><DashboardHeader/><Empty onOpenPlan={onOpenPlan}/></section>;
  return <section className="delivery delivery--dashboard">
    <div className="delivery-dashboard-top">
      <DashboardHeader/>
      <div className="delivery-dashboard-kpis"><DashboardKpi icon="▣" tone="blue" label="待跟进" value={actionItems.length}/><DashboardKpi icon="▤" tone="amber" label="待办" value={pendingTodos.length}/><DashboardKpi icon="⚠" tone="red" label="风险" value={pendingRisks.length}/><DashboardKpi icon="✓" tone="teal" label="已完成" value={completedToday}/></div>
    </div>
    <div className="delivery-dashboard-grid">
      <main className="delivery-dashboard-main">
        <section className="delivery-dashboard-tasks"><h2>今日需要处理</h2>{actionItems.length ? actionItems.map((task, index) => <DashboardTask key={task.id} task={task} index={index} expanded={expandedTaskId === task.id} path={pathFor(task)} activityKind={activityKind} activityText={activityText} activityFiles={activityFiles} saving={savingActivity} onToggle={() => setExpandedTaskId(current => current === task.id ? undefined : task.id)} onKindChange={setActivityKind} onTextChange={setActivityText} onAdd={() => void addActivity(task)} onToggleTodo={activityId => void updateTodo(task, activityId)} onSaveActivityText={(activityId, text) => updateActivityText(task, activityId, text)} onAddAttachments={(activityId, files) => addActivityAttachments(task, activityId, files)} onActivityMenu={(event, activityId) => openActivityMenu(event, task, activityId)} onSelectFiles={selectFiles} onPasteFiles={files => setActivityFiles(current => [...current, ...files])} onRemoveFile={fileIndex => setActivityFiles(files => files.filter((_, index) => index !== fileIndex))} onOpenFilePicker={() => fileInputRef.current?.click()} onEmoji={appendEmoji} fileInputRef={fileInputRef}/>) : <DashboardEmpty text="当前没有进行中的任务。"/>}</section>
      </main>
      <aside className="delivery-dashboard-side">
        <section className="delivery-dashboard-panel delivery-dashboard-feed"><header><h2>今日动态</h2><button type="button" onClick={() => setShowAllActivities(current => !current)}>{showAllActivities ? "只看今天" : "查看全部动态"} ›</button></header><nav>{(["all", "record", "todo", "deliverable", "risk", "reminder", "end"] as const).map(kind => <button key={kind} className={activityFilter === kind ? "is-active" : ""} type="button" onClick={() => setActivityFilter(kind)}>{kind === "all" ? "全部" : activityLabel(kind)}</button>)}</nav><div className="delivery-dashboard-feed__list">{activityFeed.length ? activityFeed.slice(0, showAllActivities ? undefined : 5).map(activity => <ActivityFeedRow key={`${activity.task.id}-${activity.id}`} activity={activity} onSaveText={text => updateActivityText(activity.task, activity.id, text)} onAddAttachments={files => addActivityAttachments(activity.task, activity.id, files)} onContextMenu={event => openActivityMenu(event, activity.task, activity.id)}/>) : <DashboardEmpty text={showAllActivities ? "暂无项目动态。" : "今天还没有新的动态。"}/>}</div></section>
        <DashboardSummary title="待办清单" count={pendingTodos.length} onOpen={() => { setActivityFilter("all"); setShowAllActivities(true); }} empty="暂无待办" items={todos.map(activity => <div key={activity.id} className={`delivery-dashboard-summary__todo ${activity.kind === "deliverable" ? "is-deliverable" : ""} ${activity.done ? "is-done" : ""}`}>
          <button type="button" className="delivery-dashboard-summary__todo-toggle" aria-label={activity.done ? "取消完成" : "完成待办"} onClick={() => void updateTodo(activity.task, activity.id)}>{activity.done ? "✓" : ""}</button>
          <span><b className={activity.kind === "deliverable" ? "is-deliverable" : "is-event"}>{activity.kind === "deliverable" ? "交付物：" : "事件："}</b>{activity.text}</span>
          {activity.kind === "deliverable" && <div className="delivery-dashboard-summary__todo-actions"><button type="button" className="delivery-dashboard-summary__todo-open" aria-label="打开交付物" title="打开交付物" onClick={() => requestDeliverableFocus(activity.task.id, activity.id)}>↗</button></div>}
        </div>)}/>
        <DashboardSummary title="风险提醒" count={pendingRisks.length} onOpen={() => { setActivityFilter("risk"); setShowAllActivities(true); }} empty="暂无风险" items={risks.slice(0, 1).map(activity => <button type="button" className={`delivery-dashboard-summary__risk ${activity.done ? "is-done" : ""}`} onClick={() => void updateTodo(activity.task, activity.id)}><i>{activity.done ? "✓" : ""}</i><span><b>风险：</b>{activity.text}<small>问题{actionItems.findIndex(task => task.id === activity.task.id) + 1}</small></span><time>{activity.done ? "已关闭" : `发生于 ${timeText(activity.createdAt)}`}</time></button>)}/>
      </aside>
    </div>{activityMenu && <div ref={activityMenuRef} className="delivery-dashboard-activity-menu" style={{ left: activityMenu.x, top: activityMenu.y }}><button type="button" onClick={() => void deleteActivity(activityMenu.task, activityMenu.activityId)}>删除</button></div>}
  </section>;
}

function DashboardHeader() {
  const now = new Date();
  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][now.getDay()];
  return <header className="delivery-dashboard-header"><time>{now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}<strong>{weekday}</strong></time></header>;
}
function DashboardKpi({ icon, tone, label, value }: { icon: string; tone: string; label: string; value: number }) { return <article className={`delivery-dashboard-kpi is-${tone}`}><i>{icon}</i><span>{label}<b>{value}</b></span></article>; }
function DashboardEmpty({ text }: { text: string }) { return <p className="delivery-dashboard-empty">{text}</p>; }
function timeText(value: string) {
  const date = new Date(value);
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  if (date.toLocaleDateString("en-CA") === isoToday()) return time;
  return `${date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })} ${time}`;
}
function isToday(value?: string) { return Boolean(value) && new Date(value!).toLocaleDateString("en-CA") === isoToday(); }
function DashboardTask({ task, index, expanded, path, activityKind, activityText, activityFiles, saving, onToggle, onKindChange, onTextChange, onAdd, onToggleTodo, onSaveActivityText, onAddAttachments, onActivityMenu, onSelectFiles, onPasteFiles, onRemoveFile, onOpenFilePicker, onEmoji, fileInputRef }: { task: DeliveryItem; index: number; expanded: boolean; path: string; activityKind: DeliveryActivityKind; activityText: string; activityFiles: File[]; saving: boolean; onToggle: () => void; onKindChange: (kind: DeliveryActivityKind) => void; onTextChange: (value: string) => void; onAdd: () => void; onToggleTodo: (activityId: string) => void; onSaveActivityText: (activityId: string, text: string) => Promise<void>; onAddAttachments: (activityId: string, files: File[]) => Promise<void>; onActivityMenu: (event: MouseEvent<HTMLElement>, activityId: string) => void; onSelectFiles: (event: ChangeEvent<HTMLInputElement>) => void; onPasteFiles: (files: File[]) => void; onRemoveFile: (index: number) => void; onOpenFilePicker: () => void; onEmoji: () => void; fileInputRef: React.RefObject<HTMLInputElement> }) {
  const taskRisks = task.activities.filter(activity => activity.kind === "risk" && !activity.done).length;
  const todayRecordCount = task.activities.filter(activity => activity.kind === "record" && activity.createdAt.slice(0, 10) === isoToday()).length;
  const pendingTodos = task.activities.filter(activity => activity.kind === "todo" && !activity.done).length;
  const pendingDeliverables = task.activities.filter(activity => activity.kind === "deliverable" && !activity.done).length;
  const deadline = task.endedOn ? "已结束" : plannedDueDate(task);
  return <article className={`delivery-dashboard-task is-${task.status} ${expanded ? "is-expanded" : ""}`}><button type="button" className="delivery-dashboard-task__head" onClick={onToggle}><b>{index + 1}</b><span><strong>{task.title}</strong><small>{path || "未归属分组"}</small></span><div className="delivery-dashboard-task__badges">{todayRecordCount > 0 && <i className="is-record">今日记录 {todayRecordCount}</i>}{pendingTodos > 0 && <i className="is-todo">待办 {pendingTodos}</i>}{pendingDeliverables > 0 && <i className="is-deliverable">交付物 {pendingDeliverables}</i>}{taskRisks > 0 && <i className="is-risk">风险 {taskRisks}</i>}</div><time className={expanded || task.endedOn ? undefined : deadlineUrgencyClass(deadline)}>{task.endedOn ? "已结束" : expanded ? <>截止日期 <em>{dateText(deadline)}</em></> : deadlineText(deadline)}</time></button>{expanded && <div className="delivery-dashboard-task__body"><div className="delivery-dashboard-timeline">{task.activities.length ? task.activities.slice().sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map(activity => <ActivityCard key={activity.id} activity={activity} task={task} onSaveText={text => onSaveActivityText(activity.id, text)} onAddAttachments={files => onAddAttachments(activity.id, files)} onToggleTodo={onToggleTodo} onContextMenu={event => onActivityMenu(event, activity.id)}/>) : <DashboardEmpty text="尚无动态，添加第一条记录。"/>}</div><div className="delivery-dashboard-composer"><select value={activityKind} onChange={event => onKindChange(event.target.value as DeliveryActivityKind)}>{(["record", "todo", "deliverable", "risk", "reminder", "end"] as const).map(kind => <option key={kind} value={kind}>{activityLabel(kind)}</option>)}</select><div><input value={activityText} onChange={event => onTextChange(event.target.value)} onPaste={event => { const pastedFiles = pastedImageFiles(event); if (pastedFiles.length) { event.preventDefault(); onPasteFiles(pastedFiles); } }} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onAdd(); }} placeholder="添加记录、待办、交付物、风险、催办或结束说明…"/><button type="button" onClick={onOpenFilePicker} title="添加附件">⌕</button><button type="button" onClick={onEmoji} title="添加表情">☺</button><input ref={fileInputRef} className="delivery-dashboard-file-input" type="file" multiple onChange={onSelectFiles}/></div><button type="button" disabled={(!activityText.trim() && activityFiles.length === 0) || saving} onClick={onAdd}>{saving ? "发布中…" : "发布"}</button>{activityFiles.length > 0 && <aside>{activityFiles.map((file, fileIndex) => <span key={`${file.name}-${fileIndex}`}>{file.name}<button type="button" onClick={() => onRemoveFile(fileIndex)}>×</button></span>)}</aside>}</div></div>}</article>;
}
function EditableActivityText({ text, onSave, onAddAttachments }: { text: string; onSave: (text: string) => Promise<void>; onAddAttachments: (files: File[]) => Promise<void> }) {
  const [draft, setDraft] = useState(text); const [editing, setEditing] = useState(false); const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing) setDraft(text); }, [text, editing]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  const save = () => { setEditing(false); void onSave(draft); };
  return editing ? <input ref={inputRef} className="delivery-dashboard-activity__edit" value={draft} onChange={event => setDraft(event.target.value)} onPaste={event => { const pastedFiles = pastedImageFiles(event); if (pastedFiles.length) { event.preventDefault(); void onAddAttachments(pastedFiles); } }} onBlur={save} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(text); setEditing(false); } }}/> : <strong title="双击编辑" onDoubleClick={() => setEditing(true)}>{text}</strong>;
}
function ActivityAttachments({ attachments }: { attachments: DeliveryAttachment[] }) {
  return <aside className="delivery-dashboard-activity__attachments">{attachments.map(file => isImageAttachment(file)
    ? <button key={file.src} type="button" className="delivery-dashboard-activity__attachment is-image" aria-label={`放大查看 ${file.name}`} onClick={() => window.dispatchEvent(new CustomEvent("ke-lightbox-open", { detail: { src: file.src, alt: file.name } }))}><img src={file.src} alt={file.name}/></button>
    : <a key={file.src} className="delivery-dashboard-activity__attachment" href={file.src} target="_blank" rel="noreferrer">⌕ {file.name}</a>)}</aside>;
}
function ActivityCard({ activity, task, onSaveText, onAddAttachments, onToggleTodo, onContextMenu, compact }: { activity: DeliveryActivity; task: DeliveryItem; onSaveText: (text: string) => Promise<void>; onAddAttachments: (files: File[]) => Promise<void>; onToggleTodo: (activityId: string) => void; onContextMenu: (event: MouseEvent<HTMLElement>) => void; compact?: boolean }) {
  const actionable = activity.kind === "todo" || activity.kind === "deliverable" || activity.kind === "risk";
  return <article className={`delivery-dashboard-activity is-${activity.kind} ${activity.done ? "is-done" : ""}`} onContextMenu={onContextMenu}><time>{timeText(activity.createdAt)}</time><i/><div><header><b>{activity.kind === "risk" && activity.done ? "已关闭" : actionable && activity.done ? "已完成" : activityLabel(activity.kind)}</b><EditableActivityText text={activity.text} onSave={onSaveText} onAddAttachments={onAddAttachments}/>{activity.kind === "deliverable" && <button type="button" className="delivery-dashboard-open-deliverable" aria-label="打开交付物工作台" title="打开交付物工作台" onClick={() => requestDeliverableFocus(task.id, activity.id)}>↗</button>}{actionable ? <button type="button" className="delivery-dashboard-check" aria-label={activity.kind === "risk" ? activity.done ? "重新打开风险" : "关闭风险" : activity.done ? "取消完成" : "完成待办"} onClick={() => onToggleTodo(activity.id)}>{activity.done ? "✓" : ""}</button> : !compact && <button type="button" aria-label="更多操作">•••</button>}</header>{activity.attachments?.length ? <ActivityAttachments attachments={activity.attachments}/> : null}</div></article>;
}
function ActivityFeedRow({ activity, onSaveText, onAddAttachments, onContextMenu }: { activity: DeliveryActivity & { task: DeliveryItem }; onSaveText: (text: string) => Promise<void>; onAddAttachments: (files: File[]) => Promise<void>; onContextMenu: (event: MouseEvent<HTMLElement>) => void }) { const actionable = activity.kind === "todo" || activity.kind === "deliverable" || activity.kind === "risk"; return <article className={`delivery-dashboard-feed-row is-${activity.kind} ${activity.done ? "is-done" : ""}`} onContextMenu={onContextMenu}><time>{timeText(activity.done && activity.completedAt ? activity.completedAt : activity.createdAt)}</time><i/><div><b>{activity.kind === "risk" && activity.done ? "已关闭" : actionable && activity.done ? "已完成" : activityLabel(activity.kind)}</b><EditableActivityText text={activity.text} onSave={onSaveText} onAddAttachments={onAddAttachments}/>{activity.attachments?.length ? <ActivityAttachments attachments={activity.attachments}/> : null}<small>{activity.task.title} · {activity.author || activity.task.owner || "我"}</small></div><em>{timeText(activity.done && activity.completedAt ? activity.completedAt : activity.createdAt)}</em></article>; }
function DashboardSummary({ title, count, onOpen, empty, items }: { title: string; count: number; onOpen: () => void; empty: string; items: ReactNode[] }) { return <section className="delivery-dashboard-panel delivery-dashboard-summary"><header><h2>{title}</h2><button type="button" onClick={onOpen}>查看全部</button></header>{items.length ? <div>{items}</div> : <DashboardEmpty text={empty}/>}</section>; }

export function DeliveryPlanWorkspace({ projectId, projectName, deliverablesRoot }: { projectId: string; projectName?: string; deliverablesRoot?: string }): ReactNode {
  const viewStorageKey = `rich:delivery-plan:${projectId}:view`;
  const ganttExpansionStorageKey = `rich:delivery-plan:${projectId}:gantt-expansion`;
  const holidayStorageKey = `rich:delivery-plan:${projectId}:holidays`;
  const [items, setItems] = useState<DeliveryItem[]>([]); const [view, setView] = useState<PlanView>(() => readPlanView(viewStorageKey)); const [holidays, setHolidays] = useState<string[]>(() => initializeHolidayDates(holidayStorageKey)); const [calendarMode, setCalendarMode] = useState<GanttCalendarMode>("working"); const [holidayCalendarOpen, setHolidayCalendarOpen] = useState(false); const [showDependencies, setShowDependencies] = useState(false); const [loading, setLoading] = useState(true); const [createKind, setCreateKind] = useState<DeliveryItemKind>();
  const load = async () => { setLoading(true); try { setItems((await migrateLegacyDeliverables(projectId, await api.listProjectManagementModuleItems(projectId, "deliveryPlan", undefined, true))).map(item => value(item))); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [projectId]);
  useEffect(() => { try { window.localStorage.setItem(viewStorageKey, view); } catch {} }, [view, viewStorageKey]);
  useEffect(() => { setHolidays(initializeHolidayDates(holidayStorageKey)); }, [holidayStorageKey]);
  useEffect(() => { try { window.localStorage.setItem(holidayStorageKey, JSON.stringify(holidays)); } catch {} }, [holidays, holidayStorageKey]);
  useEffect(() => { try { window.localStorage.setItem(`${ganttExpansionStorageKey}:calendar-mode`, calendarMode); } catch {} }, [calendarMode, ganttExpansionStorageKey]);
  const rows = useMemo(() => buildGanttRows(items.map(item => value(item.item, holidays)), isoToday()), [items, holidays]);
  const add = async (kind: DeliveryItemKind, draft: { title: string; parentId?: string; startDate: string; actualStartDate: string; dueDate: string; baselineDueDate: string; periodDays: number }) => {
    const created = await api.createProjectManagementModuleItem(projectId, "deliveryPlan", {
      title: draft.title, parentId: kind === "phase" ? undefined : draft.parentId, sortOrder: items.length,
      content: { recordType: "delivery-item", kind, status: "todo", startDate: draft.startDate, actualStartDate: draft.actualStartDate, dueDate: draft.dueDate, baselineDueDate: draft.baselineDueDate, periodDays: draft.periodDays, actualPersonDays: 0 },
    });
    setItems(current => [...current, value(created)]);
  };
  const addChildTask = async (parent: DeliveryItem) => {
    const schedule = childTaskScheduleDefaults(parent.startDate, isoToday(), holidays);
    const created = await api.createProjectManagementModuleItem(projectId, "deliveryPlan", {
      title: "新下级任务", parentId: parent.id, sortOrder: items.length,
      content: { recordType: "delivery-item", kind: "task", status: "todo", ...schedule },
    });
    setItems(current => [...current, value(created)]);
  };
  const patch = async (row: DeliveryItem, patchValue: Partial<DeliveryItemLike>) => { const schedule = syncDeliverySchedule(row, patchValue, holidays); const content = { ...row.item.content, ...patchValue, ...schedule }; const updated = await api.updateProjectManagementModuleItem(projectId, row.id, { title: patchValue.title ?? row.title, content }); setItems(current => current.map(item => item.id === row.id ? value(updated) : item)); };
  const addActivity = async (task: DeliveryItem, kind: DeliveryActivityKind, text: string, files: File[]) => {
    const nextText = text.trim();
    if (!nextText && files.length === 0) return;
    const attachments = await api.uploadAttachments(task.id, files);
    const activity: DeliveryActivity = { id: crypto.randomUUID(), kind, text: nextText || "图片附件", createdAt: new Date().toISOString(), author: task.owner || "我", dueDate: kind === "todo" ? task.dueDate : undefined, previousStatus: kind === "end" ? task.status : undefined, previousDueDate: kind === "end" ? task.dueDate : undefined, attachments };
    const updated = await api.updateProjectManagementModuleItem(projectId, task.id, { content: { ...task.item.content, status: kind === "end" ? "done" : task.status, dueDate: kind === "end" ? isoToday() : task.item.content.dueDate, activities: [...task.activities, activity] } });
    if (kind === "deliverable") {
      const taskCode = rows.find(row => row.id === task.id)?.wbsCode || String((task.sortOrder ?? 0) + 1);
      const deliverableNumber = task.activities.filter(candidate => candidate.kind === "deliverable").length + 1;
      const folderPath = deliverableFolderPath(taskCode, task.title, deliverableNumber, activity.text, deliverablesRoot);
      await api.createDeliverableFolder(projectId, folderPath);
      await api.createProjectManagementModuleItem(projectId, "deliverables", { title: activity.text, content: linkedDeliverableContent(task.id, activity, folderPath) });
    }
    setItems(current => current.map(item => item.id === task.id ? value(updated) : item));
  };
  const toggleActivity = async (task: DeliveryItem, activityId: string) => {
    const activity = task.activities.find(candidate => candidate.id === activityId);
    const activities = task.activities.map(activity => activity.id === activityId ? { ...activity, done: !activity.done, completedAt: activity.done ? undefined : new Date().toISOString() } : activity);
    const updated = await api.updateProjectManagementModuleItem(projectId, task.id, { content: { ...task.item.content, activities } });
    if (activity) await syncLinkedDeliverableStatus(projectId, task.id, activity, !activity.done);
    setItems(current => current.map(item => item.id === task.id ? value(updated) : item));
  };
  const updateActivityText = async (task: DeliveryItem, activityId: string, text: string) => {
    const nextText = text.trim();
    const activity = task.activities.find(candidate => candidate.id === activityId);
    if (!activity || !nextText || nextText === activity.text) return;
    const activities = task.activities.map(candidate => candidate.id === activityId ? { ...candidate, text: nextText } : candidate);
    const updated = await api.updateProjectManagementModuleItem(projectId, task.id, { content: { ...task.item.content, activities } });
    setItems(current => current.map(item => item.id === task.id ? value(updated) : item));
  };
  const addActivityAttachments = async (task: DeliveryItem, activityId: string, files: File[]) => {
    const attachments = await api.uploadAttachments(task.id, files);
    if (!attachments.length) return;
    const activities = task.activities.map(activity => activity.id === activityId ? { ...activity, attachments: [...(activity.attachments || []), ...attachments] } : activity);
    const updated = await api.updateProjectManagementModuleItem(projectId, task.id, { content: { ...task.item.content, activities } });
    setItems(current => current.map(item => item.id === task.id ? value(updated) : item));
  };
  const deleteActivity = async (task: DeliveryItem, activityId: string) => {
    const deletedActivity = task.activities.find(activity => activity.id === activityId);
    if (deletedActivity?.kind === "deliverable") {
      const linkedActivityKey = `${task.id}:${activityId}`;
      const deliverables = await api.listProjectManagementModuleItems(projectId, "deliverables", undefined, true);
      const linkedDeliverables = deliverables.filter(deliverable => deliverable.content.linkedActivityKey === linkedActivityKey);
      await Promise.all(linkedDeliverables.map(deliverable => typeof deliverable.content.folderPath === "string" && deliverable.content.folderPath ? api.archiveDeliverableFolder(projectId, deliverable.content.folderPath) : undefined));
      await Promise.all(linkedDeliverables.map(deliverable => api.deleteProjectManagementModuleItem(projectId, deliverable.id)));
    }
    const activities = task.activities.filter(activity => activity.id !== activityId);
    const restoreTask = deletedActivity?.kind === "end" && !activities.some(activity => activity.kind === "end");
    const updated = await api.updateProjectManagementModuleItem(projectId, task.id, { content: { ...task.item.content, status: restoreTask ? deletedActivity.previousStatus || "doing" : task.status, dueDate: restoreTask ? deletedActivity.previousDueDate ?? "" : task.item.content.dueDate, activities } });
    setItems(current => current.map(item => item.id === task.id ? value(updated) : item));
  };
  const patchParent = async (row: DeliveryItem, parentId?: string) => {
    const updated = await api.updateProjectManagementModuleItem(projectId, row.id, { parentId: parentId || null });
    setItems(current => current.map(item => item.id === row.id ? value(updated) : item));
  };
  const remove = async (row: DeliveryItem) => {
    const removedIds = new Set<string>();
    const collect = (parentId: string) => {
      removedIds.add(parentId);
      items.filter(item => item.parentId === parentId).forEach(item => collect(item.id));
    };
    collect(row.id);
    const orderedIds = [...removedIds].sort((left, right) => {
      const depth = (id: string) => { let value = 0; let current = items.find(item => item.id === id); while (current?.parentId) { value += 1; current = items.find(item => item.id === current!.parentId); } return value; };
      return depth(right) - depth(left);
    });
    for (const itemId of orderedIds) await api.deleteProjectManagementModuleItem(projectId, itemId);
    setItems(current => current.filter(item => !removedIds.has(item.id)));
  };
  const reorder = async (itemIds: string[]) => {
    await api.reorderProjectManagementModuleItems(projectId, "deliveryPlan", itemIds);
    const positions = new Map(itemIds.map((id, index) => [id, index]));
    setItems(current => current.map(item => {
      const sortOrder = positions.get(item.id) ?? item.sortOrder ?? 0;
      return sortOrder === item.sortOrder ? item : { ...item, sortOrder, item: { ...item.item, sortOrder } };
    }));
  };
  const moveTask = async (dragged: DeliveryItem, target: DeliveryItem, placement: GanttDropPlacement) => {
    if (dragged.id === target.id || dragged.kind === "risk" || target.kind === "risk") return;
    const movingPhase = dragged.kind === "phase";
    if (movingPhase ? target.kind !== "phase" || placement === "child" : placement !== "child" && target.kind === "phase") return;
    const descendants = new Set<string>();
    const collectDescendants = (parentId: string) => items.filter(item => item.parentId === parentId).forEach(item => { descendants.add(item.id); collectDescendants(item.id); });
    collectDescendants(dragged.id);
    if (descendants.has(target.id)) return;
    const parentId = movingPhase ? undefined : placement === "child" ? target.id : target.parentId;
    const moved = items.map(item => item.id === dragged.id ? { ...item, parentId, item: { ...item.item, parentId } } : item);
    const siblings = moved.filter(item => item.id !== dragged.id && item.parentId === parentId && (!movingPhase || item.kind === "phase")).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
    const targetIndex = siblings.findIndex(item => item.id === target.id);
    const insertionIndex = placement === "child" ? siblings.length : Math.max(0, targetIndex + (placement === "after" ? 1 : 0));
    siblings.splice(insertionIndex, 0, moved.find(item => item.id === dragged.id)!);
    const siblingIds = new Set(siblings.map(item => item.id));
    const orderTree = (currentParentId?: string): string[] => {
      const currentChildren = moved.filter(item => item.parentId === currentParentId && !siblingIds.has(item.id)).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
      const children = currentParentId !== parentId ? currentChildren : movingPhase
        ? currentChildren.map(item => item.kind === "phase" ? siblings.shift()! : item)
        : siblings;
      return children.flatMap(item => [item.id, ...orderTree(item.id)]);
    };
    const itemIds = orderTree();
    const known = new Set(itemIds);
    moved.forEach(item => { if (!known.has(item.id)) itemIds.push(item.id); });
    const updated = await api.updateProjectManagementModuleItem(projectId, dragged.id, { parentId: parentId || null });
    await api.reorderProjectManagementModuleItems(projectId, "deliveryPlan", itemIds);
    const positions = new Map(itemIds.map((id, index) => [id, index]));
    setItems(current => current.map(item => {
      const next = item.id === dragged.id ? value(updated) : item;
      const sortOrder = positions.get(next.id) ?? next.sortOrder ?? 0;
      return sortOrder === next.sortOrder ? next : { ...next, sortOrder, item: { ...next.item, sortOrder } };
    }));
  };
  const PlanTable = PlanTableWithColumns;
  const exportSnapshot = async () => {
    await (window as Window & { richWindow?: { exportDeliveryPlan?: (payload: unknown) => Promise<boolean> } }).richWindow?.exportDeliveryPlan?.({
      gantt: buildNativeGanttExport(rows, isoToday(), calendarMode, holidays),
      tableRows: buildDeliveryExportRows(rows),
      filename: buildDeliveryExportFilename(projectName),
    });
  };
  return <section className="delivery delivery--plan">
    <header className="delivery__header"><div><h1>交付计划</h1><p>用阶段、分组、任务与里程碑维护 WBS，并在甘特图中跟踪进度。</p></div><div className="delivery__toolbar"><span>临期 <b>{rows.filter(row => !row.isAtRisk && row.status !== "done" && row.dueDate && row.dueDate <= addDays(3)).length}</b></span><span>高风险 <b>{rows.filter(row => row.isAtRisk || row.status === "blocked").length}</b></span>{view === "gantt" && <><button type="button" onClick={() => void exportSnapshot()}>导出 Excel</button><div className="delivery-gantt-calendar-actions delivery__toolbar-calendar-actions" aria-label="甘特图日历设置"><div className="delivery-switch"><button type="button" className={calendarMode === "calendar" ? "is-active" : ""} onClick={() => setCalendarMode("calendar")}>自然日</button><button type="button" className={calendarMode === "working" ? "is-active" : ""} onClick={() => setCalendarMode("working")}>工作日</button></div><button type="button" onClick={() => setHolidayCalendarOpen(true)}>假期</button><button type="button" className={`delivery-gantt-detail-toggle${showDependencies ? " is-active" : ""}`} onClick={() => setShowDependencies(current => !current)}>详情</button></div></>}<div className="delivery-switch"><button className={view === "gantt" ? "is-active" : ""} onClick={() => setView("gantt")}>甘特图</button><button className={view === "table" ? "is-active" : ""} onClick={() => setView("table")}>Excel 列表</button></div></div></header>
    {loading ? <div className="delivery__loading">正在加载交付计划…</div> : view === "gantt" ? <Gantt rows={rows} holidays={holidays} calendarMode={calendarMode} showDependencies={showDependencies} onPatch={patch} onAddChildTask={addChildTask} onDelete={remove} onMoveTask={moveTask} onAddActivity={addActivity} onToggleActivity={toggleActivity} onUpdateActivityText={updateActivityText} onAddAttachments={addActivityAttachments} onDeleteActivity={deleteActivity} storageKey={ganttExpansionStorageKey} /> : <PlanTable rows={rows} phases={rows.filter(row => row.kind === "phase")} onPatch={patch} onPatchParent={patchParent} onAdd={async () => setCreateKind("task")} onDelete={remove} onReorder={reorder} storageKey={`rich:delivery-plan:${projectId}:columns`} />}
    {createKind && (
      <CreateDeliveryItemDrawer kind={createKind} rows={rows} onClose={() => setCreateKind(undefined)} onCreate={async draft => { await add(createKind, draft); setCreateKind(undefined); }}/>
    )}
    {holidayCalendarOpen && <HolidayCalendar holidays={holidays} onChange={setHolidays} onClose={() => setHolidayCalendarOpen(false)} />}
  </section>;
}

function CreateDeliveryItemDrawer({ kind, rows, onClose, onCreate }: { kind: DeliveryItemKind; rows: DeliveryGanttRow[]; onClose: () => void; onCreate: (draft: { title: string; parentId?: string; startDate: string; actualStartDate: string; dueDate: string; baselineDueDate: string; periodDays: number }) => Promise<void> }) {
  const taskSchedule = childTaskScheduleDefaults(undefined, isoToday());
  const [title, setTitle] = useState(defaultTitle(kind));
  const [parentId, setParentId] = useState("");
  const [startDate, setStartDate] = useState(kind === "task" ? taskSchedule.startDate || "" : isoToday());
  const [actualStartDate, setActualStartDate] = useState("");
  const [dueDate, setDueDate] = useState(kind === "task" ? "" : kind === "milestone" ? isoToday() : addDays(7));
  const [baselineDueDate, setBaselineDueDate] = useState(kind === "task" ? taskSchedule.baselineDueDate || "" : "");
  const [saving, setSaving] = useState(false);
  const parents = rows.filter(row => row.kind === "phase" || row.kind === "group" || row.kind === "task");
  const save = async () => { if (!title.trim()) return; setSaving(true); try { await onCreate({ title: title.trim(), parentId: parentId || undefined, startDate, actualStartDate, dueDate, baselineDueDate, periodDays: kind === "task" ? 2 : 0 }); } finally { setSaving(false); } };
  return <div className="delivery-task-drawer" role="dialog" aria-modal="true" aria-label={`新增${kindLabel(kind)}`}>
    <div className="delivery-task-drawer__backdrop" role="presentation" onClick={onClose}/>
    <aside className="delivery-task-drawer__panel"><header><div><small>新增{kindLabel(kind)}</small><h2>{defaultTitle(kind)}</h2></div><button type="button" aria-label="关闭" onClick={onClose}>×</button></header><div className="delivery-task-drawer__form"><label className="delivery-task-drawer__wide"><span>名称</span><input autoFocus value={title} onChange={event => setTitle(event.target.value)}/></label>{kind !== "phase" && <label className="delivery-task-drawer__wide"><span>所属</span><select value={parentId} onChange={event => setParentId(event.target.value)}><option value="">顶层</option>{parents.map(parent => <option key={parent.id} value={parent.id}>{parent.wbsCode ? `${parent.wbsCode} ` : ""}{parent.title}</option>)}</select></label>}{kind === "task" ? <div className="delivery-task-drawer__date-pairs delivery-task-drawer__wide"><label><span>计划开始时间</span><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)}/></label><label><span>计划结束时间</span><input type="date" value={baselineDueDate} onChange={event => setBaselineDueDate(event.target.value)}/></label><label><span>实际开始时间</span><input type="date" value={actualStartDate} onChange={event => setActualStartDate(event.target.value)}/></label><label><span>实际结束时间</span><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}/></label></div> : <><label><span>开始</span><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)}/></label><label><span>截止</span><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}/></label></>}</div><footer><button type="button" onClick={onClose}>取消</button><button type="button" className="is-primary" disabled={!title.trim() || saving} onClick={() => void save()}>{saving ? "保存中…" : `新增${kindLabel(kind)}`}</button></footer></aside>
  </div>;
}

export function ProjectPlanWorkspace({ projectId, deliverablesRoot }: { projectId: string; deliverablesRoot?: string }): ReactNode {
  const [page, setPage] = useState<"dashboard" | "plan" | "requirements" | "risks">("dashboard");
  const pages = [
    ["dashboard", "驾驶舱"], ["plan", "交付计划"], ["requirements", "需求"], ["risks", "风险与问题"],
  ] as const;
  return <div className="project-plan"><nav className="project-plan__nav">{pages.map(([id, label]) => <button key={id} className={page === id ? "is-active" : ""} onClick={() => setPage(id)}>{label}</button>)}</nav>{page === "dashboard" && <ProjectDashboard projectId={projectId} onOpenPlan={() => setPage("plan")} deliverablesRoot={deliverablesRoot} />}{page === "plan" && <DeliveryPlanWorkspace projectId={projectId} deliverablesRoot={deliverablesRoot} />}{page === "requirements" && <DeliveryPlaceholder title="需求与范围" description="持续记录、澄清并追溯项目需求。" />}{page === "risks" && <DeliveryPlaceholder title="风险与问题" description="识别风险、维护应对措施并跟踪已发生的问题。" />}</div>;
}

export function DeliveryPlaceholder({ title, description }: { title: string; description: string }): ReactNode {
  return <section className="delivery"><header className="delivery__header"><div><h1>{title}</h1><p>{description}</p></div></header><div className="delivery-empty"><h2>{title}正在准备中</h2><p>当前版本先完成项目驾驶舱与交付计划。后续会把持续录入的事项纳入这里，并与计划和交付物建立追溯关系。</p></div></section>;
}

function Kpi({ tone, label, value, sub }: { tone: string; label: string; value: string; sub: string }) { return <article className={`delivery-kpi is-${tone}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></article>; }
function Empty({ onOpenPlan }: { onOpenPlan: () => void }) { return <div className="delivery-empty"><h2>从第一条交付事项开始</h2><p>先录入任务、里程碑或待交付物；驾驶舱会自动生成进度、临期和风险提醒。</p><button type="button" onClick={onOpenPlan}>打开交付计划</button></div>; }
type DeliveryGanttRow = DeliveryItem & { progress: number; isAtRisk: boolean; depth: number; hasChildren: boolean; kind: DeliveryItemKind; wbsCode: string; phaseIndex: number };
function Gantt({ rows, holidays, calendarMode, showDependencies, onPatch, onAddChildTask, onDelete, onMoveTask, onAddActivity, onToggleActivity, onUpdateActivityText, onAddAttachments, onDeleteActivity, storageKey }: { rows: DeliveryGanttRow[]; holidays: string[]; calendarMode: GanttCalendarMode; showDependencies: boolean; onPatch: (row: DeliveryItem, patch: Partial<DeliveryItemLike>) => Promise<void>; onAddChildTask: (row: DeliveryItem) => Promise<void>; onDelete: (row: DeliveryItem) => Promise<void>; onMoveTask: (dragged: DeliveryItem, target: DeliveryItem, placement: GanttDropPlacement) => Promise<void>; onAddActivity: (task: DeliveryItem, kind: DeliveryActivityKind, text: string, files: File[]) => Promise<void>; onToggleActivity: (task: DeliveryItem, activityId: string) => Promise<void>; onUpdateActivityText: (task: DeliveryItem, activityId: string, text: string) => Promise<void>; onAddAttachments: (task: DeliveryItem, activityId: string, files: File[]) => Promise<void>; onDeleteActivity: (task: DeliveryItem, activityId: string) => Promise<void>; storageKey: string }) {
  const fixedRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set(readGanttExpansion(storageKey).collapsedIds));
  const [expandedMilestonePhaseIds, setExpandedMilestonePhaseIds] = useState<Set<string>>(() => new Set(readGanttExpansion(storageKey).milestonePhaseIds));
  const [expandedRiskTaskIds, setExpandedRiskTaskIds] = useState<Set<string>>(() => new Set(readGanttExpansion(storageKey).riskTaskIds));
  const [hoveredRowId, setHoveredRowId] = useState<string>();
  const [detailRowId, setDetailRowId] = useState<string>();
  const [draggedTaskId, setDraggedTaskId] = useState<string>();
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: GanttDropPlacement }>();
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [taskMenu, setTaskMenu] = useState<{ row: DeliveryGanttRow; x: number; y: number }>();
  const taskMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = timeRef.current;
    if (!element) return;
    const updateWidth = () => setTimelineViewportWidth(element.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { try { window.localStorage.setItem(storageKey, JSON.stringify({ collapsedIds: [...collapsedIds], milestonePhaseIds: [...expandedMilestonePhaseIds], riskTaskIds: [...expandedRiskTaskIds] })); } catch {} }, [collapsedIds, expandedMilestonePhaseIds, expandedRiskTaskIds, storageKey]);
  useEffect(() => {
    if (!taskMenu) return;
    const dismiss = (event: PointerEvent) => {
      if (!taskMenuRef.current?.contains(event.target as Node)) setTaskMenu(undefined);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTaskMenu(undefined);
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, [taskMenu]);
  const baselineDue = (row: DeliveryGanttRow) => row.baselineDueDate || row.dueDate || row.startDate || isoToday();
  const { startAt: min, endAt } = buildGanttTimelineRange(rows, isoToday());
  const max = endAt + 86_400_000;
  const timelineDates = ganttTimelineDates(new Date(min).toISOString().slice(0, 10), new Date(max - 86_400_000).toISOString().slice(0, 10), calendarMode, holidays);
  const dates = timelineDates.length ? timelineDates : [new Date(min).toISOString().slice(0, 10)];
  const timelineWidth = timelineZoom === 0 ? undefined : Math.max(timelineViewportWidth * [1, 1.25, 1.75, 2.5][timelineZoom]!, dates.length * [0, 12, 20, 72][timelineZoom]!);
  const timelineCanvasWidth = Math.max(timelineViewportWidth, timelineWidth ?? 0);
  const timelineCanvasStyle = timelineCanvasWidth ? { width: `${timelineCanvasWidth}px`, minWidth: `${timelineCanvasWidth}px` } : { width: "100%", minWidth: "100%" };
  const positionAt = (value?: string) => {
    const date = value || isoToday();
    return Math.max(0, Math.min(100, (dates.filter(candidate => candidate < date).length / dates.length) * 100));
  };
  const todayLeft = positionAt(isoToday());
  const months = [...new Set(dates.map(date => date.slice(0, 7)))].map(month => {
    const first = dates.findIndex(date => date.startsWith(month));
    const count = dates.filter(date => date.startsWith(month)).length;
    return { label: `${Number(month.slice(5))}月`, left: first / dates.length * 100, width: count / dates.length * 100 };
  });
  const dailyTicks = dates.map(date => ({ left: positionAt(date), label: date.slice(5).replace("-", "/") }));
  const dateTicks = dates.filter((date, index) => dates.length <= 31 || index === 0 || new Date(`${date}T00:00:00Z`).getUTCDay() === 1).map(date => ({ left: positionAt(date), label: date.slice(5).replace("-", "/") }));
  const visibleDateCount = timelineCanvasWidth && timelineViewportWidth ? Math.min(dates.length, dates.length * timelineViewportWidth / timelineCanvasWidth) : dates.length;
  const showDailyGrid = timelineZoom === 3 || visibleDateCount >= 120 || visibleDateCount <= 26;
  const showDailyLabels = timelineZoom === 3 || visibleDateCount <= 26;
  const headerTicks = showDailyLabels ? dailyTicks : dateTicks;
  const gridTicks = showDailyGrid ? dailyTicks : dateTicks;
  const rowsById = new Map(rows.map(row => [row.id, row]));
  const phaseIdFor = (row: DeliveryGanttRow) => {
    let current: DeliveryGanttRow | undefined = row;
    while (current) {
      if (current.kind === "phase") return current.id;
      current = current.parentId ? rowsById.get(current.parentId) : undefined;
    }
    return undefined;
  };
  const milestonesByParent = new Map<string, DeliveryGanttRow[]>();
  const risksByTask = new Map<string, DeliveryGanttRow[]>();
  rows.forEach(row => {
    if (row.kind === "milestone" && row.parentId && rowsById.has(row.parentId)) {
      milestonesByParent.set(row.parentId, [...(milestonesByParent.get(row.parentId) ?? []), row]);
    }
    if (row.kind === "risk" && row.parentId && rowsById.get(row.parentId)?.kind === "task") {
      risksByTask.set(row.parentId, [...(risksByTask.get(row.parentId) ?? []), row]);
    }
  });
  const isHidden = (row: DeliveryGanttRow) => {
    let current = row.parentId ? rowsById.get(row.parentId) : undefined;
    while (current) {
      if (collapsedIds.has(current.id)) return true;
      current = current.parentId ? rowsById.get(current.parentId) : undefined;
    }
    return false;
  };
  const visibleRows = rows.flatMap(row => {
    if (row.kind === "milestone" || row.kind === "risk" || isHidden(row)) return [];
    if (collapsedIds.has(row.id)) return [row];
    return [
      row,
      ...(expandedMilestonePhaseIds.has(row.id) ? milestonesByParent.get(row.id) ?? [] : []),
      ...(row.kind === "task" && expandedRiskTaskIds.has(row.id) ? risksByTask.get(row.id) ?? [] : []),
    ];
  });
  const isDescendantOf = (row: DeliveryGanttRow, ancestorId: string) => {
    let current = row.parentId ? rowsById.get(row.parentId) : undefined;
    while (current) {
      if (current.id === ancestorId) return true;
      current = current.parentId ? rowsById.get(current.parentId) : undefined;
    }
    return false;
  };
  const groupLevel = (row: DeliveryGanttRow) => {
    let level = 0;
    let current = row.parentId ? rowsById.get(row.parentId) : undefined;
    while (current) {
      if (current.kind === "group") level += 1;
      current = current.parentId ? rowsById.get(current.parentId) : undefined;
    }
    return level;
  };
  const detailRow = detailRowId ? rowsById.get(detailRowId) : undefined;
  const leftAt = positionAt;
  const endBoundaryAt = (value: string) => leftAt(ganttEndBoundary(value));
  const visibleRowIndexes = new Map(visibleRows.map((row, index) => [row.id, index]));
  const dependencyLinks = visibleRows.flatMap(successor => {
    const successorStart = successor.startDate;
    if (successor.kind !== "task" || !successorStart) return [];
    return (successor.dependencyIds ?? []).flatMap(predecessorId => {
      const predecessor = rowsById.get(predecessorId);
      const predecessorIndex = visibleRowIndexes.get(predecessorId);
      const successorIndex = visibleRowIndexes.get(successor.id);
      if (!predecessor || predecessorIndex === undefined || successorIndex === undefined) return [];
      const predecessorEnd = ganttEndBoundary(baselineDue(predecessor));
      return [{
        id: `${predecessor.id}-${successor.id}`,
        predecessor, successor,
        fromX: leftAt(predecessorEnd) * 10,
        fromY: predecessorIndex * 38 + 19,
        toX: leftAt(successorStart) * 10,
        toY: successorIndex * 38 + 19,
        isConflict: successorStart < predecessorEnd,
      }];
    });
  });
  const widthOf = (row: DeliveryGanttRow, minimum = .3) => Math.max(endBoundaryAt(baselineDue(row)) - leftAt(row.startDate || baselineDue(row)), minimum);
  const scheduledProgressAtToday = (row: DeliveryGanttRow) => {
    const startAt = leftAt(row.startDate || baselineDue(row));
    const plannedEndAt = endBoundaryAt(baselineDue(row));
    return Math.max(0, Math.min(100, ((todayLeft - startAt) / Math.max(plannedEndAt - startAt, 1)) * 100));
  };
  const barStyle = (row: DeliveryGanttRow) => ({
    left: `${leftAt(row.startDate || baselineDue(row))}%`, width: `${widthOf(row)}%`,
    ...(row.kind !== "risk" && row.status === "doing" ? (() => {
      const todayProgress = scheduledProgressAtToday(row);
      const completedProgress = Math.min(row.progress, todayProgress);
      return { background: `linear-gradient(90deg, #059669 0 ${completedProgress}%, rgba(248,113,113,.52) ${completedProgress}% ${todayProgress}%, #475569 ${todayProgress}% 100%)` };
    })() : {}),
  });
  const delayEndFor = (row: DeliveryGanttRow) => {
    if (row.dueDate && Date.parse(row.dueDate) > Date.parse(baselineDue(row))) return row.dueDate;
    return !row.dueDate && Date.parse(baselineDue(row)) < Date.parse(isoToday()) ? isoToday() : undefined;
  };
  const actualStartGap = (row: DeliveryGanttRow) => {
    if (row.kind !== "task" || !row.startDate) return undefined;
    const actualStartDate = actualStartDateFor(row, isoToday());
    if (!actualStartDate || actualStartDate <= row.startDate) return undefined;
    const end = actualStartDate;
    const width = leftAt(end) - leftAt(row.startDate);
    return width > 0 ? { left: `${leftAt(row.startDate)}%`, width: `${width}%` } : undefined;
  };
  const actualEndGap = (row: DeliveryGanttRow) => {
    if (row.kind !== "task" || row.status !== "done" || !row.dueDate || row.dueDate >= baselineDue(row)) return undefined;
    const left = endBoundaryAt(row.dueDate);
    const width = endBoundaryAt(baselineDue(row)) - left;
    return width > 0 ? { left: `${left}%`, width: `${width}%` } : undefined;
  };
  const phaseFor = (row: DeliveryGanttRow) => { const phaseId = phaseIdFor(row); return phaseId ? rowsById.get(phaseId) : undefined; };
  const phaseWindow = (row: DeliveryGanttRow) => { const phase = phaseFor(row); return phase ? { left: `${leftAt(phase.startDate || baselineDue(phase))}%`, width: `${widthOf(phase)}%` } : undefined; };
  const groupFrames = visibleRows.flatMap(group => {
    if (group.kind !== "group") return [];
    const descendants = visibleRows.map((row, rowIndex) => ({ row, rowIndex })).filter(({ row }) => isDescendantOf(row, group.id));
    const groupRowIndex = visibleRows.findIndex(row => row.id === group.id);
    const framedRows = descendants.length ? descendants : [{ row: group, rowIndex: groupRowIndex }];
    const startDate = group.startDate || group.baselineDueDate || group.dueDate;
    const dueDate = group.baselineDueDate || group.dueDate || group.startDate;
    if (groupRowIndex < 0 || !startDate || !dueDate) return [];
    const firstChild = framedRows[0].rowIndex;
    const lastChild = framedRows.at(-1)!.rowIndex;
    return [{ id: group.id, level: groupLevel(group), label: `${group.wbsCode} ${group.title} · ${dateText(startDate)} – ${dateText(dueDate)}`, style: { left: `${leftAt(startDate)}%`, width: `${Math.max(endBoundaryAt(dueDate) - leftAt(startDate), 1)}%`, top: `${58 + firstChild * 38 + 2}px`, height: `${(lastChild - firstChild + 1) * 38 - 4}px` } }];
  });
  const toggle = (set: Dispatch<SetStateAction<Set<string>>>, id: string) => set(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const handleFixedWheel = (event: WheelEvent<HTMLDivElement>) => {
    const timeline = timeRef.current;
    if (!timeline) return;
    event.preventDefault();
    timeline.scrollTop += event.deltaY;
    timeline.scrollLeft += event.deltaX;
    if (fixedRef.current) fixedRef.current.scrollTop = timeline.scrollTop;
  };
  const placementFor = (event: DragEvent<HTMLDivElement>): GanttDropPlacement => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = (event.clientY - rect.top) / rect.height;
    return offset < .25 ? "before" : offset > .75 ? "after" : "child";
  };
  const setDrop = (event: DragEvent<HTMLDivElement>, row: DeliveryGanttRow) => {
    if (!draggedTaskId) return;
    const dragged = rowsById.get(draggedTaskId);
    if (!dragged || dragged.id === row.id || dragged.kind === "risk" || row.kind === "risk") return;
    const placement = placementFor(event);
    if (dragged.kind === "phase") {
      if (row.kind !== "phase") return;
      event.preventDefault();
      setDropTarget({ id: row.id, placement: placement === "child" ? "after" : placement });
      return;
    }
    if (placement !== "child" && row.kind === "phase") return;
    event.preventDefault();
    setDropTarget({ id: row.id, placement });
  };
  const drop = async (event: DragEvent<HTMLDivElement>, row: DeliveryGanttRow) => {
    event.preventDefault();
    const dragged = draggedTaskId ? rowsById.get(draggedTaskId) : undefined;
    const placement = dropTarget?.id === row.id ? dropTarget.placement : placementFor(event);
    setDraggedTaskId(undefined); setDropTarget(undefined);
    if (dragged) await onMoveTask(dragged, row, placement);
  };
  const openTaskMenu = (event: MouseEvent<HTMLDivElement>, row: DeliveryGanttRow) => {
    if (row.kind !== "phase" && row.kind !== "group" && row.kind !== "task") return;
    event.preventDefault();
    setTaskMenu({ row, x: event.clientX, y: event.clientY });
  };
  return <>
  <div className="delivery-gantt-split">
    <div className="delivery-gantt-split__fixed">
      <div className="delivery-gantt-split__fixed-head"><span>WBS / 任务名称</span><span>负责人</span><span>进度</span></div>
      <div ref={fixedRef} className="delivery-gantt-split__fixed-body" onWheel={handleFixedWheel}>
        {visibleRows.map(row => <div key={row.id} draggable={row.kind !== "risk"} className={`delivery-gantt-split__fixed-row is-${row.kind} is-phase-tone-${row.phaseIndex % 4}${row.kind === "group" ? ` is-group-level-${groupLevel(row) % 4}` : ""}${hoveredRowId === row.id ? " is-hovered" : ""}${draggedTaskId === row.id ? " is-dragging" : ""}${dropTarget?.id === row.id ? ` is-drop-${dropTarget.placement}` : ""}`} onDragStart={event => { if (row.kind === "risk") return; event.dataTransfer.effectAllowed = "move"; setDraggedTaskId(row.id); }} onDragEnd={() => { setDraggedTaskId(undefined); setDropTarget(undefined); }} onDragOver={event => setDrop(event, row)} onDrop={event => void drop(event, row)} onMouseEnter={() => setHoveredRowId(row.id)} onMouseLeave={() => setHoveredRowId(undefined)} onContextMenu={event => openTaskMenu(event, row)} onDoubleClick={() => { if (row.kind !== "risk") setDetailRowId(row.id); }}>
          <span style={{ paddingLeft: `${14 + row.depth * 20}px` }}>
            {row.kind === "risk" ? <b className="delivery-gantt-split__risk-mark">⚠</b> : row.kind === "milestone" ? <b className="delivery-gantt-split__milestone-mark">⚑</b> : row.hasChildren ? <button type="button" className="delivery-gantt-split__toggle" onClick={() => toggle(setCollapsedIds, row.id)}>{collapsedIds.has(row.id) ? "▸" : "▾"}</button> : row.kind === "group" ? <b className="delivery-gantt-split__group-mark">□</b> : <b>•</b>}
            <em className="delivery-gantt-split__wbs">{row.wbsCode}</em><span className="delivery-gantt-split__title">{row.title}</span>
            {(milestonesByParent.get(row.id) ?? []).length > 0 && <button type="button" className="delivery-gantt-split__milestone-toggle" title="展开里程碑" onClick={() => toggle(setExpandedMilestonePhaseIds, row.id)}>{expandedMilestonePhaseIds.has(row.id) ? "⚑" : "⚐"}</button>}
            {row.kind === "task" && (risksByTask.get(row.id) ?? []).length > 0 && <button type="button" className="delivery-gantt-split__risk-toggle" title="展开风险项" onClick={() => toggle(setExpandedRiskTaskIds, row.id)}>{expandedRiskTaskIds.has(row.id) ? "▲" : "⚠"}</button>}
          </span><span>{row.owner || "—"}</span><span className={`delivery-gantt-split__progress is-${row.status}`}>{row.kind === "milestone" ? "节点" : row.kind === "risk" ? "风险" : row.kind === "group" ? "分组" : row.status === "done" ? "完成" : `${row.progress}%`}</span>
        </div>)}
      </div>
    </div>
    <div ref={timeRef} className="delivery-gantt-split__time" onScroll={event => { if (fixedRef.current) fixedRef.current.scrollTop = event.currentTarget.scrollTop; }}>
      <div className="delivery-gantt-split__time-canvas" style={timelineCanvasStyle}>
        <div className="delivery-gantt-split__time-head">{months.map(month => <b key={month.left} style={{ left: `${month.left}%`, width: `${month.width}%` }}>{month.label}</b>)}{headerTicks.map(tick => <span key={tick.left} className="delivery-gantt-split__week-label" style={{ left: `${tick.left}%` }}>{tick.label}</span>)}<em className="delivery-gantt-split__today-label" style={{ left: `${todayLeft}%` }}>今天</em></div>
        {visibleRows.map(row => <div key={row.id} className={`delivery-gantt-split__time-row is-${row.kind} is-phase-tone-${row.phaseIndex % 4}${hoveredRowId === row.id ? " is-hovered" : ""}${draggedTaskId === row.id ? " is-dragging" : ""}${dropTarget?.id === row.id ? ` is-drop-${dropTarget.placement}` : ""}`} onDragOver={event => setDrop(event, row)} onDrop={event => void drop(event, row)} onMouseEnter={() => setHoveredRowId(row.id)} onMouseLeave={() => setHoveredRowId(undefined)} onContextMenu={event => openTaskMenu(event, row)} onDoubleClick={() => { if (row.kind !== "risk") setDetailRowId(row.id); }}>
          {(row.kind === "task" || row.kind === "group" || row.kind === "phase") && phaseWindow(row) && <span className={`delivery-gantt-split__phase-window is-phase-${(phaseFor(row)?.phaseIndex ?? 0) % 4}`} style={phaseWindow(row)}/>} 
          {gridTicks.map(tick => <span key={tick.left} className="delivery-gantt-split__week-line" style={{ left: `${tick.left}%` }}/>)}<span className="delivery-gantt-split__today-line" style={{ left: `${todayLeft}%` }}/>
          {(milestonesByParent.get(row.id) ?? []).map(milestone => <i key={milestone.id} className="delivery-gantt-split__milestone" style={{ left: `${leftAt(ganttEndBoundary(baselineDue(milestone)))}%` }} title={`${milestone.title} · ${dateText(baselineDue(milestone))}`}>⚑</i>)}
          {row.kind === "milestone" ? <i className="delivery-gantt-split__milestone" style={{ left: `${leftAt(ganttEndBoundary(baselineDue(row)))}%` }}>⚑</i> : row.kind === "group" || row.kind === "phase" ? null : <>{<i className={`${row.kind === "risk" ? "is-risk" : `is-${row.status}`}${delayEndFor(row) ? " has-delay" : ""}${row.kind === "task" && row.startDate === isoToday() ? " has-today-start" : ""}`} style={barStyle(row)} title={`${dateText(row.startDate)} – ${dateText(baselineDue(row))}`}>{row.kind === "risk" ? "风险" : null}</i>}{row.kind === "task" && row.startDate === isoToday() && <i className={`delivery-gantt-split__today-start is-${row.status}`} style={{ left: `${leftAt(row.startDate)}%` }} title="今天开始"/>}{(() => { const gap = actualStartGap(row); return gap && <i className="delivery-gantt-split__actual-start-gap" style={gap} title={row.status === "todo" ? `等待开始至 ${dateText(isoToday())}` : `实际开始 ${dateText(actualStartDateFor(row, isoToday()))}`}/>; })()}{(() => { const gap = actualEndGap(row); return gap && <i className="delivery-gantt-split__actual-end-gap" style={gap} title={`提前结束，原计划至 ${dateText(baselineDue(row))}`}/>; })()}{(() => { const delayEnd = delayEndFor(row); return delayEnd && <i className="delivery-gantt-split__delay" style={{ left: `${leftAt(ganttEndBoundary(baselineDue(row)))}%`, width: `${Math.max(endBoundaryAt(delayEnd) - endBoundaryAt(baselineDue(row)), .8)}%` }} title={`延期至 ${dateText(delayEnd)}`}/>; })()}</>}
        </div>)}
        {groupFrames.map(frame => <span key={frame.id} className={`delivery-gantt-split__group-frame is-level-${frame.level % 4}`} style={frame.style}><b>{frame.label}</b></span>)}
        {showDependencies && dependencyLinks.length > 0 && <svg className="delivery-gantt-split__dependencies" viewBox={`0 0 1000 ${visibleRows.length * 38}`} height={visibleRows.length * 38} preserveAspectRatio="none" aria-label="任务依赖">
          <defs><marker id="dependency-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z"/></marker><marker id="dependency-arrow-conflict" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path className="is-conflict" d="M 0 0 L 8 4 L 0 8 z"/></marker></defs>
          {dependencyLinks.map(link => {
            const bendX = link.toX >= link.fromX ? (link.fromX + link.toX) / 2 : link.fromX + 18;
            return <path key={link.id} className={link.isConflict ? "is-conflict" : ""} d={`M ${link.fromX} ${link.fromY} H ${bendX} V ${link.toY} H ${link.toX}`} markerEnd={`url(#dependency-arrow${link.isConflict ? "-conflict" : ""})`}><title>{`${link.predecessor.title} → ${link.successor.title}`}</title></path>;
          })}
        </svg>}
      </div>
    </div>
    {taskMenu && <div ref={taskMenuRef} className="delivery-gantt-split__task-menu" style={{ left: taskMenu.x, top: taskMenu.y }}>
      <button type="button" onClick={() => { void onAddChildTask(taskMenu.row); setTaskMenu(undefined); }}>+ 增加下级任务</button>
      {taskMenu.row.kind === "task" && <button type="button" className="is-danger" onClick={() => { if (window.confirm(`删除“${taskMenu.row.title}”及其全部下级任务吗？`)) void onDelete(taskMenu.row); setTaskMenu(undefined); }}>删除</button>}
    </div>}
    {detailRow && <TaskDetailDrawer row={detailRow} rows={rows} holidays={holidays} onClose={() => setDetailRowId(undefined)} onPatch={onPatch} onAddActivity={onAddActivity} onToggleActivity={onToggleActivity} onUpdateActivityText={onUpdateActivityText} onAddAttachments={onAddAttachments} onDeleteActivity={onDeleteActivity} />}
  </div>
  <div className="delivery-gantt-split__zoom" aria-label="甘特图日期密度">
    <button type="button" aria-label="缩小时间轴" title="缩小时间轴" disabled={timelineZoom === 0} onClick={() => setTimelineZoom(current => Math.max(0, current - 1))}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
    <button type="button" aria-label="放大时间轴" title="放大时间轴" disabled={timelineZoom === 3} onClick={() => setTimelineZoom(current => Math.min(3, current + 1))}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg></button>
  </div>
  </>;
}

function HolidayCalendar({ holidays, onChange, onClose }: { holidays: string[]; onChange: Dispatch<SetStateAction<string[]>>; onClose: () => void }) {
  const [month, setMonth] = useState(() => isoToday().slice(0, 7));
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setUTCDate(gridStart.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
    setMonth(next.toISOString().slice(0, 7));
  };
  const toggle = (date: string) => onChange(current => current.includes(date) ? current.filter(value => value !== date) : [...current, date].sort());
  return <div className="delivery-holiday-dialog" role="dialog" aria-modal="true" aria-label="假期日历">
    <div className="delivery-holiday-dialog__backdrop" role="presentation" onClick={onClose}/>
    <section className="delivery-holiday-dialog__panel"><header><div><small>工作日计算</small><h2>假期日历</h2></div><button type="button" aria-label="关闭" onClick={onClose}>×</button></header><p>点击日期标记或取消假期；工作日模式会隐藏周末和这些日期。</p><nav><button type="button" aria-label="上个月" onClick={() => moveMonth(-1)}>‹</button><strong>{year} 年 {monthIndex} 月</strong><button type="button" aria-label="下个月" onClick={() => moveMonth(1)}>›</button></nav><div className="delivery-holiday-dialog__weekdays">{["一", "二", "三", "四", "五", "六", "日"].map(day => <span key={day}>{day}</span>)}</div><div className="delivery-holiday-dialog__days">{days.map(date => <button key={date} type="button" className={`${date.slice(0, 7) === month ? "" : "is-outside "}${holidays.includes(date) ? "is-holiday" : ""}`} onClick={() => toggle(date)}><span>{Number(date.slice(8))}</span>{holidays.includes(date) && <i>假</i>}</button>)}</div><footer><span>已配置 {holidays.length} 天假期</span><button type="button" className="is-primary" onClick={onClose}>完成</button></footer></section>
  </div>;
}

function TaskDetailDrawer({ row, rows, holidays, onClose, onPatch, onAddActivity, onToggleActivity, onUpdateActivityText, onAddAttachments, onDeleteActivity }: { row: DeliveryGanttRow; rows: DeliveryGanttRow[]; holidays: string[]; onClose: () => void; onPatch: (row: DeliveryItem, patch: Partial<DeliveryItemLike>) => Promise<void>; onAddActivity: (task: DeliveryItem, kind: DeliveryActivityKind, text: string, files: File[]) => Promise<void>; onToggleActivity: (task: DeliveryItem, activityId: string) => Promise<void>; onUpdateActivityText: (task: DeliveryItem, activityId: string, text: string) => Promise<void>; onAddAttachments: (task: DeliveryItem, activityId: string, files: File[]) => Promise<void>; onDeleteActivity: (task: DeliveryItem, activityId: string) => Promise<void> }) {
  const [draft, setDraft] = useState<Partial<DeliveryItemLike>>({});
  const [saving, setSaving] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(true);
  useEffect(() => { setDraft({ title: row.title, kind: row.kind, owner: row.owner || "", status: row.status, progressOffsetDays: row.progressOffsetDays || 0, startDate: row.startDate || "", actualStartDate: row.actualStartDate || "", dueDate: row.dueDate || "", baselineDueDate: row.baselineDueDate || "", periodDays: row.periodDays ?? 0, actualPersonDays: row.actualPersonDays ?? 0, dependencyIds: row.dependencyIds || [] }); }, [row]);
  const tasks = rows.filter(candidate => candidate.kind === "task" && candidate.id !== row.id);
  const update = <K extends keyof DeliveryItemLike>(key: K, next: DeliveryItemLike[K]) => setDraft(current => ({ ...current, [key]: next }));
  const updateSchedule = (patch: Pick<Partial<DeliveryItemLike>, "startDate" | "baselineDueDate" | "periodDays">) => setDraft(current => ({ ...current, ...syncDeliverySchedule({ ...row, ...current }, patch, holidays) }));
  const save = async () => {
    setSaving(true);
    try { await onPatch(row, draft); onClose(); }
    finally { setSaving(false); }
  };
  return <div className="delivery-task-drawer" role="dialog" aria-modal="true" aria-label="任务详情">
    <div className="delivery-task-drawer__backdrop" role="presentation" onClick={onClose}/>
    <aside className="delivery-task-drawer__panel">
      <header><div><small>{row.wbsCode || kindLabel(row.kind)} · {kindLabel(row.kind)}详情</small><h2>{row.title}</h2></div><button type="button" aria-label="关闭" onClick={onClose}>×</button></header>
      <section className="delivery-task-drawer__info">
        <button type="button" className="delivery-task-drawer__info-toggle" aria-expanded={infoExpanded} onClick={() => setInfoExpanded(current => !current)}><span>任务信息</span><i>{infoExpanded ? "收起" : "展开"} {infoExpanded ? "⌃" : "⌄"}</i></button>
        {infoExpanded && <><div className="delivery-task-drawer__form">
        <div className="delivery-task-drawer__name-row delivery-task-drawer__wide">{row.kind !== "risk" && <label><span>类型</span><select value={draft.kind || "task"} onChange={event => update("kind", event.target.value as DeliveryItemKind)}>{(["phase", "group", "task", "milestone"] as const).map(kind => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}</select></label>}<label><span>任务名称</span><input value={String(draft.title ?? "")} onChange={event => update("title", event.target.value)}/></label></div>
        <label><span>状态</span><select value={draft.status || "todo"} onChange={event => update("status", event.target.value as DeliveryItemStatus)}>{(["todo", "doing", "blocked", "done"] as const).map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
        <label><span>负责人</span><input value={String(draft.owner ?? "")} onChange={event => update("owner", event.target.value)}/></label>
        <div className="delivery-task-drawer__date-pairs delivery-task-drawer__wide">
          <label><span>计划开始时间</span><input type="date" value={String(draft.startDate ?? "")} onChange={event => updateSchedule({ startDate: event.target.value })}/></label>
          <label><span>计划结束时间</span><input type="date" value={String(draft.baselineDueDate ?? "")} onChange={event => updateSchedule({ baselineDueDate: event.target.value })}/></label>
          <label><span>实际开始时间</span><input type="date" value={String(draft.actualStartDate ?? "")} onChange={event => update("actualStartDate", event.target.value)}/></label>
          <label><span>实际结束时间</span><input type="date" value={String(draft.dueDate ?? "")} onChange={event => update("dueDate", event.target.value)}/></label>
        </div>
        <div className="delivery-task-drawer__metrics-row delivery-task-drawer__wide"><label><span>进度偏移（天）</span><input type="number" step="1" value={Number(draft.progressOffsetDays ?? 0)} onChange={event => update("progressOffsetDays", Number(event.target.value) || 0)}/></label><label><span>周期（工作日）</span><input type="number" min="1" step="1" value={Math.max(1, Number(draft.periodDays ?? 1))} onChange={event => updateSchedule({ periodDays: Math.max(1, Number(event.target.value) || 1) })}/></label><label><span>实际人天</span><input type="number" min="0" step="0.5" value={Number(draft.actualPersonDays ?? 0)} onChange={event => update("actualPersonDays", Math.max(0, Number(event.target.value) || 0))}/></label></div>
        {row.kind === "task" && <label className="delivery-task-drawer__wide"><span>前置依赖</span><select value={draft.dependencyIds?.[0] || ""} onChange={event => update("dependencyIds", event.target.value ? [event.target.value] : [])}><option value="">无</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.wbsCode} {task.title}</option>)}</select></label>}
        </div><footer className="delivery-task-drawer__info-actions"><button type="button" onClick={onClose}>取消</button><button type="button" className="is-primary" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "保存任务信息"}</button></footer></>}
      </section>
      {row.kind === "task" && <TaskActivityPanel task={row} onAddActivity={onAddActivity} onToggleActivity={onToggleActivity} onUpdateActivityText={onUpdateActivityText} onAddAttachments={onAddAttachments} onDeleteActivity={onDeleteActivity}/>}
    </aside>
  </div>;
}

function TaskActivityPanel({ task, onAddActivity, onToggleActivity, onUpdateActivityText, onAddAttachments, onDeleteActivity }: { task: DeliveryItem; onAddActivity: (task: DeliveryItem, kind: DeliveryActivityKind, text: string, files: File[]) => Promise<void>; onToggleActivity: (task: DeliveryItem, activityId: string) => Promise<void>; onUpdateActivityText: (task: DeliveryItem, activityId: string, text: string) => Promise<void>; onAddAttachments: (task: DeliveryItem, activityId: string, files: File[]) => Promise<void>; onDeleteActivity: (task: DeliveryItem, activityId: string) => Promise<void> }) {
  const [kind, setKind] = useState<DeliveryActivityKind>("record");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [activityMenu, setActivityMenu] = useState<{ activityId: string; x: number; y: number }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activityMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setText(""); setFiles([]); }, [task.id]);
  useEffect(() => {
    if (!activityMenu) return;
    const dismiss = (event: PointerEvent) => { if (!activityMenuRef.current?.contains(event.target as Node)) setActivityMenu(undefined); };
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setActivityMenu(undefined); };
    window.addEventListener("pointerdown", dismiss); window.addEventListener("keydown", dismissOnEscape);
    return () => { window.removeEventListener("pointerdown", dismiss); window.removeEventListener("keydown", dismissOnEscape); };
  }, [activityMenu]);
  const publish = async () => {
    if (!text.trim() && files.length === 0) return;
    setSaving(true);
    try { await onAddActivity(task, kind, text, files); setText(""); setFiles([]); }
    finally { setSaving(false); }
  };
  return <section className="delivery-task-drawer__activities">
    <header><div><h3>任务动态</h3><p>记录、待办和交付物与驾驶舱保持同步。</p></div></header>
    <div className="delivery-dashboard-timeline">{task.activities.length ? task.activities.slice().sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map(activity => <ActivityCard key={activity.id} activity={activity} task={task} onSaveText={text => onUpdateActivityText(task, activity.id, text)} onAddAttachments={files => onAddAttachments(task, activity.id, files)} onToggleTodo={activityId => void onToggleActivity(task, activityId)} onContextMenu={event => { event.preventDefault(); setActivityMenu({ activityId: activity.id, x: event.clientX, y: event.clientY }); }} compact={true}/>) : <DashboardEmpty text="尚无动态，添加第一条记录。"/>}</div>
    <div className="delivery-dashboard-composer"><select value={kind} onChange={event => setKind(event.target.value as DeliveryActivityKind)}>{(["record", "todo", "deliverable", "risk", "reminder", "end"] as const).map(activityKind => <option key={activityKind} value={activityKind}>{activityLabel(activityKind)}</option>)}</select><div><input value={text} onChange={event => setText(event.target.value)} onPaste={event => { const pastedFiles = pastedImageFiles(event); if (pastedFiles.length) { event.preventDefault(); setFiles(current => [...current, ...pastedFiles]); } }} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void publish(); }} placeholder="添加记录、待办、交付物、风险、催办或结束说明…"/><button type="button" onClick={() => fileInputRef.current?.click()} title="添加附件">⌕</button><button type="button" onClick={() => setText(current => `${current}${current ? " " : ""}🙂`)} title="添加表情">☺</button><input ref={fileInputRef} className="delivery-dashboard-file-input" type="file" multiple onChange={event => setFiles(current => [...current, ...Array.from(event.target.files || [])])}/></div><button type="button" disabled={(!text.trim() && files.length === 0) || saving} onClick={() => void publish()}>{saving ? "发布中…" : "发布"}</button>{files.length > 0 && <aside>{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></span>)}</aside>}</div>
    {activityMenu && <div ref={activityMenuRef} className="delivery-dashboard-activity-menu" style={{ left: activityMenu.x, top: activityMenu.y }}><button type="button" onClick={() => { void onDeleteActivity(task, activityMenu.activityId); setActivityMenu(undefined); }}>删除</button></div>}
  </section>;
}

function GanttLegacySplit({ rows, onPatch }: { rows: DeliveryGanttRow[]; onPatch: (row: DeliveryItem, patch: Partial<DeliveryItemLike>) => Promise<void> }) {
  const fixedRef = useRef<HTMLDivElement>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [expandedMilestonePhaseIds, setExpandedMilestonePhaseIds] = useState<Set<string>>(() => new Set());
  const [expandedRiskTaskIds, setExpandedRiskTaskIds] = useState<Set<string>>(() => new Set());
  const start = new Date(Math.min(...rows.map(row => Date.parse(row.startDate || row.dueDate || isoToday()))));
  const min = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
  const end = new Date(Math.max(...rows.map(row => Date.parse(row.dueDate || row.startDate || isoToday())), Date.now()));
  const max = Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1) - 1;
  const range = Math.max(max - min, 86_400_000);
  const todayLeft = Math.max(0, Math.min(100, ((Date.now() - min) / range) * 100));
  const months = [] as Array<{ label: string; left: number; width: number }>;
  for (let cursor = min; cursor <= max;) { const next = Date.UTC(new Date(cursor).getUTCFullYear(), new Date(cursor).getUTCMonth() + 1, 1); months.push({ label: `${new Date(cursor).getUTCMonth() + 1}月`, left: ((cursor - min) / range) * 100, width: ((Math.min(next, max + 1) - cursor) / range) * 100 }); cursor = next; }
  const weeks = Array.from({ length: Math.ceil(range / (7 * 86_400_000)) + 1 }, (_, index) => { const at = min + index * 7 * 86_400_000; return { left: ((at - min) / range) * 100, label: new Date(at).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) }; }).filter(week => week.left <= 100);
  const rowsById = new Map(rows.map(row => [row.id, row]));
  const phaseIdFor = (row: DeliveryGanttRow) => { let current: DeliveryGanttRow | undefined = row; while (current) { if (current.kind === "phase") return current.id; current = current.parentId ? rowsById.get(current.parentId) : undefined; } return undefined; };
  const milestonesByPhase = new Map<string, DeliveryGanttRow[]>();
  rows.filter(row => row.kind === "milestone").forEach(row => { const phaseId = phaseIdFor(row); if (phaseId) milestonesByPhase.set(phaseId, [...(milestonesByPhase.get(phaseId) ?? []), row]); });
  const risksByTask = new Map<string, DeliveryGanttRow[]>();
  rows.filter(row => row.kind === "risk" && row.parentId && rowsById.get(row.parentId)?.kind === "task").forEach(row => {
    const taskId = row.parentId!;
    risksByTask.set(taskId, [...(risksByTask.get(taskId) ?? []), row]);
  });
  const isHidden = (row: DeliveryGanttRow) => { let current = row.parentId ? rowsById.get(row.parentId) : undefined; while (current) { if (collapsedIds.has(current.id)) return true; current = current.parentId ? rowsById.get(current.parentId) : undefined; } return false; };
  const visibleRows = rows.flatMap(row => {
    if (row.kind === "milestone" || row.kind === "risk" || isHidden(row)) return [];
    if (row.kind === "phase" && expandedMilestonePhaseIds.has(row.id) && !collapsedIds.has(row.id)) return [row, ...(milestonesByPhase.get(row.id) ?? [])];
    if (row.kind === "task" && expandedRiskTaskIds.has(row.id) && !collapsedIds.has(row.id)) return [row, ...(risksByTask.get(row.id) ?? [])];
    return [row];
  });
  const leftAt = (value?: string) => ((Date.parse(value || isoToday()) - min) / range) * 100;
  const widthOf = (row: DeliveryGanttRow, minimum = 7) => Math.max(((Date.parse(row.dueDate || row.startDate || isoToday()) - Date.parse(row.startDate || row.dueDate || isoToday())) / range) * 100, minimum);
  const phaseFor = (row: DeliveryGanttRow) => { const phaseId = phaseIdFor(row); return phaseId ? rowsById.get(phaseId) : undefined; };
  const phaseWindow = (row: DeliveryGanttRow) => { const phase = phaseFor(row); return phase ? { left: `${leftAt(phase.startDate || phase.dueDate)}%`, width: `${widthOf(phase)}%` } : undefined; };
  const phaseTone = (row: DeliveryGanttRow) => (phaseFor(row)?.phaseIndex ?? 0) % 4;
  return <div className="delivery-gantt-split"><div className="delivery-gantt-split__fixed"><div className="delivery-gantt-split__fixed-head"><span>WBS / 任务名称</span><span>负责人</span><span>进度</span></div><div ref={fixedRef} className="delivery-gantt-split__fixed-body">{visibleRows.map(row => <div key={row.id} className={`delivery-gantt-split__fixed-row is-${row.kind}`}><span style={{ paddingLeft: `${14 + row.depth * 20}px` }}>{row.kind === "risk" ? <b className="delivery-gantt-split__risk-mark">⚠</b> : row.kind === "milestone" ? <b className="delivery-gantt-split__milestone-mark">◇</b> : row.hasChildren ? <button type="button" className="delivery-gantt-split__toggle" onClick={() => setCollapsedIds(current => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })}>{collapsedIds.has(row.id) ? "▸" : "▾"}</button> : <b>•</b>}<em className="delivery-gantt-split__wbs">{row.wbsCode}</em><input value={row.title} onChange={event => void onPatch(row, { title: event.target.value })}/>{row.kind === "phase" && (milestonesByPhase.get(row.id) ?? []).length > 0 && <button type="button" className="delivery-gantt-split__milestone-toggle" title="展开里程碑" onClick={() => setExpandedMilestonePhaseIds(current => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })}>{expandedMilestonePhaseIds.has(row.id) ? "◆" : "◇"}</button>}{row.kind === "task" && (risksByTask.get(row.id) ?? []).length > 0 && <button type="button" className="delivery-gantt-split__risk-toggle" title="展开风险项" onClick={() => setExpandedRiskTaskIds(current => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })}>{expandedRiskTaskIds.has(row.id) ? "▲" : "⚠"}</button>}</span><span>{row.owner || "—"}</span><span>{row.kind === "milestone" ? "节点" : row.kind === "risk" ? "风险" : `${row.progress}%`}</span></div>)}</div></div><div className="delivery-gantt-split__time" onScroll={event => { if (fixedRef.current) fixedRef.current.scrollTop = event.currentTarget.scrollTop; }}><div className="delivery-gantt-split__time-canvas"><div className="delivery-gantt-split__time-head">{months.map(month => <b key={month.left} style={{ left: `${month.left}%`, width: `${month.width}%` }}>{month.label}</b>)}{weeks.map(week => <span key={week.left} className="delivery-gantt-split__week-label" style={{ left: `${week.left}%` }}>{week.label}</span>)}<em className="delivery-gantt-split__today-label" style={{ left: `${todayLeft}%` }}>今天</em></div>{visibleRows.map(row => <div key={row.id} className={`delivery-gantt-split__time-row is-${row.kind}`}>{row.kind === "task" && phaseWindow(row) && <span className={`delivery-gantt-split__phase-window is-phase-${phaseTone(row)}`} style={phaseWindow(row)}/>} {weeks.map(week => <span key={week.left} className="delivery-gantt-split__week-line" style={{ left: `${week.left}%` }}/>) }<span className="delivery-gantt-split__today-line" style={{ left: `${todayLeft}%` }}/>{row.kind === "phase" ? (milestonesByPhase.get(row.id) ?? []).map(milestone => <i key={milestone.id} className="delivery-gantt-split__milestone" style={{ left: `${leftAt(milestone.dueDate || milestone.startDate)}%` }} title={`${milestone.title} · ${dateText(milestone.dueDate || milestone.startDate)}`}>◇</i>) : row.kind === "milestone" ? <i className="delivery-gantt-split__milestone" style={{ left: `${leftAt(row.dueDate || row.startDate)}%` }} title={`${row.title} · ${dateText(row.dueDate || row.startDate)}`}>◇</i> : <i className={row.kind === "risk" ? "is-risk" : `is-${row.status}`} style={{ left: `${leftAt(row.startDate || row.dueDate)}%`, width: `${widthOf(row)}` }}>{row.kind === "risk" ? "风险" : `${dateText(row.startDate)} – ${dateText(row.dueDate)}`}</i>}</div>)}</div></div></div>;
}
function GanttLegacy({ rows, onPatch }: { rows: DeliveryGanttRow[]; onPatch: (row: DeliveryItem, patch: Partial<DeliveryItemLike>) => Promise<void> }) {
  const baseStart = Math.min(...rows.map(row => Date.parse(row.startDate || row.dueDate || isoToday())));
  const firstDate = new Date(Number.isFinite(baseStart) ? baseStart : Date.parse(`${isoToday()}T00:00:00Z`));
  const min = Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), 1);
  const lastDate = new Date(Math.max(...rows.map(row => Date.parse(row.dueDate || row.startDate || isoToday())), Date.now() + 7 * 86_400_000));
  const max = Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() + 1, 1) - 1;
  const range = Math.max(max - min, 7 * 86_400_000);
  const todayLeft = Math.max(0, Math.min(100, ((Date.now() - min) / range) * 100));
  const ticks = Array.from({ length: Math.ceil(range / (7 * 86_400_000)) + 1 }, (_, index) => {
    const at = min + index * 7 * 86_400_000;
    return { left: ((at - min) / range) * 100, label: new Date(at).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) };
  });
  const months = [] as Array<{ left: number; width: number; label: string }>;
  for (let cursor = new Date(Date.UTC(new Date(min).getUTCFullYear(), new Date(min).getUTCMonth(), 1)); cursor.getTime() <= max;) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const start = Math.max(cursor.getTime(), min); const end = Math.min(next.getTime(), max);
    months.push({ left: ((start - min) / range) * 100, width: ((end - start) / range) * 100, label: `${cursor.getUTCMonth() + 1}月` });
    cursor = next;
  }
  let nextTop = 58;
  const geometry = new Map(rows.map(row => {
    const top = nextTop; nextTop += row.kind === "task" ? 56 : 48;
    const left = ((Date.parse(row.startDate || row.dueDate || isoToday()) - min) / range) * 100;
    const right = left + Math.max(((Date.parse(row.dueDate || row.startDate || isoToday()) - Date.parse(row.startDate || row.dueDate || isoToday())) / range) * 100, row.kind === "milestone" ? 0 : 7);
    return [row.id, { top, left, right }];
  }));
  const rowsById = new Map(rows.map(row => [row.id, row]));
  const dependencies = rows.flatMap(row => (row.dependencyIds ?? []).flatMap(sourceId => {
    const sourceRow = rowsById.get(sourceId);
    if (!sourceRow?.startDate || !sourceRow.dueDate || !row.startDate || !row.dueDate) return [];
    const source = geometry.get(sourceId); const target = geometry.get(row.id);
    return source && target ? [{ sourceId, targetId: row.id, source, target }] : [];
  }));
  return <div className="delivery-gantt"><div className="delivery-gantt__canvas"><svg className="delivery-gantt__dependencies" viewBox={`0 0 895 ${nextTop}`} preserveAspectRatio="none"><defs><marker id="delivery-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>{dependencies.map(link => { const fromX = 895 * link.source.right / 100; const toX = 895 * link.target.left / 100; const fromY = link.source.top + 28; const toY = link.target.top + 28; const elbow = Math.max(fromX + 18, toX - 18); return <path key={`${link.sourceId}-${link.targetId}`} d={`M ${fromX} ${fromY} H ${elbow} V ${toY} H ${toX}`} markerEnd="url(#delivery-arrow)" />; })}</svg><div className="delivery-gantt__head"><span>WBS / 任务名称</span><span>负责人</span><span>进度</span><div className="delivery-gantt__time-head">{months.map(month => <b key={month.left} className="delivery-gantt__month" style={{ left: `${month.left}%`, width: `${month.width}%` }}>{month.label}</b>)}{ticks.map((tick, index) => <i key={tick.left} className={index === 0 ? "is-first" : ""} style={{ left: `${tick.left}%` }}>{tick.label}</i>)}<em style={{ left: `${todayLeft}%` }}>今天</em></div></div>{rows.map((row, index) => { const left = ((Date.parse(row.startDate || row.dueDate || isoToday()) - min) / range) * 100; const width = Math.max(((Date.parse(row.dueDate || row.startDate || isoToday()) - Date.parse(row.startDate || row.dueDate || isoToday())) / range) * 100, row.kind === "milestone" ? 0 : 7); const baselineWidth = row.baselineDueDate && row.dueDate && row.baselineDueDate < row.dueDate ? Math.max(((Date.parse(row.baselineDueDate) - Date.parse(row.startDate || row.baselineDueDate)) / range) * 100, 1) : width; return <div className={`delivery-gantt__row is-${row.kind}`} key={row.id}><span className="delivery-gantt__name" style={{ paddingLeft: `${12 + row.depth * 22}px` }}><b className="delivery-gantt__kind">{row.kind === "milestone" ? "◇" : row.kind === "phase" ? "▾" : "•"}</b><em>{index + 1}</em><input value={row.title} onChange={event => void onPatch(row, { title: event.target.value })}/></span><span><input value={row.owner || ""} placeholder="负责人" onChange={event => void onPatch(row, { owner: event.target.value })}/></span><span>{row.kind === "milestone" ? "节点" : `${row.progress}%`}</span><div className="delivery-gantt__timeline"><i className="delivery-gantt__today" style={{ left: `${todayLeft}%` }} aria-label="今天" />{row.kind === "milestone" ? <i className={`delivery-milestone is-${row.isAtRisk || row.status === "blocked" ? "risk" : row.status}`} style={{ left: `${left}%` }} title={`${row.title} · ${dateText(row.dueDate || row.startDate)}`}>◇</i> : <><i className={`is-${row.isAtRisk || row.status === "blocked" ? "risk" : row.status}`} style={{ left: `${left}%`, width: `${baselineWidth}%` }}>{dateText(row.startDate)} – {dateText(row.dueDate)}</i>{baselineWidth < width && <i className="delivery-gantt__delay" style={{ left: `${left + baselineWidth}%`, width: `${width - baselineWidth}%` }} title={`延期至 ${row.dueDate}`}>延期</i>}</>}</div></div>; })}{rows.length === 0 && <div className="delivery-empty">还没有计划事项，点击“+ 阶段”开始。</div>}</div></div>;
}
type PlanColumn = "title" | "hierarchy" | "status" | "progress" | "progressOffset" | "start" | "actualStart" | "due" | "period" | "baseline" | "actualPersonDays" | "dependency" | "owner";
const defaultPlanColumns: PlanColumn[] = ["title", "hierarchy", "status", "progress", "progressOffset", "start", "actualStart", "due", "period", "baseline", "actualPersonDays", "dependency", "owner"];
const planColumnLabels: Record<PlanColumn, string> = { title: "WBS / 事项", hierarchy: "类型 / 所属", status: "状态", progress: "自动进度", progressOffset: "进度偏移", start: "计划开始时间", actualStart: "实际开始时间", due: "实际结束时间", period: "周期（工作日）", baseline: "计划结束时间", actualPersonDays: "实际人天", dependency: "前置依赖", owner: "负责人" };
function readPlanColumns(key: string): PlanColumn[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || "[]");
    if (!Array.isArray(stored)) return defaultPlanColumns;
    const known = stored.filter((column): column is PlanColumn => defaultPlanColumns.includes(column));
    const complete = known.length ? [...known, ...defaultPlanColumns.filter(column => !known.includes(column))] : [...defaultPlanColumns];
    const actualStartIndex = complete.indexOf("actualStart");
    const dueIndex = complete.indexOf("due");
    if (actualStartIndex > dueIndex) {
      complete.splice(actualStartIndex, 1);
      complete.splice(dueIndex, 0, "actualStart");
    }
    return complete;
  } catch { return defaultPlanColumns; }
}

function PlanTableWithColumns({ rows, phases, onPatch, onPatchParent, onAdd, onDelete, onReorder, storageKey }: {
  rows: DeliveryGanttRow[];
  phases: DeliveryGanttRow[];
  onPatch: (row: DeliveryItem, patch: Partial<DeliveryItemLike>) => Promise<void>;
  onPatchParent: (row: DeliveryItem, parentId?: string) => Promise<void>;
  onAdd: () => Promise<void>;
  onDelete: (row: DeliveryItem) => Promise<void>;
  onReorder: (itemIds: string[]) => Promise<void>;
  storageKey: string;
}) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [columns, setColumns] = useState<PlanColumn[]>(() => readPlanColumns(storageKey));
  const [draggedId, setDraggedId] = useState<string>();
  const [draggedColumn, setDraggedColumn] = useState<PlanColumn>();
  const editing = mode === "edit";
  useEffect(() => { try { window.localStorage.setItem(storageKey, JSON.stringify(columns)); } catch {} }, [columns, storageKey]);
  const byId = new Map(rows.map(row => [row.id, row]));
  const move = <T,>(list: T[], source: T, target: T): T[] => {
    const next = [...list]; const sourceIndex = next.indexOf(source); const targetIndex = next.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return next;
    next.splice(sourceIndex, 1); next.splice(targetIndex, 0, source); return next;
  };
  const dropRow = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const ids = rows.map(row => row.id); const nextIds = move(ids, draggedId, targetId);
    setDraggedId(undefined); await onReorder(nextIds);
  };
  const parentChoices = (row: DeliveryGanttRow) => row.kind === "risk" ? rows.filter(candidate => candidate.kind === "task") : rows.filter(candidate => candidate.kind === "phase" || candidate.kind === "group" || candidate.kind === "task" || candidate.kind === "milestone");
  const taskCandidates = (row: DeliveryGanttRow) => rows.filter(candidate => candidate.id !== row.id && candidate.kind === "task").sort((left, right) => {
    const leftParts = left.wbsCode.split(".").map(Number); const rightParts = right.wbsCode.split(".").map(Number);
    for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
      const difference = (leftParts[index] ?? -1) - (rightParts[index] ?? -1);
      if (difference) return difference;
    }
    return left.title.localeCompare(right.title, "zh-CN");
  });
  const cell = (row: DeliveryGanttRow, column: PlanColumn): ReactNode => {
    if (column === "title") return editing ? <input value={row.title} onChange={event => void onPatch(row, { title: event.target.value })}/> : <span className="delivery-table__title"><em>{row.wbsCode}</em>{row.title}</span>;
    if (column === "hierarchy") return editing ? <div className="delivery-table__hierarchy"><select value={row.kind} onChange={event => void onPatch(row, { kind: event.target.value as DeliveryItemKind })}>{(["phase", "group", "task", "milestone", "risk"] as const).map(kind => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}</select>{row.kind !== "phase" && <select value={row.parentId || ""} onChange={event => void onPatchParent(row, event.target.value || undefined)}><option value="">顶层</option>{parentChoices(row).filter(candidate => candidate.id !== row.id).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.wbsCode ? `${candidate.wbsCode} ` : ""}{candidate.title}</option>)}</select>}</div> : <span>{kindLabel(row.kind)}{row.parentId && byId.get(row.parentId) ? ` / ${byId.get(row.parentId)!.title}` : ""}</span>;
    if (column === "status") return editing ? <select value={row.status} onChange={event => void onPatch(row, { status: event.target.value as DeliveryItemStatus })}>{(["todo", "doing", "blocked", "done"] as const).map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select> : statusLabel(row.status);
    if (column === "progress") return row.status === "done" ? "完成" : `${row.progress}%`;
    if (column === "progressOffset") return editing ? <input type="number" step="1" value={row.progressOffsetDays ?? 0} onChange={event => void onPatch(row, { progressOffsetDays: Number(event.target.value) || 0 })}/> : `${row.progressOffsetDays ?? 0} 天`;
    if (column === "start") return editing ? <input type="date" value={row.startDate || ""} onChange={event => void onPatch(row, { startDate: event.target.value })}/> : row.startDate || "—";
    if (column === "actualStart") return editing ? <input type="date" value={row.actualStartDate || ""} onChange={event => void onPatch(row, { actualStartDate: event.target.value })}/> : row.actualStartDate || "—";
    if (column === "due") return editing ? <input type="date" value={row.dueDate || ""} onChange={event => void onPatch(row, { dueDate: event.target.value })}/> : row.dueDate || "—";
    if (column === "period") return editing ? <input type="number" min="1" step="1" value={Math.max(1, row.periodDays ?? 1)} onChange={event => void onPatch(row, { periodDays: Math.max(1, Number(event.target.value) || 1) })}/> : `${Math.max(1, row.periodDays ?? 1)} 天`;
    if (column === "baseline") return editing ? <input type="date" value={row.baselineDueDate || ""} onChange={event => void onPatch(row, { baselineDueDate: event.target.value })}/> : row.baselineDueDate || "—";
    if (column === "actualPersonDays") return editing ? <input type="number" min="0" step="0.5" value={row.actualPersonDays ?? 0} onChange={event => void onPatch(row, { actualPersonDays: Math.max(0, Number(event.target.value) || 0) })}/> : `${row.actualPersonDays ?? 0} 人天`;
    if (column === "dependency") return row.kind !== "task" ? "—" : editing ? <select value={row.dependencyIds?.[0] || ""} onChange={event => void onPatch(row, { dependencyIds: event.target.value ? [event.target.value] : [] })}><option value="">无</option>{taskCandidates(row).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.wbsCode} {candidate.title}</option>)}</select> : (row.dependencyIds?.map(id => byId.get(id)?.wbsCode ? `${byId.get(id)!.wbsCode} ${byId.get(id)!.title}` : byId.get(id)?.title).filter(Boolean).join("、") || "—");
    return editing ? <input value={row.owner || ""} onChange={event => void onPatch(row, { owner: event.target.value })}/> : row.owner || "—";
  };
  return <div className={`delivery-table ${editing ? "is-editing" : "is-preview"}`}>
    {editing && <div className="delivery-table__toolbar"><button type="button" onClick={() => void onAdd()}>+ 新增任务</button><span>任务拖动 ↕ 调整顺序</span></div>}
    {editing && <div className="delivery-table__columns"><b>字段排序</b>{columns.map(column => <button type="button" key={column} draggable onDragStart={() => setDraggedColumn(column)} onDragEnd={() => setDraggedColumn(undefined)} onDragOver={event => event.preventDefault()} onDrop={() => { if (draggedColumn) setColumns(current => move(current, draggedColumn, column)); }}>{planColumnLabels[column]} ⠿</button>)}</div>}
    <table><thead><tr>{editing && <th className="delivery-table__actions">操作</th>}{columns.map(column => <th key={column}>{planColumnLabels[column]}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className={`is-${row.kind} is-phase-tone-${row.phaseIndex % 4}${draggedId === row.id ? " is-dragging" : ""}`} draggable={editing} onDragStart={() => setDraggedId(row.id)} onDragEnd={() => setDraggedId(undefined)} onDragOver={event => { if (editing) event.preventDefault(); }} onDrop={() => void dropRow(row.id)}>{editing && <td className="delivery-table__actions"><button type="button" className="delivery-table__drag" title="拖拽排序">↕</button><button type="button" className="delivery-table__delete" title="删除事项" onClick={() => { if (window.confirm(`删除“${row.title}”吗？`)) void onDelete(row); }}>删除</button></td>}{columns.map(column => <td key={column}>{cell(row, column)}</td>)}</tr>)}</tbody></table>
    {rows.length === 0 && <div className="delivery-empty">还没有计划事项，点击“新增任务”开始。</div>}
    <div className="delivery-table__mode-switch"><div className="delivery-switch"><button type="button" className={!editing ? "is-active" : ""} onClick={() => setMode("preview")}>预览</button><button type="button" className={editing ? "is-active" : ""} onClick={() => setMode("edit")}>编辑</button></div></div>
  </div>;
}

function PlanTable({ rows, phases, onPatch, onPatchParent, onAdd, onDelete, onReorder }: {
  rows: DeliveryGanttRow[];
  phases: DeliveryGanttRow[];
  onPatch: (row: DeliveryItem, patch: Partial<DeliveryItemLike>) => Promise<void>;
  onPatchParent: (row: DeliveryItem, parentId?: string) => Promise<void>;
  onAdd: () => Promise<void>;
  onDelete: (row: DeliveryItem) => Promise<void>;
  onReorder: (itemIds: string[]) => Promise<void>;
}) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [draggedId, setDraggedId] = useState<string>();
  const editing = mode === "edit";
  const byId = new Map(rows.map(row => [row.id, row]));
  const drop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const ids = rows.map(row => row.id);
    const sourceIndex = ids.indexOf(draggedId);
    const targetIndex = ids.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    ids.splice(sourceIndex, 1);
    ids.splice(targetIndex, 0, draggedId);
    setDraggedId(undefined);
    await onReorder(ids);
  };
  const parentChoices = (row: DeliveryGanttRow) => row.kind === "risk" ? rows.filter(candidate => candidate.kind === "task") : rows.filter(candidate => candidate.kind === "phase" || candidate.kind === "group" || candidate.kind === "task");
  return <div className={`delivery-table ${editing ? "is-editing" : "is-preview"}`}>
    <div className="delivery-table__toolbar"><div className="delivery-switch"><button type="button" className={!editing ? "is-active" : ""} onClick={() => setMode("preview")}>预览</button><button type="button" className={editing ? "is-active" : ""} onClick={() => setMode("edit")}>编辑</button></div>{editing && <><button type="button" onClick={() => void onAdd()}>+ 新增任务</button><span>拖动 ↕ 调整顺序</span></>}</div>
    <table><thead><tr>{editing && <th className="delivery-table__actions">操作</th>}<th>WBS / 事项</th><th>类型 / 所属</th><th>状态</th><th>进度</th><th>开始</th><th>当前截止</th><th>基线截止</th><th>前置依赖</th><th>交付物</th><th>负责人</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className={`is-${row.kind} is-phase-tone-${row.phaseIndex % 4}${draggedId === row.id ? " is-dragging" : ""}`} draggable={editing} onDragStart={() => setDraggedId(row.id)} onDragEnd={() => setDraggedId(undefined)} onDragOver={event => { if (editing) event.preventDefault(); }} onDrop={() => void drop(row.id)}>
        {editing && <td className="delivery-table__actions"><button type="button" className="delivery-table__drag" title="拖拽排序">↕</button><button type="button" className="delivery-table__delete" title="删除事项" onClick={() => { if (window.confirm(`删除“${row.title}”吗？`)) void onDelete(row); }}>删除</button></td>}
        <td>{editing ? <input value={row.title} onChange={event => void onPatch(row, { title: event.target.value })}/> : <span className="delivery-table__title"><em>{row.wbsCode}</em>{row.title}</span>}</td>
        <td>{editing ? <div className="delivery-table__hierarchy"><select value={row.kind} onChange={event => void onPatch(row, { kind: event.target.value as DeliveryItemKind })}>{(["phase", "group", "task", "milestone", "risk"] as const).map(kind => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}</select>{row.kind !== "phase" && <select value={row.parentId || ""} onChange={event => void onPatchParent(row, event.target.value || undefined)}><option value="">顶层</option>{parentChoices(row).filter(candidate => candidate.id !== row.id).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.wbsCode ? `${candidate.wbsCode} ` : ""}{candidate.title}</option>)}</select>}</div> : <span>{kindLabel(row.kind)}{row.parentId && byId.get(row.parentId) ? ` / ${byId.get(row.parentId)!.title}` : ""}</span>}</td>
        <td>{editing ? <select value={row.status} onChange={event => void onPatch(row, { status: event.target.value as DeliveryItemStatus })}>{(["todo", "doing", "blocked", "done"] as const).map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select> : statusLabel(row.status)}</td>
        <td>{editing ? <input type="number" min="0" max="100" value={row.progress} onChange={event => void onPatch(row, { progress: Number(event.target.value) || 0 })}/> : `${row.progress}%`}</td>
        <td>{editing ? <input type="date" value={row.startDate || ""} onChange={event => void onPatch(row, { startDate: event.target.value })}/> : row.startDate || "—"}</td>
        <td>{editing ? <input type="date" value={row.dueDate || ""} onChange={event => void onPatch(row, { dueDate: event.target.value })}/> : row.dueDate || "—"}</td>
        <td>{editing ? <input type="date" value={row.baselineDueDate || ""} onChange={event => void onPatch(row, { baselineDueDate: event.target.value })}/> : row.baselineDueDate || "—"}</td>
        <td>{editing ? <select value={row.dependencyIds?.[0] || ""} onChange={event => void onPatch(row, { dependencyIds: event.target.value ? [event.target.value] : [] })}><option value="">无</option>{rows.filter(candidate => candidate.id !== row.id && candidate.kind !== "phase" && candidate.kind !== "risk").map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.wbsCode ? `${candidate.wbsCode} ` : ""}{candidate.title}</option>)}</select> : (row.dependencyIds?.map(id => byId.get(id)?.title).filter(Boolean).join("、") || "—")}</td>
        <td>{editing ? <input value={row.owner || ""} onChange={event => void onPatch(row, { owner: event.target.value })}/> : row.owner || "—"}</td>
      </tr>)}</tbody>
    </table>
    {rows.length === 0 && <div className="delivery-empty">还没有计划事项，点击“新增任务”开始。</div>}
  </div>;
}
