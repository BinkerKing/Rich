import { useMemo, useState, type ReactNode } from "react";
import { api, type MulticaComment, type MulticaTimelineEntry } from "../../../api/client.js";

type TimelineItem =
  | { kind: "comment"; at: string; value: MulticaComment }
  | { kind: "activity"; at: string; value: MulticaTimelineEntry };

export function MulticaTimeline({ projectId, issueId, timeline, comments, onChanged }: {
  projectId: string;
  issueId: string;
  timeline: MulticaTimelineEntry[];
  comments: MulticaComment[];
  onChanged: () => Promise<void>;
}): ReactNode {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string>();
  const [busy, setBusy] = useState(false);
  const items = useMemo<TimelineItem[]>(() => [
    ...timeline.map(value => ({ kind: "activity" as const, at: value.created_at ?? "", value })),
    ...comments.map(value => ({ kind: "comment" as const, at: value.created_at ?? "", value })),
  ].sort((left, right) => left.at.localeCompare(right.at)), [comments, timeline]);

  async function submit(): Promise<void> {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      await api.addMulticaComment(projectId, issueId, draft.trim(), replyTo);
      setDraft("");
      setReplyTo(undefined);
      await onChanged();
    } finally { setBusy(false); }
  }

  async function resolve(comment: MulticaComment): Promise<void> {
    await api.resolveMulticaComment(projectId, issueId, comment.id, !comment.resolved);
    await onChanged();
  }

  return <section className="multica-timeline">
    <header><h3>活动</h3><span>{items.length}</span></header>
    <div className="multica-timeline__stream">{items.length === 0 ? <p className="multica-empty-copy">暂无活动</p> : items.map(item => item.kind === "comment"
      ? <article className="multica-comment" key={`comment-${item.value.id}`}><header><strong>{item.value.author?.name ?? "Multica 用户"}</strong><time>{formatTime(item.at)}</time></header><p>{item.value.body ?? item.value.content ?? ""}</p>{item.value.attachments?.length ? <div className="multica-attachments-inline">{item.value.attachments.map(file => <span key={file.id}>⌕ {file.name}</span>)}</div> : null}<footer><button type="button" onClick={() => setReplyTo(item.value.id)}>回复</button><button type="button" onClick={() => void resolve(item.value)}>{item.value.resolved ? "重新打开" : "解决"}</button></footer></article>
      : <article className="multica-activity" key={`activity-${item.value.id}`}><i /><div><strong>{activityTitle(item.value)}</strong><p>{activityBody(item.value)}</p><time>{formatTime(item.at)}</time></div></article>)}</div>
    <div className="multica-comment-composer">{replyTo && <div>正在回复 {replyTo.slice(0, 8)} <button type="button" onClick={() => setReplyTo(undefined)}>取消</button></div>}<textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="写下评论…" onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void submit(); }} /><footer><span>⌘↵ 发送</span><button type="button" disabled={!draft.trim() || busy} onClick={() => void submit()}>发送</button></footer></div>
  </section>;
}

function activityTitle(entry: MulticaTimelineEntry): string {
  const labels: Record<string, string> = { created: "创建了任务", status_changed: "更新了状态", priority_changed: "更新了优先级", assignee_changed: "更新了负责人", task_completed: "Agent 完成了任务", task_failed: "Agent 执行失败", squad_leader_evaluated: "Squad Leader 完成评估" };
  return labels[entry.type] ?? entry.type;
}

function activityBody(entry: MulticaTimelineEntry): string {
  if (!entry.data) return entry.actor?.name ?? "";
  return Object.entries(entry.data).map(([key, value]) => `${key}: ${formatValue(value)}`).join(" · ");
}

function formatValue(value: unknown): string { return typeof value === "string" ? value : JSON.stringify(value); }
function formatTime(value: string): string { return value ? new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "刚刚"; }
