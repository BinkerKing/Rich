import { useEffect, useMemo, useState } from "react";
import { api, type ProjectModuleItem } from "../../../api/client.js";
import { calendarDays, shiftCalendarMonth } from "./reportsCalendar.js";
import { ProjectRichTextEditor } from "../ProjectManagementModules.js";

type ReportType = "daily" | "weekly" | "monthly" | "meeting";
type DeliveryActivityKind = "record" | "todo" | "deliverable" | "risk" | "reminder" | "end";
type TodayWorkItem = { taskId: string; taskTitle: string; kind: DeliveryActivityKind; text: string };
type ProjectReport = {
  type: ReportType;
  date: string;
  title: string;
  projectProgress: number;
  completedWork: string[];
  tomorrowPlan: string[];
  risks: string[];
  summary: string;
  body: string;
  sources: string[];
  metrics: Array<{ label: string; value: string }>;
  filePath?: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const listText = (items: string[]) => items.join("\n");
const listValue = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const activityLabel = (kind: DeliveryActivityKind) => ({ record: "记录", todo: "待办", deliverable: "交付物", risk: "风险", reminder: "催办", end: "结束" } as const)[kind];

function todayWorkItems(items: ProjectModuleItem[], date: string): TodayWorkItem[] {
  return items.flatMap(item => {
    if (item.content.kind !== "task" || !Array.isArray(item.content.activities)) return [];
    return item.content.activities.flatMap((value): TodayWorkItem[] => {
      if (!value || typeof value !== "object") return [];
      const activity = value as Record<string, unknown>;
      const kind = activity.kind;
      const text = typeof activity.text === "string" ? activity.text.trim() : "";
      const createdToday = typeof activity.createdAt === "string" && activity.createdAt.slice(0, 10) === date;
      const completedToday = activity.done === true && typeof activity.completedAt === "string" && activity.completedAt.slice(0, 10) === date;
      const shouldShow = (activity.kind === "record" || activity.kind === "reminder" || activity.kind === "end")
        ? createdToday
        : (activity.kind === "todo" || activity.kind === "deliverable") && activity.done === true && completedToday;
      return shouldShow && (kind === "record" || kind === "todo" || kind === "deliverable" || kind === "risk" || kind === "reminder" || kind === "end") && text
        ? [{ taskId: item.id, taskTitle: item.title, kind, text }]
        : [];
    });
  });
}

function reportFrom(item: ProjectModuleItem): ProjectReport {
  const content = item.content;
  const type: ReportType = content.type === "weekly" || content.type === "monthly" || content.type === "meeting" ? content.type : "daily";
  return {
    type,
    date: typeof content.date === "string" ? content.date : today(),
    title: item.title || "项目日报",
    projectProgress: typeof content.projectProgress === "number" ? content.projectProgress : 0,
    completedWork: listValue(content.completedWork),
    tomorrowPlan: listValue(content.tomorrowPlan),
    risks: listValue(content.risks),
    summary: typeof content.summary === "string" ? content.summary : "",
    body: typeof content.body === "string" ? content.body : typeof content.summary === "string" ? content.summary : "",
    sources: listValue(content.sources),
    metrics: Array.isArray(content.metrics) ? content.metrics
      .filter((metric): metric is Record<string, unknown> => Boolean(metric) && typeof metric === "object")
      .map(metric => ({ label: typeof metric.label === "string" ? metric.label : "", value: typeof metric.value === "string" ? metric.value : "" }))
      .filter(metric => metric.label || metric.value) : [],
    filePath: typeof content.filePath === "string" ? content.filePath : undefined,
  };
}

function emptyReport(date = today()): ProjectReport {
  return { type: "daily", date, title: `项目日报 · ${date.slice(5).replace("-", "月")}日`, projectProgress: 0, completedWork: [], tomorrowPlan: [], risks: [], summary: "", body: "", sources: [], metrics: [] };
}

export function ReportsWorkspace({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ProjectModuleItem[]>([]);
  const [deliveryItems, setDeliveryItems] = useState<ProjectModuleItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectReport>(emptyReport());
  const [selectedDate, setSelectedDate] = useState(today());
  const [editing, setEditing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [reports, deliveryPlan] = await Promise.all([
      api.listProjectManagementModuleItems(projectId, "reports", undefined, true),
      api.listProjectManagementModuleItems(projectId, "deliveryPlan", undefined, true),
    ]);
    setItems(reports);
    setDeliveryItems(deliveryPlan);
  };

  useEffect(() => { void load().catch(errorValue => setError(String(errorValue))); }, [projectId]);

  const openReport = (item: ProjectModuleItem) => {
    if (openId === item.id) { setOpenId(null); setShowReport(false); return; }
    setOpenId(item.id);
    setDraft(reportFrom(item));
    setEditing(false);
    setShowReport(false);
    setError(null);
  };

  const createReport = async () => {
    setBusy(true); setError(null);
    try {
      const report = emptyReport(selectedDate);
      const item = await api.createProjectManagementModuleItem(projectId, "reports", { title: report.title, subtitle: report.date, content: report });
      await load(); setOpenId(item.id); setDraft(report); setEditing(true);
    } catch (errorValue) { setError(`新建失败：${String(errorValue)}`); } finally { setBusy(false); }
  };

  const saveReport = async () => {
    if (!openId) return;
    setBusy(true); setError(null);
    try {
      const file = await api.saveDailyReportFile(projectId, draft);
      await api.updateProjectManagementModuleItem(projectId, openId, {
        title: draft.title,
        subtitle: draft.date,
        content: { ...draft, filePath: file.relativePath },
      });
      await load();
      setDraft(current => ({ ...current, filePath: file.relativePath }));
      setEditing(false);
    } catch (errorValue) { setError(`保存失败：${String(errorValue)}`); } finally { setBusy(false); }
  };

  const selectedItems = items.filter(item => reportFrom(item).date === selectedDate);
  const reportDates = useMemo(() => new Set(items.map(item => reportFrom(item).date)), [items]);
  const days = useMemo(() => calendarDays(selectedDate), [selectedDate]);
  const [year, month] = selectedDate.split("-").map(Number);
  const openItem = selectedItems.find(item => item.id === openId);
  const todayWork = useMemo(() => todayWorkItems(deliveryItems, draft.date), [deliveryItems, draft.date]);

  return <section className="reports-workspace">
    <header className="reports-workspace__header">
      <div><p>PROJECT REPORTS</p><h1>报告中心</h1><small>日报、周报、月报与会议纪要，统一沉淀为可阅读、可追溯的项目记录。</small></div>
      <button type="button" onClick={() => void createReport()} disabled={busy}>+ 新建报告</button>
    </header>
    {error && <p className="reports-workspace__error">{error}</p>}
    <div className="reports-workspace__layout">
      <aside className="reports-calendar" aria-label="报告日历">
        <header><button type="button" aria-label="上个月" onClick={() => setSelectedDate(date => shiftCalendarMonth(date, -1))}>‹</button><strong>{year}年{month}月</strong><button type="button" aria-label="下个月" onClick={() => setSelectedDate(date => shiftCalendarMonth(date, 1))}>›</button></header>
        <div className="reports-calendar__week">{["一", "二", "三", "四", "五", "六", "日"].map(day => <span key={day}>周{day}</span>)}</div>
        <div className="reports-calendar__days">{days.map(date => {
          const inMonth = Number(date.slice(5, 7)) === month;
          return <button key={date} type="button" className={`${date === selectedDate ? "is-selected " : ""}${!inMonth ? "is-outside" : ""}`} onClick={() => { setSelectedDate(date); setOpenId(null); setShowReport(false); }}><span>{Number(date.slice(8))}</span>{reportDates.has(date) && <i aria-label="当天有报告" />}</button>;
        })}</div>
        <footer><b>{selectedDate}</b><span>有报告的日期已标记</span></footer>
      </aside>
    <div className={`reports-workspace__list${openItem ? " is-working" : ""}`}>
      <header className="reports-workspace__date-head"><h2>{formatReportDate(selectedDate)}</h2><span>{openItem ? "报告工作台" : `当日报告（${selectedItems.length}）`}</span></header>
      {!openItem && <div className="reports-workspace__report-list">
      {selectedItems.map(item => {
        const report = reportFrom(item);
        return <article key={item.id}>
          <button className="reports-workspace__row" type="button" onClick={() => openReport(item)}>
            <b className={`report-type-icon is-${report.type}`}>{reportTypeIcon(report.type)}</b><span><strong>{report.title}</strong><small>{reportTypeLabel(report.type)} · {report.date}</small></span><em>{reportTypeLabel(report.type)}</em><i>›</i>
          </button>
        </article>;
      })}
      {!selectedItems.length && <p className="reports-workspace__empty">当天没有报告，点击“新建日报”开始记录。</p>}
      </div>}
      {openItem && <article className="reports-workspace__working-report">
          <button className="reports-workspace__row reports-workspace__row--selected" type="button" onClick={() => { setOpenId(null); setShowReport(false); }}>
            <b className={`report-type-icon is-${draft.type}`}>{reportTypeIcon(draft.type)}</b><span><strong>{draft.title}</strong><small>点击返回当天报告列表</small></span><em>{reportTypeLabel(draft.type)}</em><i>⌃</i>
          </button>
          <div className="reports-workspace__detail">
            <header><div><span className={`report-workbench__eyebrow is-${draft.type}`}>{reportTypeLabel(draft.type)} · {reportTypeDescriptor(draft.type)}</span><h2>{draft.title}</h2><small>{draft.date}{draft.filePath ? ` · ${draft.filePath}` : " · 尚未写入文件"}</small></div><div className="reports-workspace__detail-actions">{!editing && <button type="button" onClick={() => setShowReport(current => !current)}>{showReport ? "收起报告" : "显示报告"}</button>}{!editing && <button type="button" onClick={() => { setEditing(true); setShowReport(false); }}>编辑报告</button>}<button type="button" onClick={() => void saveReport()} disabled={busy}>{busy ? "保存中…" : "保存并写入文件"}</button></div></header>
            {!editing && !showReport && <ReportWorkbench report={draft} todayWork={todayWork} />}
            {!editing && showReport && <section className="report-workbench__editor"><header><div><span>DAILY REPORT</span><h3>{draft.title}</h3></div><small>可直接编辑报告内容，保存后写入文件。</small></header><ProjectRichTextEditor projectId={`${projectId}-report-${openId}`} value={draft.body} onChange={body => setDraft(current => ({ ...current, body, summary: plainText(body).slice(0, 160) }))} /></section>}
            {editing && <>
            <label>报告标题<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
            <div className="reports-workspace__fields reports-workspace__fields--meta"><label>报告类型<select value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value as ReportType })}>{(["daily", "weekly", "monthly", "meeting"] as ReportType[]).map(type => <option key={type} value={type}>{reportTypeLabel(type)}</option>)}</select></label><label>报告日期<input type="date" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></label></div>
            {draft.type === "daily" && <><label>整体项目进度 <output>{draft.projectProgress}%</output><input type="range" min="0" max="100" value={draft.projectProgress} onChange={event => setDraft({ ...draft, projectProgress: Number(event.target.value) })} /></label>
            <div className="reports-workspace__fields">
              <label>今日完成工作<textarea value={listText(draft.completedWork)} placeholder="每行一项" onChange={event => setDraft({ ...draft, completedWork: event.target.value.split("\n").filter(Boolean) })} /></label>
              <label>明日计划<textarea value={listText(draft.tomorrowPlan)} placeholder="每行一项" onChange={event => setDraft({ ...draft, tomorrowPlan: event.target.value.split("\n").filter(Boolean) })} /></label>
              <label>风险与阻碍<textarea value={listText(draft.risks)} placeholder="暂无阻碍" onChange={event => setDraft({ ...draft, risks: event.target.value.split("\n").filter(Boolean) })} /></label>
            </div></>}
            <section className="report-editor-block"><header><div><span>REPORT BODY</span><h3>{draft.type === "meeting" ? "会议记录与决议" : "报告正文"}</h3></div><small>支持标题、列表、表格、图片与链接</small></header><ProjectRichTextEditor projectId={`${projectId}-report-${openId}`} value={draft.body} onChange={body => setDraft(current => ({ ...current, body, summary: plainText(body).slice(0, 160) }))} /></section>
            <div className="reports-workspace__fields"><label>相关信息 / 来源<textarea value={listText(draft.sources)} placeholder="每行一条：项目任务、会议录音、数据链接…" onChange={event => setDraft({ ...draft, sources: event.target.value.split("\n").filter(Boolean) })} /></label><label>关键数据（名称：数值）<textarea value={draft.metrics.map(metric => `${metric.label}：${metric.value}`).join("\n")} placeholder="完成率：68%\n本周关闭：12 项" onChange={event => setDraft({ ...draft, metrics: event.target.value.split("\n").filter(Boolean).map(line => { const [label, ...value] = line.split(/[：:]/); return { label: label.trim(), value: value.join("：").trim() }; }) })} /></label></div>
            </>}
          </div>
        </article>}
    </div></div>
  </section>;
}

function reportTypeLabel(type: ReportType) {
  return ({ daily: "日报", weekly: "周报", monthly: "月报", meeting: "会议纪要" } as const)[type];
}

function reportTypeIcon(type: ReportType) { return ({ daily: "日", weekly: "周", monthly: "月", meeting: "会" } as const)[type]; }
function reportTypeDescriptor(type: ReportType) { return ({ daily: "执行快照", weekly: "进展复盘", monthly: "经营全景", meeting: "结论与行动" } as const)[type]; }
function plainText(html: string) { return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); }

function formatReportDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date(year, month - 1, day).getDay()];
  return `${year}年${month}月${day}日 · 星期${weekday}`;
}

function ReportWorkbench({ report, todayWork }: { report: ProjectReport; todayWork: TodayWorkItem[] }) {
  if (report.type !== "daily") return <section className={`report-workbench report-workbench--document is-${report.type}`}>
    <ReportDocument report={report} />
    <ReportInsightRail report={report} />
  </section>;
  const hasRisk = report.risks.some(risk => risk !== "暂无阻碍" && risk !== "暂无阻塞");
  return <section className="report-workbench">
    <div className="report-workbench__kpis">
      <div className="is-done"><span>今日活动</span><b>{todayWork.length}</b></div>
      <div className="is-active"><span>明日计划</span><b>{report.tomorrowPlan.length}</b></div>
      <div className={hasRisk ? "is-risk" : "is-clear"}><span>风险与阻碍</span><b>{hasRisk ? report.risks.length : 0}</b></div>
      <div className="is-progress"><span>项目进度</span><b>{report.projectProgress}%</b></div>
    </div>
    <div className="report-workbench__grid">
      <TodayCompletedWork items={todayWork} />
      <aside className="report-workbench__side">
        <section className="report-workbench__progress"><header><h3>整体项目进度</h3><strong>{report.projectProgress}%</strong></header><div><i style={{ width: `${report.projectProgress}%` }} /></div><small>当前进度按日报更新</small></section>
        <section className="report-workbench__plan"><header><h3>明日计划</h3><span>{report.tomorrowPlan.length} 项</span></header>{report.tomorrowPlan.length ? <ol>{report.tomorrowPlan.map((task, index) => <li key={`${task}-${index}`}>{task}</li>)}</ol> : <p>暂无明日计划。</p>}</section>
        <section className={`report-workbench__risks${hasRisk ? " has-risk" : ""}`}><header><h3>风险与阻碍</h3><span>{hasRisk ? "需关注" : "状态良好"}</span></header>{hasRisk ? <ul>{report.risks.map((risk, index) => <li key={`${risk}-${index}`}>{risk}</li>)}</ul> : <p>✓ 暂无阻碍</p>}</section>
        <ReportInsightRail report={report} compact />
      </aside>
    </div>
  </section>;
}

function TodayCompletedWork({ items }: { items: TodayWorkItem[] }) {
  const taskGroups = items.reduce<Array<{ taskId: string; taskTitle: string; activities: TodayWorkItem[] }>>((groups, item) => {
    const group = groups.find(value => value.taskId === item.taskId);
    if (group) group.activities.push(item);
    else groups.push({ taskId: item.taskId, taskTitle: item.taskTitle, activities: [item] });
    return groups;
  }, []);
  return <section className="report-workbench__completed report-workbench__today-work"><header><div><h3>今日完成工作</h3><span>{items.length} 条今日任务活动</span></div><b>✓</b></header>{taskGroups.length ? taskGroups.map(group => <article key={group.taskId}><i>✓</i><div><strong>{group.taskTitle}</strong><div className="report-workbench__activity-list">{group.activities.map((activity, index) => <p key={`${activity.kind}-${activity.text}-${index}`}><b className={`is-${activity.kind}`}>{activityLabel(activity.kind)}</b><span>{activity.text}</span></p>)}</div></div></article>) : <p>暂无今日任务活动。</p>}<footer>记录、催办、结束，以及当天完成的待办和交付物</footer></section>;
}

function ReportDocument({ report }: { report: ProjectReport }) {
  const body = report.body || report.summary;
  return <article className="report-document"><header><span>{reportTypeIcon(report.type)} / {reportTypeLabel(report.type)}</span><h3>{report.title}</h3><p>{report.summary || reportTypeDescriptor(report.type)}</p></header><div className="report-document__content">{body ? <div className="workflow-rich-content" dangerouslySetInnerHTML={{ __html: body }} /> : <p>暂无正文。编辑报告后，可在这里沉淀完整的背景、结论与细节。</p>}</div></article>;
}

function ReportInsightRail({ report, compact = false }: { report: ProjectReport; compact?: boolean }) {
  const actionLabel = report.type === "meeting" ? "待办行动" : report.type === "weekly" ? "下周重点" : report.type === "monthly" ? "下月关注" : "明日计划";
  return <aside className={`report-insight-rail${compact ? " is-compact" : ""}`}>
    <section className="report-insight-rail__stats"><header><h3>关键数据</h3><span>{report.metrics.length || "—"} 项</span></header>{report.metrics.length ? <div>{report.metrics.map((metric, index) => <article key={`${metric.label}-${index}`}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</div> : <p>尚未记录关键数据</p>}</section>
    <section className="report-insight-rail__sources"><header><h3>相关信息</h3><span>{report.sources.length || "—"} 条</span></header>{report.sources.length ? <ul>{report.sources.map((source, index) => <li key={`${source}-${index}`}>{source}</li>)}</ul> : <p>可添加任务、文档或数据来源</p>}</section>
    {report.type !== "daily" && <section className="report-insight-rail__actions"><header><h3>{actionLabel}</h3><span>{report.tomorrowPlan.length} 项</span></header>{report.tomorrowPlan.length ? <ol>{report.tomorrowPlan.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol> : <p>正文中记录后续行动</p>}</section>}
  </aside>;
}
