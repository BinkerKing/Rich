import { useEffect, useState, type ReactNode } from "react";
import { api, type MulticaComment, type MulticaIssueDetailSnapshot, type MulticaTeamSnapshot, type MulticaTimelineEntry } from "../../../api/client.js";
import { MulticaIssueSidebar } from "./MulticaIssueSidebar.js";
import { MulticaTimeline } from "./MulticaTimeline.js";

export function MulticaIssueDetail({ projectId, issueId, team, onClose, onBoardChanged }: {
  projectId: string;
  issueId: string;
  team: MulticaTeamSnapshot | null;
  onClose: () => void;
  onBoardChanged: () => Promise<void>;
}): ReactNode {
  const [detail, setDetail] = useState<MulticaIssueDetailSnapshot>();
  const [timeline, setTimeline] = useState<MulticaTimelineEntry[]>([]);
  const [comments, setComments] = useState<MulticaComment[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();

  async function load(signal?: AbortSignal): Promise<void> {
    const next = await api.getMulticaIssue(projectId, issueId);
    if (signal?.aborted) return;
    setDetail(next);
    setTitle(next.issue.title);
    setDescription(next.issue.description ?? "");
    const [activity, discussion] = await Promise.all([
      api.getMulticaTimeline(projectId, issueId),
      api.getMulticaComments(projectId, issueId),
    ]);
    if (signal?.aborted) return;
    setTimeline(activity);
    setComments(discussion);
  }

  useEffect(() => {
    const controller = new AbortController();
    setDetail(undefined);
    setError(undefined);
    void load(controller.signal).catch(value => { if (!controller.signal.aborted) setError(value instanceof Error ? value.message : String(value)); });
    return () => controller.abort();
  }, [issueId, projectId]);

  async function refresh(): Promise<void> {
    await Promise.all([load(), onBoardChanged()]);
  }

  async function save(patch: Record<string, unknown>): Promise<void> {
    await api.updateMulticaIssue(projectId, issueId, patch);
    await refresh();
  }

  if (error) return <aside className="multica-issue-detail multica-issue-detail--error"><p>{error}</p><button type="button" onClick={() => void load().catch(value => setError(String(value)))}>重试</button><button type="button" onClick={onClose}>关闭</button></aside>;
  if (!detail) return <aside className="multica-issue-detail multica-issue-detail--loading">正在从 Multica 加载任务详情…</aside>;
  const issue = detail.issue;
  return <aside className="multica-issue-detail">
    <header className="multica-issue-detail__top"><span>{issue.identifier ?? issue.id}</span><button type="button" onClick={onClose} aria-label="关闭任务详情">×</button></header>
    <div className="multica-issue-detail__layout">
      <main>
        <input className="multica-issue-detail__title" value={title} onChange={event => setTitle(event.target.value)} onBlur={() => { if (title.trim() && title !== issue.title) void save({ title: title.trim() }); }} aria-label="任务标题" />
        <section className="multica-issue-detail__description"><h3>描述</h3><textarea value={description} onChange={event => setDescription(event.target.value)} onBlur={() => { if (description !== (issue.description ?? "")) void save({ description }); }} placeholder="添加描述…" /></section>
        <section className="multica-subissues"><header><h3>子任务</h3><span>{detail.children.length}</span></header>{detail.children.length ? detail.children.map(child => <article key={child.id}><i className={`status-${child.status}`} /><span>{child.identifier ?? child.id.slice(0, 8)}</span><strong>{child.title}</strong><em>{child.status}</em></article>) : <p className="multica-empty-copy">暂无子任务</p>}</section>
        <MulticaTimeline projectId={projectId} issueId={issueId} timeline={timeline} comments={comments} onChanged={refresh} />
      </main>
      <MulticaIssueSidebar projectId={projectId} issue={issue} team={team} attachments={detail.attachments} onChanged={refresh} />
    </div>
  </aside>;
}
