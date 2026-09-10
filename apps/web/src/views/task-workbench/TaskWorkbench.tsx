import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { stepScopeIds, unconfirmedExecutionSteps, pendingStepCheckpoints } from "@ke/domain";
import { RequirementDocument } from "./RequirementDocument.js";
import { RequirementHistory } from "./RequirementHistory.js";
import { StepRecords } from "./StepRecords.js";
import { StepCheckpoints } from "./StepCheckpoints.js";
import type { WorkbenchAction, WorkbenchRecord, WorkbenchResource, WorkbenchStep, WorkbenchTask } from "@ke/domain";
import { openBoundCodex } from "../project-management/deliverables/DeliverableCodexLauncher.js";
import "./TaskWorkbench.css";
import { resourceLink, isLocalResource } from "./resourceLinks.js";
import { ResourceText } from "./ResourceText.js";

const statuses: Record<string, string> = { draft: "待确认", active: "进行中", blocked: "有阻塞", completed: "已交付", archived: "已归档", todo: "待执行", running: "执行中", done: "已完成", skipped: "已跳过" };
const recordLabels: Record<WorkbenchRecord["kind"], string> = { progress: "进展", conclusion: "结论", decision: "决策", question: "待确认" };
const commandLabels = { sending: "正在发送指令", running: "Codex 执行中", finished: "对话回合已结束", failed: "指令执行失败", unknown: "请核对执行结果" };
const actionLabels: Record<WorkbenchAction, string> = { play: "播放任务", check: "梳理确认项", clarify: "细化需求", refine: "细化子计划", optimize: "优化计划", execute: "按计划执行" };

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/workbench${path}`, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `请求失败 (${response.status})`);
  return data;
}
function time(value: string) { return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
export function taskProgress(task: Pick<WorkbenchTask, "steps">) {
  const parentIds = new Set(task.steps.map(step => step.parentId));
  const leaves = task.steps.filter(step => !parentIds.has(step.id));
  return { total: leaves.length, done: leaves.filter(step => step.status === "done" || step.status === "skipped").length };
}

export function TaskWorkbench(): ReactNode {
  const [tasks, setTasks] = useState<WorkbenchTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem("rich.workbench.selected"));
  const [stepId, setStepId] = useState<string>();
  const [tab, setTab] = useState<"summary" | "checkpoints" | "artifacts" | "activity" | "changes">("summary");
  const [sideTab, setSideTab] = useState<"records" | "materials">("records");
  const followCommand = useRef<string>();
  const restoredTask = useRef<string>();
  const treeRef = useRef<HTMLOListElement>(null);
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<WorkbenchTask[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const refreshCounter = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshCounter.current;
    const data = await request<{ tasks: WorkbenchTask[] }>("");
    if (sequence === refreshCounter.current) { setTasks(data.tasks); setLoading(false); }
  }, []);
  useEffect(() => {
    let disposed = false;
    const reload = () => { if (!disposed) void refresh().catch(reason => { if (!disposed) { setError(String(reason)); setLoading(false); } }); };
    reload();
    const events = new EventSource("/api/events");
    const changed = (event: MessageEvent) => { if (JSON.parse(event.data).kind === "workbench.changed") reload(); };
    events.addEventListener("change", changed as EventListener);
    events.addEventListener("ready", reload);
    const interval = window.setInterval(() => { if (!document.hidden) reload(); }, 15_000);
    return () => { disposed = true; refreshCounter.current++; events.close(); window.clearInterval(interval); };
  }, [refresh]);
  useEffect(() => { if (selectedId) localStorage.setItem("rich.workbench.selected", selectedId); else localStorage.removeItem("rich.workbench.selected"); setStepId(undefined); setTab("summary"); setCollapsed(new Set()); setHistory(null); setSideTab("records"); }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, [contenteditable='true']")) return;
      if (document.querySelector("[role='dialog'], dialog[open], .tw-modal-back")) return;

      event.preventDefault();
      event.stopPropagation();
      setSelectedId(null);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const task = tasks.find(item => item.id === selectedId);
  const step = task?.steps.find(item => item.id === stepId);
  const displayStepStatus = task && step && pendingStepCheckpoints(task, step.id).length ? "blocked" : step?.status;
  const progress = task ? taskProgress(task) : { done: 0, total: 0 };
  const lastCommand = task?.commands.at(-1);
  const requirementNeedsConfirmation = Boolean(task && !task.requirementConfirmed);
  const savedAfterCheck = task && lastCommand?.action === "check" && lastCommand.error?.startsWith("确认项未成功保存") && lastCommand.stepId && (task.checkpoints ?? []).some(item => stepScopeIds(task, lastCommand.stepId!).has(item.stepId));
  const operating = busy || lastCommand?.status === "sending" || lastCommand?.status === "running";
  const executing = lastCommand?.status === "sending" || lastCommand?.status === "running";
  useEffect(() => {
    if (executing) followCommand.current = lastCommand?.id;
    if (!task || (!executing && followCommand.current !== lastCommand?.id) || !lastCommand?.activeStepId) return;
    if (!executing) followCommand.current = undefined;
    const activeId = lastCommand.activeStepId;
    if (stepId !== activeId) { setStepId(activeId); setTab("summary"); }
    const parents = new Set<string>();
    let parent = task.steps.find(item => item.id === activeId)?.parentId;
    while (parent && !parents.has(parent)) { parents.add(parent); parent = task.steps.find(item => item.id === parent)?.parentId; }
    setCollapsed(previous => { if (![...parents].some(id => previous.has(id))) return previous; return new Set([...previous].filter(id => !parents.has(id))); });
    requestAnimationFrame(() => treeRef.current?.querySelector(`[data-step-id="${CSS.escape(activeId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [task?.version, executing, lastCommand?.activeStepId, stepId]);
  useEffect(() => {
    if (!task || restoredTask.current === task.id) return;
    restoredTask.current = task.id;
    if (lastCommand?.activeStepId) { setStepId(lastCommand.activeStepId); setTab("summary"); }
  }, [task?.id, lastCommand?.activeStepId]);
  const perform = async (operation: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const openConversation = async () => {
    if (!task) return;
    const data = await request<{ conversation: { id: string; projectId: string; deliverableId: string; title: string } }>(`/${task.id}/conversation`);
    openBoundCodex({ projectId: data.conversation.projectId, deliverableId: data.conversation.deliverableId, deliverableTitle: data.conversation.title, conversationId: data.conversation.id });
  };
  const newTask = () => perform(async () => {
    const response = await fetch("/api/deliverable-codex/__general__/__general__/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "新任务" }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "创建 Codex 对话失败");
    openBoundCodex({ projectId: "__general__", deliverableId: "__general__", deliverableTitle: "通用任务", conversationId: body.conversation.id });
    setNotice("请在 Codex 聊天框选择任务模式，然后提出需求。");
  });
  const confirm = (target: "requirement" | "plan") => perform(async () => {
    if (!task) return;
    await request(`/${task.id}/write`, { action: "confirm", expectedVersion: task.version, input: { target, evidence: `用户在工作台确认 v${task.version} 的${target === "plan" ? "计划" : "当前需求"}` } });
    await refresh();
  });
  const command = (action: WorkbenchAction, scope?: string) => perform(async () => {
    if (!task) return;
    const requestId = crypto.randomUUID();
    followCommand.current = requestId;
    await request(`/${task.id}/commands`, { requestId, expectedVersion: task.version, action, stepId: scope });
    setNotice("指令已提交到绑定的 Codex 对话；步骤状态以实际写回为准。");
    await refresh();
  });
  const archive = () => perform(async () => {
    if (!task) return;
    await request(`/${task.id}/write`, { action: "update", expectedVersion: task.version, input: { status: task.status === "archived" ? "draft" : "archived" } });
    await refresh();
  });
  const upload = (file: File) => perform(async () => {
    if (!task) return;
    const form = new FormData(); form.append("file", file); form.append("expectedVersion", String(task.version));
    const response = await fetch(`/api/workbench/${task.id}/materials`, { method: "POST", body: form });
    const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "上传失败");
    await refresh(); setNotice("材料已加入任务，Codex 可在执行时读取。");
  });
  const toggle = (id: string) => setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const renderSteps = (parentId?: string, prefix = ""): ReactNode => task?.steps.filter(item => item.parentId === parentId).map((item, index) => {
    const number = prefix ? `${prefix}.${index + 1}` : String(index + 1);
    const hasChildren = task.steps.some(child => child.parentId === item.id);
    const pending = pendingStepCheckpoints(task, item.id).length;
    const isCurrentStep = executing && lastCommand?.activeStepId === item.id;
    const displayStatus = isCurrentStep ? "running" : item.status === "skipped" ? "skipped" : pending ? "blocked" : item.status;
    const statusLabel = isCurrentStep ? statuses.running : item.status === "skipped" ? statuses.skipped : pending ? `有 ${pending} 项待确认，步骤阻塞` : statuses[item.status];
    return <li key={item.id}>
      <div data-step-id={item.id} className={`tw-step ${item.id === stepId ? "is-selected" : ""}`}>
        <button className="tw-step__select" title={`${number} ${item.title} · ${statusLabel}`} aria-label={`${number} ${item.title}，${statusLabel}`} onClick={() => { setStepId(item.id); setTab("summary"); }} aria-current={item.id === stepId ? "step" : undefined}>
          <span className={`tw-step__light is-${displayStatus}`} aria-hidden="true" />
          <span className="tw-step__marker" aria-hidden="true">{number}</span>
          <strong>{item.title}</strong>
        </button>
        {hasChildren && <button className="tw-step__expand" onClick={() => toggle(item.id)} aria-label={`${collapsed.has(item.id) ? "展开" : "收起"}${item.title}`} aria-expanded={!collapsed.has(item.id)}>{collapsed.has(item.id) ? "›" : "⌄"}</button>}
      </div>
      {hasChildren && !collapsed.has(item.id) && <ol>{renderSteps(item.id, number)}</ol>}
    </li>;
  });
  const visibleRecords = task?.records.filter(record => step ? record.stepId === step.id : !record.stepId) ?? [];
  const stepResources = task?.resources.filter(resource => resource.kind !== "material" && (step ? resource.stepId === step.id : true)) ?? [];
  const stepIndex = step ? task?.steps.findIndex(item => item.id === step.id) ?? -1 : -1;
  const precedingStepIds = new Set(stepIndex > 0 ? task!.steps.slice(0, stepIndex).map(item => item.id) : []);
  const handoffResources = step ? task!.resources.filter(resource => resource.kind === "intermediate" && resource.stepId !== step.id && resource.stepId && precedingStepIds.has(resource.stepId)) : [];
  const handoffRecords = step ? task!.records.filter(record => record.stepId && precedingStepIds.has(record.stepId) && (record.kind === "conclusion" || (record.kind === "question" && !record.resolved))) : [];
  const resourceCards = (resources: WorkbenchResource[]) => resources.length ? resources.map(resource => <ResourceCard key={resource.id} taskId={task!.id} resource={resource} />) : <p className="tw-empty-note">还没有记录。Codex 写回后会显示在这里。</p>;

  return <div className="tw">
    <header className="tw-top">
      <div>{task && <button className="tw-breadcrumb" onClick={() => setSelectedId(null)}>任务 /</button>}<h1>{task ? task.title : "任务"}</h1><p>{task ? task.outputTarget || "围绕当前需求，按计划推进" : "在 Codex 中提出需求，在这里跟踪计划与成果。"}</p></div>
      <div className="tw-actions">
        {task ? <button className="tw-primary tw-play" aria-label={executing ? "任务执行中" : "播放任务"} title={executing ? "任务执行中，焦点跟随当前步骤" : "按计划逐步执行，遇到确认项停止"} disabled={operating || !task.requirementConfirmed || !task.planConfirmed || task.status === "archived" || task.status === "completed"} onClick={() => { setSideTab("records"); void command("play"); }}>{executing ? "◌" : "▶"}</button> : <><button className="tw-primary" disabled={busy} onClick={() => void newTask()}>＋ 在 Codex 中发起任务</button></>}
      </div>
    </header>
    {error && <div className="tw-alert" role="alert">{error}<button onClick={() => void perform(refresh)}>刷新重试</button></div>}
    {notice && <div className="tw-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
    {loading ? <div className="tw-empty">正在读取任务…</div> : !task ? <>
      <div className="tw-list-toolbar"><span>{tasks.filter(item => item.status !== "archived").length} 个任务</span><input aria-label="筛选任务" placeholder="搜索任务…" value={query} onChange={event => setQuery(event.target.value)} /><label><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />显示归档</label></div>
      {tasks.filter(item => (archived || item.status !== "archived") && `${item.title} ${item.requirement}`.toLowerCase().includes(query.toLowerCase())).map(item => {
        const count = taskProgress(item);
        return <button className="tw-task-card" key={item.id} onClick={() => setSelectedId(item.id)}><span className="tw-task-card__icon">↗</span><span><strong>{item.title}</strong><p>{item.requirement || "需求待明确"}</p><small>{item.outputTarget || "通用任务"} · 更新于 {time(item.updatedAt)}</small></span><span className="tw-task-card__progress">{count.done} / {count.total}<small>步骤已完成或跳过</small></span><span className={`tw-status is-${item.status}`}>{statuses[item.status]}</span><span>›</span></button>;
      })}
      {!tasks.length && <div className="tw-empty"><span className="tw-empty__mark">↗</span><h2>先说你想完成什么</h2><p>需求可以不完整。让 Codex 整理当前理解，<br />确认后制定计划，再一步步推进。</p><div className="tw-empty__flow"><span>提出需求</span>→<span>确认计划</span>→<span>跟踪执行</span>→<span>交付成果</span></div><button className="tw-primary" disabled={busy} onClick={() => void newTask()}>打开 Codex，开始任务</button><small>完整交流保留在 Codex 对话中；这里展示有价值的信息。</small></div>}
    </> : <>
      <div className="tw-task-meta"><span className={`tw-status is-${task.status}`}>{statuses[task.status]}</span><span>通用任务</span><span>任务修订 #{task.version}</span><span>更新于 {time(task.updatedAt)}</span><button onClick={() => void perform(async () => setHistory((await request<{ versions: WorkbenchTask[] }>(`/${task.id}/history`)).versions))}>版本记录</button><button disabled={operating} onClick={() => void archive()}>{task.status === "archived" ? "恢复任务" : "归档"}</button></div>
      {!operating && task.status !== "archived" && task.status !== "completed" && (!task.requirementConfirmed || !task.planConfirmed) && <div className="tw-readiness" role="status"><span>{!task.requirementConfirmed ? (task.checkpoints?.some(item => item.answer) ? "当前需求有待确认的变动。请核对变动后的 PRD，再确认计划；普通信息补充无需重复确认。" : "当前需求尚未确认，请先查看并确认需求。") : "需求已确认，当前计划尚待确认，确认后可继续播放。"}</span>{!task.requirementConfirmed ? <button onClick={() => { setStepId(undefined); setTab("summary"); }}>查看更新后的需求</button> : <button disabled={!task.steps.length} onClick={() => void confirm("plan")}>确认当前计划</button>}</div>}
      <div className="tw-layout">
        <aside className="tw-plan tw-panel">
          <header><h2>执行计划</h2><button disabled={operating || task.status === "archived"} onClick={() => void command("optimize")}>优化</button></header>
          <div className="tw-plan__progress"><strong>{progress.done}<small> / {progress.total} 个步骤</small></strong><div><i style={{ width: `${progress.total ? progress.done / progress.total * 100 : 0}%` }} /></div></div>
          <button className={`tw-overview-link ${!step ? "is-selected" : ""} ${requirementNeedsConfirmation ? "has-requirement-alert" : ""}`} onClick={() => { setStepId(undefined); setTab("summary"); }} aria-label={requirementNeedsConfirmation ? "需求与任务总览：需求待确认" : "需求与任务总览"}>
            <span className={`tw-step__light is-${requirementNeedsConfirmation ? "blocked" : "done"}`} aria-hidden="true" />
            需求与任务总览
            {requirementNeedsConfirmation && <span className="tw-requirement-alert">需求待确认</span>}
          </button>
          <ol ref={treeRef} className="tw-tree">{renderSteps()}</ol>
          {!task.steps.length && <p className="tw-empty-note">等待 Codex 制定计划。需求尚不明确也可以先安排“细化需求”步骤。</p>}
          <footer><span>{task.planConfirmed ? "✓ 当前计划已确认" : "当前计划待确认"}</span>{!task.planConfirmed && <button disabled={busy || !task.requirementConfirmed || !task.steps.length || task.status === "archived"} onClick={() => void confirm("plan")}>确认计划</button>}</footer>
        </aside>
        <main className="tw-detail tw-panel">
          <header className="tw-detail__step-header"><div className="tw-detail__heading"><div className="tw-eyebrow">{step ? "PLAN STEP" : "TASK BRIEF"} <span className={`tw-status is-${displayStepStatus ?? task.status}`}>{statuses[displayStepStatus ?? task.status]}</span></div><h2>{step?.title ?? "需求 PRD"}</h2></div>{step && <div className="tw-detail__step-actions"><button disabled={operating} onClick={() => void command("refine", step.id)}>细化子计划</button><button disabled={operating} onClick={() => void command("optimize", step.id)}>优化此步</button><button className="tw-primary" disabled={operating || !task.planConfirmed || !task.requirementConfirmed || ["done", "skipped"].includes(step.status) || task.status === "archived" || unconfirmedExecutionSteps(task, step.id).length > 0} onClick={() => void command("execute", step.id)}>执行此步 →</button></div>}{!step && <div className="tw-detail__step-actions"><button disabled={operating || task.status === "archived"} onClick={() => void command("clarify")}>请 Codex 细化需求</button>{!task.requirementConfirmed && <button className="tw-primary" disabled={busy || !task.requirement.trim() || task.status === "archived"} onClick={() => void confirm("requirement")}>确认当前理解</button>}</div>}</header>
          {!step && <div className={`tw-detail__actions ${requirementNeedsConfirmation ? "has-requirement-alert" : ""}`}><span className={`tw-step__light is-${requirementNeedsConfirmation ? "blocked" : "done"}`} aria-hidden="true" /><span>{task.requirementConfirmed ? "当前需求已确认" : "需求待确认：请阅读 PRD 后确认当前理解"}</span></div>}
          <nav className="tw-tabs" aria-label="步骤详情">{(["summary", "checkpoints", "artifacts", "activity", ...(!step ? ["changes" as const] : [])] as const).filter(value => step || value !== "checkpoints").map(value => <button key={value} aria-pressed={tab === value} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{value === "summary" ? (step ? "目标与结论" : "需求 PRD") : value === "checkpoints" ? "步骤确认项" : value === "artifacts" ? "相关产物" : value === "activity" ? "进展记录" : "变更记录"}</button>)}</nav>
          <div className="tw-detail__body">
            {tab === "checkpoints" && step && <StepCheckpoints task={task} step={step} disabled={busy || task.status === "archived"} onReview={() => void command("check", step.id)} onSave={async (id, answer, answerMode) => { await request(`/${task.id}/write`, { action: "answer", expectedVersion: task.version, input: { id, answer, answerMode } }); await refresh(); }} />}
            {tab === "summary" && !step && <RequirementDocument task={task} />}
            {tab === "summary" && step && <>
              <section className="tw-copy"><h3>{step ? "步骤目标" : "当前理解"}</h3><p>{step?.goal || (step ? "待补充" : task.requirement || "待明确")}</p></section>
              <section className="tw-acceptance"><h3>完成条件</h3><p>{step?.acceptance || (step ? "待补充" : task.acceptance || "待明确")}</p></section>
              {!step && task.openQuestions && <section className="tw-question"><h3>尚待明确</h3><p>{task.openQuestions}</p></section>}
              {step?.evidence && <section className="tw-copy"><h3>执行依据</h3><p>{step.evidence}</p></section>}
              <h3 className="tw-section-heading">关键结论与决策</h3>
              {visibleRecords.filter(record => record.kind !== "progress").map(record => <RecordCard key={record.id} record={record} />)}
              {!visibleRecords.some(record => record.kind !== "progress") && <p className="tw-empty-note">Codex 会把值得保留的结论、决策和问题写到这里。</p>}
            </>}
            {tab === "changes" && !step && <RequirementHistory taskId={task.id} version={task.version} confirmed={task.requirementConfirmed} />}
            {tab === "artifacts" && <>{stepResources.length ? <><h3 className="tw-section-heading">当前步骤产物</h3>{resourceCards(stepResources)}</> : <p className="tw-empty-note">当前步骤还没有产物。</p>}{handoffResources.length > 0 && <><h3 className="tw-section-heading">前序交接产物</h3>{resourceCards(handoffResources)}</>}</>}
            {tab === "activity" && <>{visibleRecords.filter(record => record.kind === "progress").map(record => <RecordCard key={record.id} record={record} />)}{handoffRecords.length > 0 && <><h3 className="tw-section-heading">前序结论与待确认</h3>{handoffRecords.map(record => <RecordCard key={record.id} record={record} />)}</>}{task.commands.filter(item => step ? item.stepId === step.id : true).slice().reverse().map(item => <details className="tw-command" key={item.id}><summary><b>{actionLabels[item.action]}</b><span>{commandLabels[item.status]}</span><small>{time(item.createdAt)}</small></summary>{item.error && <p className="tw-error-text">{item.error}</p>}<pre>{item.prompt}</pre></details>)}{!visibleRecords.length && !handoffRecords.length && !task.commands.length && <p className="tw-empty-note">尚未执行。点击按钮后，指令和执行状态会保留在这里。</p>}</>}
          </div>
          <footer className="tw-detail__footer"><span className="tw-live-dot" /><span>{lastCommand ? savedAfterCheck ? "确认项已保存，请查看步骤确认项" : commandLabels[lastCommand.status] : "所有交流在绑定的 Codex 对话中进行"}</span><button disabled={busy} onClick={() => void perform(openConversation)}>打开对话 ↗</button></footer>
          {lastCommand?.error && !savedAfterCheck && <p className="tw-error-text">{lastCommand.error}</p>}
        </main>
        <aside className="tw-resources tw-panel">
          <header><nav className="tw-side-tabs" aria-label="执行信息"><button aria-pressed={sideTab === "records"} onClick={() => setSideTab("records")}>步骤记录</button><button aria-pressed={sideTab === "materials"} onClick={() => setSideTab("materials")}>材料与成果</button></nav>{sideTab === "materials" && <button disabled={busy || task.status === "archived"} onClick={() => fileInput.current?.click()}>＋ 文件</button>}<input hidden ref={fileInput} type="file" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} /></header>
          {sideTab === "records" ? <StepRecords task={task} executing={executing} onSelectStep={id => { setStepId(id); setTab("summary"); }} /> : <div className="tw-materials-scroll">
          <section><h3>任务材料 <small>{task.resources.filter(item => item.kind === "material").length}</small></h3>{resourceCards(task.resources.filter(item => item.kind === "material"))}</section>
          <section><h3>{step ? "当前步骤产物" : "中间产物"}</h3>{resourceCards(stepResources.filter(item => item.kind === "intermediate"))}</section>
          <section className="tw-delivery"><div className="tw-eyebrow">DELIVERY</div><h3>最终交付</h3><p>{task.outputTarget || "交付位置待明确"}</p><span className={`tw-status is-${task.status}`}>{task.status === "completed" ? "已完成交付" : "尚未完成交付"}</span>{resourceCards(task.resources.filter(item => item.kind === "final"))}</section>
          </div>}
        </aside>
      </div>
    </>}
    {history && <div className="tw-modal-back" onClick={() => setHistory(null)}><section className="tw-history" role="dialog" aria-modal="true" aria-label="版本记录" onClick={event => event.stopPropagation()}><header><h2>任务版本记录</h2><button onClick={() => setHistory(null)} aria-label="关闭版本记录">×</button></header><p>每次写回均保留快照；这里展示最近 100 个版本。</p>{history.map(version => <details key={version.version}><summary>v{version.version} · {time(version.updatedAt)} · {statuses[version.status]}</summary><h3>{version.title}</h3><p>{version.requirement}</p><ol>{version.steps.map(item => <li key={item.id}>{item.title} · {statuses[item.status]}</li>)}</ol><p>{version.records.length} 条记录 · {version.resources.length} 份材料与产物</p></details>)}</section></div>}
  </div>;
}

function RecordCard({ record }: { record: WorkbenchRecord }) {
  return <article className={`tw-record ${record.kind === "question" && !record.resolved ? "is-question" : ""}`}><header><b>{recordLabels[record.kind]}{record.kind === "question" && record.resolved ? " · 已解决" : ""}</b><time>{time(record.createdAt)}</time></header><p><ResourceText text={record.text} /></p>{record.evidence && <small>依据：<ResourceText text={record.evidence} /></small>}</article>;
}
function ResourceCard({ resource }: { taskId: string; resource: WorkbenchResource }) {
  const href = resourceLink(resource.location);
  const [copyState, setCopyState] = useState("");
  const [expanded, setExpanded] = useState(false);
  const format = resource.format ?? (resource.content ? "information" : isLocalResource(resource.location) ? "file" : "link");
  const label = { file: "文件", link: "链接", information: "信息" }[format];
  const copy = async () => {
    try { await navigator.clipboard.writeText([resource.location, resource.content].filter(Boolean).join("\n")); setCopyState("已复制"); }
    catch { setCopyState("复制失败，请展开后手动复制"); }
  };
  return <article className="tw-resource">
    <div className="tw-resource__row">
      <span className="tw-resource__icon" title={label}>{format === "information" ? "≡" : format === "link" ? "↗" : "▤"}</span>
      <button className="tw-resource__title" title={resource.title} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{resource.title}</button>
      {href && <a href={href} target="_blank" rel="noreferrer" aria-label={`打开 ${resource.title}`} title={isLocalResource(resource.location) ? "打开本地位置" : "打开链接"}>↗</a>}
      <button className="tw-resource__action" onClick={() => void copy()} aria-label={`复制 ${resource.title}`} title={copyState || (resource.content ? "复制信息" : "复制地址")}>{copyState === "已复制" ? "✓" : "⧉"}</button>
      <button className="tw-resource__action" aria-label={`${expanded ? "收起" : "展开"} ${resource.title}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "⌃" : "⌄"}</button>
    </div>
    {copyState && <span className="tw-resource__feedback" role="status">{copyState}</span>}
    {expanded && <div className="tw-resource__details"><small>{label} · {resource.version}</small>{resource.summary && <p>{resource.summary}</p>}{resource.content && <p>{resource.content}</p>}{resource.location && <code>{resource.location}</code>}</div>}
  </article>;
}
