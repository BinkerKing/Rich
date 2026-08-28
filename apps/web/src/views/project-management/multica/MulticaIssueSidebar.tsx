import { useState, type ReactNode } from "react";
import { api, type MulticaActor, type MulticaAttachment, type MulticaIssue, type MulticaLabel, type MulticaPullRequest, type MulticaTeamSnapshot, type MulticaUsage } from "../../../api/client.js";
import { MulticaExecutionLog } from "./MulticaExecutionLog.js";

export function MulticaIssueSidebar({ projectId, issue, team, attachments, onChanged }: {
  projectId: string;
  issue: MulticaIssue;
  team: MulticaTeamSnapshot | null;
  attachments: MulticaAttachment[];
  onChanged: () => Promise<void>;
}): ReactNode {
  const [open, setOpen] = useState<Record<string, boolean>>({ properties: true, details: true });
  const [pullRequests, setPullRequests] = useState<MulticaPullRequest[]>();
  const [usage, setUsage] = useState<MulticaUsage>();
  const [metadata, setMetadata] = useState<Record<string, unknown>>();
  const [properties, setProperties] = useState<Array<Record<string, unknown>>>();
  const [labels, setLabels] = useState<MulticaLabel[]>();
  const [subscribers, setSubscribers] = useState<MulticaActor[]>();

  async function toggle(key: string): Promise<void> {
    const next = !open[key];
    setOpen(current => ({ ...current, [key]: next }));
    if (!next) return;
    if (key === "pullRequests" && !pullRequests) setPullRequests(await api.getMulticaPullRequests(projectId, issue.id));
    if (key === "usage" && !usage) setUsage(await api.getMulticaUsage(projectId, issue.id));
    if (key === "metadata" && !metadata) setMetadata(await api.getMulticaMetadata(projectId, issue.id));
    if (key === "properties" && !properties) setProperties(await api.getMulticaProperties(projectId, issue.id));
    if (key === "labels" && !labels) setLabels(await api.getMulticaLabels(projectId, issue.id));
    if (key === "subscribers" && !subscribers) setSubscribers(await api.getMulticaSubscribers(projectId, issue.id));
  }

  async function assign(assigneeId: string): Promise<void> {
    await api.assignMulticaIssue(projectId, issue.id, assigneeId || null);
    await onChanged();
  }

  async function rerun(): Promise<void> {
    await api.rerunMulticaIssue(projectId, issue.id);
    setOpen(current => ({ ...current, execution: true }));
  }

  async function editProperty(value: Record<string, unknown>): Promise<void> {
    const name = String(value.name ?? value.property_name ?? value.id ?? "");
    if (!name) return;
    const current = String(value.value ?? "");
    const next = window.prompt(`属性 ${name}`, current);
    if (next === null) return;
    await api.setMulticaProperty(projectId, issue.id, name, next || null);
    setProperties(await api.getMulticaProperties(projectId, issue.id));
  }

  async function editMetadata(key: string, current: unknown): Promise<void> {
    const next = window.prompt(`元数据 ${key}`, typeof current === "string" ? current : JSON.stringify(current));
    if (next === null) return;
    await api.setMulticaMetadata(projectId, issue.id, key, next || undefined);
    setMetadata(await api.getMulticaMetadata(projectId, issue.id));
  }

  async function addLabel(): Promise<void> {
    const labelId = window.prompt("输入 Multica Label UUID")?.trim();
    if (!labelId) return;
    await api.setMulticaLabel(projectId, issue.id, labelId, true);
    setLabels(await api.getMulticaLabels(projectId, issue.id));
  }

  async function addSubscriber(): Promise<void> {
    const actorId = window.prompt("输入 Multica 成员或 Agent UUID")?.trim();
    if (!actorId) return;
    await api.setMulticaSubscriber(projectId, issue.id, actorId, true);
    setSubscribers(await api.getMulticaSubscribers(projectId, issue.id));
  }

  return <aside className="multica-issue-sidebar">
    <section className="multica-sidebar-properties">
      <label><span>状态</span><select value={issue.status} onChange={event => void api.setMulticaIssueStatus(projectId, issue.id, event.target.value).then(onChanged)}>{["backlog", "todo", "in_progress", "in_review", "done", "blocked", "cancelled"].map(status => <option key={status}>{status}</option>)}</select></label>
      <label><span>优先级</span><select value={issue.priority ?? "none"} onChange={event => void api.updateMulticaIssue(projectId, issue.id, { priority: event.target.value }).then(onChanged)}>{["none", "low", "medium", "high", "urgent"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label><span>负责人</span><select value={issue.assignee_id ?? ""} onChange={event => void assign(event.target.value)}><option value="">未分配</option>{team && <option value={team.squad.id}>{team.squad.name}</option>}{team?.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
      <label><span>开始日期</span><input type="date" value={issue.start_date ?? ""} onChange={event => void api.updateMulticaIssue(projectId, issue.id, { startDate: event.target.value || null }).then(onChanged)} /></label>
      <label><span>截止日期</span><input type="date" value={issue.due_date ?? ""} onChange={event => void api.updateMulticaIssue(projectId, issue.id, { dueDate: event.target.value || null }).then(onChanged)} /></label>
    </section>
    <SidebarSection title="属性" sectionKey="properties" open={Boolean(open.properties)} onToggle={toggle}><div className="multica-sidebar-data">{(properties ?? []).map(value => <button type="button" key={String(value.id ?? value.name)} onClick={() => void editProperty(value)}><span>{String(value.name ?? value.id ?? "property")}</span><code>{String(value.value ?? "—")}</code></button>)}</div></SidebarSection>
    <SidebarSection title="标签" sectionKey="labels" open={Boolean(open.labels)} onToggle={toggle}><div className="multica-sidebar-pills">{(labels ?? []).map(label => <button type="button" key={label.id} title="点击移除" onClick={() => void api.setMulticaLabel(projectId, issue.id, label.id, false).then(() => api.getMulticaLabels(projectId, issue.id)).then(setLabels)}>{label.name} ×</button>)}<button type="button" onClick={() => void addLabel()}>＋</button></div></SidebarSection>
    <SidebarSection title="父任务" sectionKey="parent" open={Boolean(open.parent)} onToggle={toggle}><p>{issue.parent_id ?? "无"}</p></SidebarSection>
    <SidebarSection title={`附件 ${attachments.length}`} sectionKey="attachments" open={Boolean(open.attachments)} onToggle={toggle}>{attachments.length ? attachments.map(file => <a key={file.id} href={file.url ?? undefined} download={file.name}><span>⌕</span><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></a>) : <p>暂无附件</p>}</SidebarSection>
    <SidebarSection title="Pull Requests" sectionKey="pullRequests" open={Boolean(open.pullRequests)} onToggle={toggle}>{(pullRequests ?? []).map(pr => <a key={pr.id} href={pr.url ?? undefined} target="_blank" rel="noreferrer"><strong>{pr.title ?? `PR ${pr.number ?? pr.id}`}</strong><span>{pr.state ?? "unknown"}</span></a>)}</SidebarSection>
    <SidebarSection title="Execution Log" sectionKey="execution" open={Boolean(open.execution)} onToggle={toggle}><button type="button" className="multica-sidebar-action" onClick={() => void rerun()}>重新执行</button><MulticaExecutionLog projectId={projectId} issueId={issue.id} active={Boolean(open.execution)} /></SidebarSection>
    <SidebarSection title="元数据" sectionKey="metadata" open={Boolean(open.metadata)} onToggle={toggle}><div className="multica-sidebar-data">{Object.entries(metadata ?? {}).map(([key, value]) => <button type="button" key={key} onClick={() => void editMetadata(key, value)}><span>{key}</span><code>{typeof value === "string" ? value : JSON.stringify(value)}</code></button>)}</div></SidebarSection>
    <SidebarSection title="订阅者" sectionKey="subscribers" open={Boolean(open.subscribers)} onToggle={toggle}><div className="multica-sidebar-pills">{(subscribers ?? []).map(actor => <button type="button" key={actor.id} title="点击取消订阅" onClick={() => void api.setMulticaSubscriber(projectId, issue.id, actor.id, false).then(() => api.getMulticaSubscribers(projectId, issue.id)).then(setSubscribers)}>{actor.name ?? actor.id} ×</button>)}<button type="button" onClick={() => void addSubscriber()}>＋</button></div></SidebarSection>
    <SidebarSection title="详情" sectionKey="details" open={Boolean(open.details)} onToggle={toggle}><dl><div><dt>创建</dt><dd>{formatDate(issue.created_at)}</dd></div><div><dt>更新</dt><dd>{formatDate(issue.updated_at)}</dd></div><div><dt>ID</dt><dd><code>{issue.id}</code></dd></div></dl></SidebarSection>
    <SidebarSection title="Usage" sectionKey="usage" open={Boolean(open.usage)} onToggle={toggle}><dl><div><dt>输入</dt><dd>{usage?.input_tokens ?? 0}</dd></div><div><dt>输出</dt><dd>{usage?.output_tokens ?? 0}</dd></div><div><dt>总计</dt><dd>{usage?.total_tokens ?? 0}</dd></div><div><dt>费用</dt><dd>{formatUsageCost(usage)}</dd></div></dl></SidebarSection>
  </aside>;
}

function SidebarSection({ title, sectionKey, open, onToggle, children }: { title: string; sectionKey: string; open: boolean; onToggle: (key: string) => Promise<void>; children: ReactNode }): ReactNode {
  return <section className="multica-sidebar-section"><button type="button" onClick={() => void onToggle(sectionKey)}><span>{open ? "▾" : "▸"}</span><strong>{title}</strong></button>{open && <div>{children}</div>}</section>;
}

function formatDate(value?: string | null): string { return value ? new Date(value).toLocaleString("zh-CN") : "—"; }
function formatBytes(value?: number | null): string { if (!value) return ""; return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`; }
function formatUsageCost(usage?: MulticaUsage): string {
  if (typeof usage?.cost === "number") return String(usage.cost);
  return typeof usage?.cost_usd_ticks === "number" ? `${usage.cost_usd_ticks} ticks` : "—";
}
