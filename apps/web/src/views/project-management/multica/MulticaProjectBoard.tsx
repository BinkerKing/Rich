import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { api, type MulticaBoardSnapshot, type MulticaIssue, type MulticaTeamSnapshot } from "../../../api/client.js";
import { buildMulticaStatuses, groupMulticaIssues, planMulticaDrop } from "../sections/TodoBoardModel.js";
import { MULTICA_ATTRIBUTION } from "./MulticaBoardCard.js";
import { MulticaBoardColumn } from "./MulticaBoardColumn.js";
import { MulticaIssueDetail } from "./MulticaIssueDetail.js";
import { MulticaTeamPanel } from "./MulticaTeamPanel.js";
import "./MulticaProjectWorkbench.css";

export function MulticaProjectBoard({ projectId, projectTitle }: { projectId: string; projectTitle: string }): ReactNode {
  const [board, setBoard] = useState<MulticaBoardSnapshot>();
  const [team, setTeam] = useState<MulticaTeamSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [dragged, setDragged] = useState<MulticaIssue>();
  const [showTeam, setShowTeam] = useState(false);
  const [query, setQuery] = useState("");
  const [compact, setCompact] = useState(false);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      const [nextBoard, nextTeam] = await Promise.all([api.getMulticaBoard(projectId), api.getMulticaTeam(projectId)]);
      setBoard(nextBoard);
      setTeam(nextTeam);
      setError(undefined);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally { setRefreshing(false); }
  }, [projectId]);

  useEffect(() => {
    void refresh();
    let timer = window.setInterval(() => void refresh(), document.hidden ? 30_000 : 5_000);
    const visibilitychange = () => {
      window.clearInterval(timer);
      void refresh();
      timer = window.setInterval(() => void refresh(), document.hidden ? 30_000 : 5_000);
    };
    document.addEventListener("visibilitychange", visibilitychange);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visibilitychange); };
  }, [refresh]);

  const filtered = useMemo(() => board?.issues.filter(issue => !query.trim() || `${issue.identifier ?? ""} ${issue.title} ${issue.description ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [], [board?.issues, query]);
  const statuses = useMemo(() => buildMulticaStatuses(board?.statuses ?? [], board?.issues ?? []), [board]);
  const groups = useMemo(() => groupMulticaIssues(filtered), [filtered]);
  const activeAgents = board?.issues.filter(issue => issue.active_run || issue.run_status === "running").length ?? 0;

  async function createIssue(status: string): Promise<void> {
    const title = window.prompt("任务标题", "新任务")?.trim();
    if (!title) return;
    const issue = await api.createMulticaIssue(projectId, { title, status });
    await refresh();
    setSelectedId(issue.id);
  }

  async function drop(toStatus: string, target: { beforeId?: string; edge?: "bottom" }, event: DragEvent<HTMLElement>): Promise<void> {
    event.preventDefault();
    const issueId = event.dataTransfer.getData("text/plain") || dragged?.id;
    const source = board?.issues.find(issue => issue.id === issueId);
    if (!board || !source || target.beforeId === source.id) return;
    const previous = board;
    const commands = planMulticaDrop({ issueId: source.id, fromStatus: source.status, toStatus, ...target });
    setDragged(undefined);
    setBoard(optimisticMove(board, source.id, toStatus, target.beforeId));
    try {
      for (const command of commands) {
        if (command.kind === "status") await api.setMulticaIssueStatus(projectId, command.issueId, command.status);
        else await api.reorderMulticaIssue(projectId, command.issueId, { beforeId: command.beforeId, afterId: command.afterId, edge: command.edge });
      }
      await refresh();
    } catch (value) {
      setBoard(previous);
      setError(value instanceof Error ? value.message : String(value));
    }
  }

  if (!board) return <section className="multica-workbench multica-workbench--loading">{error ? <><p>{error}</p><button type="button" onClick={() => void refresh()}>重试</button></> : <p>正在连接 Multica…</p>}</section>;
  return <section className={`multica-workbench${compact ? " is-compact" : ""}`} aria-label="Multica 项目任务看板">
    <header className="multica-workbench__toolbar"><div><p>PROJECT TASKS</p><h2>项目任务</h2><span>{projectTitle} · Multica 是任务事实源 · {formatSync(board.syncedAt)}</span></div><div className="multica-workbench__controls"><span className="multica-workbench__agent"><i />{activeAgents} 个智能体工作中</span><label>⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="筛选" /></label><button type="button" className={compact ? "is-active" : ""} onClick={() => setCompact(value => !value)}>☷ 显示</button><button type="button" className={showTeam ? "is-active" : ""} onClick={() => setShowTeam(value => !value)}>♙ 小队</button><button type="button" onClick={() => void refresh()} disabled={refreshing}>↻</button></div></header>
    {error && <div className="multica-workbench__error"><span>{error}</span><button type="button" onClick={() => void refresh()}>重试</button></div>}
    <div className="multica-workbench__body"><div className="multica-workbench__columns">{statuses.map(status => <MulticaBoardColumn key={status.id} status={status as typeof board.statuses[number]} issues={groups.get(status.id) ?? []} selectedId={selectedId} onSelect={setSelectedId} onCreate={value => void createIssue(value)} onDragStart={(issue, event) => { setDragged(issue); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", issue.id); }} onDrop={(statusId, target, event) => void drop(statusId, target, event)} />)}</div>{showTeam && team && <MulticaTeamPanel team={team} onClose={() => setShowTeam(false)} />}{selectedId && <MulticaIssueDetail projectId={projectId} issueId={selectedId} team={team} onClose={() => setSelectedId("")} onBoardChanged={refresh} />}</div>
    <footer className="multica-workbench__footer"><span>{board.issues.length} 个任务</span><a href="https://github.com/multica-ai/multica" target="_blank" rel="noreferrer">{MULTICA_ATTRIBUTION}</a></footer>
  </section>;
}

function optimisticMove(board: MulticaBoardSnapshot, issueId: string, status: string, beforeId?: string): MulticaBoardSnapshot {
  const moving = board.issues.find(issue => issue.id === issueId);
  if (!moving) return board;
  const remaining = board.issues.filter(issue => issue.id !== issueId);
  const targetIndex = beforeId ? remaining.findIndex(issue => issue.id === beforeId) : -1;
  const next = { ...moving, status };
  if (targetIndex < 0) remaining.push(next);
  else remaining.splice(targetIndex, 0, next);
  return { ...board, issues: remaining };
}

function formatSync(value: string): string { return `同步于 ${new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`; }
