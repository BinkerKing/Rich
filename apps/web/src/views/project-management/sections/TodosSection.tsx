import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Element } from "@ke/domain";
import { api, type ProjectManagementSummary, type ProjectModuleItem } from "../../../api/client.js";
import { recordValue, textValue } from "../ProjectManagementModules.js";
import { normalizeBoardStatus, type TodoBoardStatus } from "./TodoBoardModel.js";

type TaskComment = { id: string; body: string; author: string; createdAt: string };

const LANES: Array<{ id: TodoBoardStatus; title: string; accent: string }> = [
  { id: "planned", title: "待规划", accent: "#a9b0bd" },
  { id: "todo", title: "待办", accent: "#8aa8db" },
  { id: "doing", title: "进行中", accent: "#f7af51" },
  { id: "review", title: "审核中", accent: "#54cf83" },
  { id: "done", title: "已完成", accent: "#4b8bff" },
];

export function TodosSection({ project }: { project: Element; summary: ProjectManagementSummary | null }): ReactNode {
  const [todos, setTodos] = useState<ProjectModuleItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draggedId, setDraggedId] = useState("");
  const [dropLane, setDropLane] = useState<TodoBoardStatus | "">("");
  const [commentDraft, setCommentDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => setTodos(await api.listProjectManagementModuleItems(project.id, "todos"));
  useEffect(() => { void reload().catch(showError); }, [project.id]);
  useEffect(() => {
    if (!selectedId || !todos.some(todo => todo.id === selectedId)) setSelectedId(todos[0]?.id ?? "");
  }, [selectedId, todos]);

  const selected = todos.find(todo => todo.id === selectedId) ?? null;
  const total = todos.length;
  const running = todos.filter(todo => normalizeBoardStatus(recordValue(todo.content.original)) === "doing").length;

  function showError(value: unknown): void { setError(value instanceof Error ? value.message : String(value)); }

  async function createTask(status: TodoBoardStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const original = { title: "新任务", status, priority: "普通", comments: [] };
      const created = await api.createProjectManagementModuleItem(project.id, "todos", { title: original.title, subtitle: status, sortOrder: todos.length, content: { original } });
      setTodos(current => [...current, created]);
      setSelectedId(created.id);
    } catch (value) { showError(value); } finally { setBusy(false); }
  }

  async function saveTask(todo: ProjectModuleItem, original: Record<string, unknown>): Promise<void> {
    const title = textValue(original, "title").trim() || "未命名任务";
    const status = normalizeBoardStatus(original);
    const updated = { ...todo, title, subtitle: [status, textValue(original, "owner")].filter(Boolean).join(" · "), content: { ...todo.content, original: { ...original, title, status } } };
    setTodos(current => current.map(item => item.id === todo.id ? updated : item));
    try {
      await api.updateProjectManagementModuleItem(project.id, todo.id, { title: updated.title, subtitle: updated.subtitle, content: updated.content });
    } catch (value) { showError(value); await reload(); }
  }

  async function moveTask(todoId: string, status: TodoBoardStatus): Promise<void> {
    const task = todos.find(todo => todo.id === todoId);
    if (!task) return;
    const original = { ...recordValue(task.content.original), status };
    setDraggedId("");
    setDropLane("");
    await saveTask(task, original);
    try {
      const reordered = todos.filter(todo => todo.id !== todoId).concat({ ...task, content: { ...task.content, original } });
      await api.reorderProjectManagementModuleItems(project.id, "todos", reordered.map(todo => todo.id));
    } catch (value) { showError(value); await reload(); }
  }

  async function addComment(): Promise<void> {
    if (!selected || !commentDraft.trim()) return;
    const original = recordValue(selected.content.original);
    const next = [...commentsOf(original), { id: crypto.randomUUID(), body: commentDraft.trim(), author: "Rich 用户", createdAt: new Date().toISOString() }];
    setCommentDraft("");
    await saveTask(selected, { ...original, comments: next });
  }

  const laneTasks = useMemo(() => new Map(LANES.map(lane => [lane.id, todos.filter(todo => normalizeBoardStatus(recordValue(todo.content.original)) === lane.id)])), [todos]);

  return <section className="multica-board" aria-label="项目任务看板">
    {error && <div className="prj-pm-error">{error}</div>}
    <header className="multica-board__toolbar"><div><p>PROJECT TASKS</p><h2>项目任务</h2><span>本地预览 · 连接 Multica 后，状态、评论和执行进度将实时同步。</span></div><div className="multica-board__controls"><span className="multica-board__agent"><i />{running} 个智能体工作中</span><button type="button">⌕ 筛选</button><button type="button">☷ 显示</button><button type="button" className="is-active">▥ 看板</button></div></header>
    <div className="multica-board__workspace"><div className="multica-board__lanes">
      {LANES.map(lane => {
        const tasks = laneTasks.get(lane.id) ?? [];
        return <section key={lane.id} className={`multica-lane${dropLane === lane.id ? " is-drop-target" : ""}`} style={{ "--lane-accent": lane.accent } as CSSProperties} onDragOver={event => { event.preventDefault(); setDropLane(lane.id); }} onDragLeave={event => { if (event.currentTarget === event.target) setDropLane(""); }} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || draggedId; if (id) void moveTask(id, lane.id); }}>
          <header className="multica-lane__head"><div><i /><strong>{lane.title}</strong><span>{tasks.length}</span></div><div><button type="button" aria-label={`${lane.title}更多操作`}>…</button><button type="button" aria-label={`在${lane.title}新建任务`} disabled={busy} onClick={() => void createTask(lane.id)}>＋</button></div></header>
          <div className="multica-lane__tasks">{tasks.length === 0 ? <div className="multica-lane__empty"><b>▢</b><span>暂无任务</span><button type="button" disabled={busy} onClick={() => void createTask(lane.id)}>点击＋创建任务</button></div> : tasks.map(task => <TaskCard key={task.id} task={task} selected={task.id === selectedId} dragging={task.id === draggedId} onSelect={() => setSelectedId(task.id)} onDragStart={event => { setDraggedId(task.id); event.dataTransfer.setData("text/plain", task.id); }} onDragEnd={() => { setDraggedId(""); setDropLane(""); }} />)}</div>
        </section>;
      })}
    </div><TaskDetail task={selected} onSave={saveTask} commentDraft={commentDraft} onCommentDraft={setCommentDraft} onAddComment={() => void addComment()} /></div>
    <footer className="multica-board__footer"><span>{total} 个任务</span><span>任务执行仍由 Multica Runtime 负责</span></footer>
  </section>;
}

function TaskCard({ task, selected, dragging, onSelect, onDragStart, onDragEnd }: { task: ProjectModuleItem; selected: boolean; dragging: boolean; onSelect: () => void; onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void; onDragEnd: () => void }): ReactNode {
  const original = recordValue(task.content.original);
  return <article className={`multica-task-card${selected ? " is-selected" : ""}${dragging ? " is-dragging" : ""}`} onClick={onSelect}><div className="multica-task-card__id"><span>{task.id.slice(-8).toUpperCase()}</span><button type="button" draggable aria-label="拖拽任务" onDragStart={onDragStart} onDragEnd={onDragEnd}>⠿</button></div><h3>{textValue(original, "title") || task.title || "未命名任务"}</h3>{textValue(original, "description") && <p>{textValue(original, "description")}</p>}<div className="multica-task-card__foot"><em>{textValue(original, "priority") || "普通"}</em><span>{textValue(original, "owner") || "未分配"}</span></div></article>;
}

function TaskDetail({ task, onSave, commentDraft, onCommentDraft, onAddComment }: { task: ProjectModuleItem | null; onSave: (task: ProjectModuleItem, original: Record<string, unknown>) => Promise<void>; commentDraft: string; onCommentDraft: (value: string) => void; onAddComment: () => void }): ReactNode {
  if (!task) return <aside className="multica-detail multica-detail--empty">选择一张任务卡片以查看详情</aside>;
  const original = recordValue(task.content.original);
  const comments = commentsOf(original);
  const update = (patch: Record<string, unknown>) => void onSave(task, { ...original, ...patch });
  return <aside className="multica-detail"><header><span>{task.id.slice(-8).toUpperCase()}</span><button type="button" aria-label="关闭详情">×</button></header><textarea className="multica-detail__title" value={textValue(original, "title") || task.title} onChange={event => update({ title: event.target.value })} aria-label="任务标题" />
    <dl className="multica-detail__fields"><div><dt>状态</dt><dd><select value={normalizeBoardStatus(original)} onChange={event => update({ status: event.target.value })}>{LANES.map(lane => <option key={lane.id} value={lane.id}>{lane.title}</option>)}</select></dd></div><div><dt>优先级</dt><dd><select value={textValue(original, "priority") || "普通"} onChange={event => update({ priority: event.target.value })}><option>低</option><option>普通</option><option>高</option></select></dd></div><div><dt>负责人</dt><dd><input value={textValue(original, "owner")} placeholder="未分配" onChange={event => update({ owner: event.target.value })} /></dd></div><div><dt>截止日期</dt><dd><input value={textValue(original, "dueAt")} placeholder="YYYY-MM-DD" onChange={event => update({ dueAt: event.target.value })} /></dd></div></dl>
    <section className="multica-detail__description"><h4>描述</h4><textarea value={textValue(original, "description")} placeholder="补充任务说明…" onChange={event => update({ description: event.target.value })} /></section>
    <section className="multica-detail__activity"><header><strong>活动</strong><span>评论 {comments.length}</span></header>{comments.length ? comments.map(comment => <article key={comment.id}><b>{comment.author}</b><p>{comment.body}</p><small>{formatTime(comment.createdAt)}</small></article>) : <p>暂无评论</p>}</section>
    <div className="multica-detail__composer"><textarea value={commentDraft} placeholder="写下评论…" onChange={event => onCommentDraft(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onAddComment(); }} /><button type="button" onClick={onAddComment} disabled={!commentDraft.trim()}>发送</button></div>
  </aside>;
}

function commentsOf(original: Record<string, unknown>): TaskComment[] { return Array.isArray(original.comments) ? original.comments.flatMap(value => { const item = recordValue(value); const body = textValue(item, "body"); return body ? [{ id: textValue(item, "id") || body, body, author: textValue(item, "author") || "Rich 用户", createdAt: textValue(item, "createdAt") }] : []; }) : []; }
function formatTime(value: string): string { return value ? new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "刚刚"; }
