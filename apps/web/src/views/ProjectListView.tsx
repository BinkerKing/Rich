import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { Element, ProjectContent } from "@ke/domain";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import { formatShortcut, shortcutFromEvent } from "../lib/shortcutEngine.js";

interface Props { onPick: (id: string) => void }

/** 项目卡片墙。复用 store 里的 elements（实时同步），过滤逻辑：
 *  1. type === "project"
 *  2. tags 含 "project-language" (跟用户原有数据一致)
 *  3. 不是其他 project 的子元（防止把"任务看板""风险"这种 category 节点当成项目列出来）
 */
const PROJECT_TAG = "project-management";
const PROJECT_GROUP_TAG = "project-management-group";
type ProjectPartition = { id: string; title: string; projects: Element[]; groupId?: string; legacy?: boolean; ungrouped?: boolean; sortOrder: number };

export function ProjectListView({ onPick }: Props): ReactNode {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProjectGroupId, setNewProjectGroupId] = useState("");
  const [creatingPartition, setCreatingPartition] = useState(false);
  const [newPartitionTitle, setNewPartitionTitle] = useState("");
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [projectMenu, setProjectMenu] = useState<{ project: Element; x: number; y: number } | null>(null);
  const [shortcutProject, setShortcutProject] = useState<Element | null>(null);
  const [shortcutDraft, setShortcutDraft] = useState("");
  const [shortcutError, setShortcutError] = useState("");
  const projectMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!projectMenu) return;
    const close = (event: PointerEvent) => {
      if (projectMenuRef.current?.contains(event.target as Node)) return;
      setProjectMenu(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [projectMenu]);

  // 已是别人 child 的 element id 集合 —— 排除二级节点（任务看板 / 风险 / 会议 等）
  const childIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const r of relations) {
      if (r.kind === "child") set.add(r.to);
    }
    return set;
  }, [relations]);

  const projects = Array.from(elements.values())
    .filter(e => e.type === "project")
    .filter(e => (e.tags ?? []).includes(PROJECT_TAG))
    .filter(e => !childIdSet.has(e.id))                    // 只留根项目
    .sort((a, b) => (b.metadata.updatedAt ?? "").localeCompare(a.metadata.updatedAt ?? ""));

  const projectGroups = useMemo<ProjectPartition[]>(() => {
    const partitions: ProjectPartition[] = Array.from(elements.values())
      .filter(element => element.type === "group" && (element.tags ?? []).includes(PROJECT_GROUP_TAG) && !childIdSet.has(element.id))
      .sort((left, right) => Number((left.content as { sortOrder?: number }).sortOrder ?? 0) - Number((right.content as { sortOrder?: number }).sortOrder ?? 0))
      .map((element, index): ProjectPartition => ({ id: element.id, groupId: element.id, title: element.title, projects: [], sortOrder: Number((element.content as { sortOrder?: number }).sortOrder ?? index) }));
    const byId = new Map(partitions.map(partition => [partition.id, partition]));
    const legacy = new Map<string, ProjectPartition>();
    const ungrouped: ProjectPartition = { id: "ungrouped", title: "未分组", projects: [], ungrouped: true, sortOrder: Number.MAX_SAFE_INTEGER };
    for (const project of projects) {
      const content = (project.content ?? {}) as ProjectContent;
      let partition = content.groupId ? byId.get(content.groupId) : undefined;
      if (!partition && content.group?.trim()) {
        const title = content.group.trim();
        partition = legacy.get(title);
        if (!partition) {
          partition = { id: `legacy:${title}`, title, projects: [], legacy: true, sortOrder: partitions.length + legacy.size };
          legacy.set(title, partition);
        }
      }
      (partition ?? ungrouped).projects.push(project);
    }
    for (const partition of [...partitions, ...legacy.values(), ungrouped]) {
      partition.projects.sort((left, right) => {
        const leftPosition = Number(((left.content ?? {}) as ProjectContent).groupPosition ?? Number.MAX_SAFE_INTEGER);
        const rightPosition = Number(((right.content ?? {}) as ProjectContent).groupPosition ?? Number.MAX_SAFE_INTEGER);
        return leftPosition - rightPosition || (right.metadata.updatedAt ?? "").localeCompare(left.metadata.updatedAt ?? "");
      });
    }
    return [...partitions, ...Array.from(legacy.values()).sort((left, right) => left.title.localeCompare(right.title, "zh-CN")), ungrouped]
      .filter(partition => !partition.ungrouped || partition.projects.length > 0);
  }, [childIdSet, elements, projects]);

  /** 统计某个 project 的子元数量 */
  const statsOf = (projectId: string) => {
    const directChildIds = relations
      .filter(r => r.kind === "child" && r.from === projectId)
      .map(r => r.to);
    const direct = directChildIds
      .map(id => elements.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e);
    const envs = direct.filter(c => c.type === "deployment-env").length;
    const repos = direct.filter(c => c.type === "repo").length;
    const todos = direct.filter(c => c.type === "dev-task");
    const todosDone = todos.filter(t => t.status === "done").length;
    const releases = direct.filter(c => c.type === "version-release").length;
    const faqs = direct.filter(c => c.type === "faq").length;
    const reports = direct.filter(c => c.type === "report").length;
    return { envs, repos, todos: todos.length, todosDone, releases, faqs, reports };
  };

  async function createProject(): Promise<void> {
    const t = newTitle.trim();
    if (!t) return;
    try {
      const r = await api.createElement({
        title: t,
        type: "project",
        content: projectGroups.find(group => group.groupId === newProjectGroupId)
          ? { groupId: newProjectGroupId, group: projectGroups.find(group => group.groupId === newProjectGroupId)?.title, groupPosition: Number.MAX_SAFE_INTEGER } satisfies ProjectContent
          : undefined,
      });
      // 加 tag 区分（createElement 不带 tag，单独 patch）
      await api.patchElement(r.element.id, { tags: [PROJECT_TAG] });
      setNewTitle("");
      setNewProjectGroupId("");
      setCreating(false);
      await hydrate();
      onPick(r.element.id);
    } catch (e) {
      window.alert(`创建失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function createPartition(): Promise<void> {
    const title = newPartitionTitle.trim();
    if (!title) return;
    try {
      const order = projectGroups.filter(group => group.groupId).length;
      await api.createElement({ title, type: "group", tags: [PROJECT_GROUP_TAG], content: { sortOrder: order } });
      setNewPartitionTitle("");
      setCreatingPartition(false);
      await hydrate();
    } catch (error) {
      window.alert(`新建分区失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function moveProject(projectId: string, target: ProjectPartition, targetIndex: number): Promise<void> {
    const project = projects.find(item => item.id === projectId);
    if (!project) return;
    const next = target.projects.filter(item => item.id !== projectId);
    next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, project);
    try {
      await Promise.all(next.map((item, index) => {
        const content = (item.content ?? {}) as ProjectContent;
        return api.patchElement(item.id, {
          content: {
            ...content,
            groupId: target.groupId,
            group: target.ungrouped ? undefined : target.title,
            groupPosition: index,
          } satisfies ProjectContent,
        });
      }));
      await hydrate();
    } catch (error) {
      window.alert(`调整项目位置失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDraggingProjectId(null);
    }
  }

  function dropOn(event: DragEvent<HTMLElement>, target: ProjectPartition, index: number) {
    event.preventDefault();
    const projectId = event.dataTransfer.getData("text/plain") || draggingProjectId;
    if (projectId) void moveProject(projectId, target, index);
  }

  function openShortcutDialog(project: Element) {
    setProjectMenu(null);
    setShortcutProject(project);
    setShortcutDraft(((project.content ?? {}) as ProjectContent).shortcut ?? "");
    setShortcutError("");
  }

  async function saveShortcut() {
    if (!shortcutProject) return;
    try {
      const content = (shortcutProject.content ?? {}) as ProjectContent;
      await api.patchElement(shortcutProject.id, { content: { ...content, shortcut: shortcutDraft || undefined } satisfies ProjectContent });
      await hydrate();
      setShortcutProject(null);
    } catch (error) {
      setShortcutError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="prj">
      <header className="prj__head">
        <div>
          <h1 className="prj__title">项目管理</h1>
          <p className="prj__sub">{projects.length} 个项目 · 部署 / 代码 / 待办 / 答疑 / 文件夹 / 日报周报</p>
        </div>
        <div style={{ flex: 1 }} />
        <button className="prj__partition-btn" onClick={() => setCreatingPartition(true)}>+ 新建分区</button>
        <button className="prj__create-btn" onClick={() => setCreating(true)}>+ 新项目</button>
      </header>

      {creatingPartition && (
        <div className="prj__create-bar">
          <input className="prj__create-input" autoFocus placeholder="分区名称（例如：二代 SAFE / 内部工具）"
            value={newPartitionTitle} onChange={event => setNewPartitionTitle(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter") void createPartition(); if (event.key === "Escape") { setCreatingPartition(false); setNewPartitionTitle(""); } }} />
          <button className="prj__btn-primary" onClick={() => void createPartition()} disabled={!newPartitionTitle.trim()}>创建分区</button>
          <button className="prj__btn-link" onClick={() => { setCreatingPartition(false); setNewPartitionTitle(""); }}>取消</button>
        </div>
      )}

      {creating && (
        <div className="prj__create-bar">
          <input className="prj__create-input" autoFocus
            placeholder="项目名称（例：客户 A 商城 / Rich 自己 / 公司内部 OA）"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") void createProject();
              if (e.key === "Escape") { setCreating(false); setNewTitle(""); setNewProjectGroupId(""); }
            }} />
          <select className="prj__create-group-input" value={newProjectGroupId} onChange={event => setNewProjectGroupId(event.target.value)}>
            <option value="">未分组</option>
            {projectGroups.filter(group => group.groupId).map(group => <option key={group.groupId} value={group.groupId}>{group.title}</option>)}
          </select>
          <button className="prj__btn-primary" onClick={() => void createProject()} disabled={!newTitle.trim()}>
            创建
          </button>
          <button className="prj__btn-link" onClick={() => { setCreating(false); setNewTitle(""); setNewProjectGroupId(""); }}>取消</button>
        </div>
      )}

      <div className="prj__groups">
        {projectGroups.map(group => (
          <section className={`prj__group${draggingProjectId ? " is-drop-target" : ""}`} key={group.id}
            onDragOver={event => event.preventDefault()} onDrop={event => dropOn(event, group, group.projects.length)}>
            <header className="prj__group-head">
              <h2>{group.title}</h2>
              <span>{group.projects.length} 个项目</span>
            </header>
            <div className="prj__grid">
        {group.projects.map((p, index) => {
          const c = (p.content ?? {}) as ProjectContent;
          const s = statsOf(p.id);
          const statusDot = c.status === "archived" ? "is-archived"
                          : c.status === "paused" ? "is-paused"
                          : "is-active";
          const todoPct = s.todos === 0 ? 0 : Math.round((s.todosDone / s.todos) * 100);
          return (
            <button key={p.id} className={`prj-card${draggingProjectId === p.id ? " is-dragging" : ""}`} draggable
              onDragStart={event => { setDraggingProjectId(p.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", p.id); }}
              onDragEnd={() => setDraggingProjectId(null)} onDragOver={event => event.preventDefault()}
              onDrop={event => dropOn(event, group, index)} onClick={() => onPick(p.id)}
              onContextMenu={event => { event.preventDefault(); setProjectMenu({ project: p, x: event.clientX, y: event.clientY }); }}>
              <div className="prj-card__head">
                <span className={`prj-card__dot ${statusDot}`} />
                <span className="prj-card__name">{p.title}</span>
                {c.owner && <span className="prj-card__owner">{c.owner}</span>}
              </div>
              {c.description && <div className="prj-card__desc">{c.description}</div>}
              {!c.description && p.subtitle && <div className="prj-card__desc">{p.subtitle}</div>}
              <div className="prj-card__stats">
                <span className="prj-card__stat" title="部署环境">🚀 {s.envs}</span>
                <span className="prj-card__stat" title="代码仓库">🌿 {s.repos}</span>
                <span className="prj-card__stat" title="待办">✅ {s.todosDone}/{s.todos}</span>
                <span className="prj-card__stat" title="发布版本">📦 {s.releases}</span>
                <span className="prj-card__stat" title="业务答疑">💬 {s.faqs}</span>
                <span className="prj-card__stat" title="报告">📰 {s.reports}</span>
              </div>
              {s.todos > 0 && (
                <div className="prj-card__bar">
                  <span style={{ width: `${todoPct}%` }} />
                </div>
              )}
            </button>
          );
        })}
            </div>
          </section>
        ))}
        {projects.length === 0 && !creating && (
          <div className="prj__empty">
            还没有项目。点 <b>+ 新项目</b> 建一个，或让 Hermes 帮你建。
          </div>
        )}
      </div>
      {projectMenu && <div ref={projectMenuRef} className="prj-context-menu" style={{ left: projectMenu.x, top: projectMenu.y }} onClick={event => event.stopPropagation()}>
        <button type="button" onClick={() => openShortcutDialog(projectMenu.project)}>设置快速打开快捷键 <kbd>{formatShortcut(((projectMenu.project.content ?? {}) as ProjectContent).shortcut)}</kbd></button>
      </div>}
      {shortcutProject && <div className="prj-shortcut-overlay" role="dialog" aria-modal="true" aria-label="设置项目快捷键" onMouseDown={() => setShortcutProject(null)}>
        <div className="prj-shortcut-dialog" onMouseDown={event => event.stopPropagation()}>
          <h2>设置快速打开快捷键</h2>
          <p>{shortcutProject.title}</p>
          <button type="button" className="prj-shortcut-capture" autoFocus onKeyDown={event => {
            event.preventDefault();
            const shortcut = shortcutFromEvent(event.nativeEvent);
            if (!shortcut) { setShortcutError("请按带 ⌘/Ctrl 的组合键；⌘+数字和系统快捷键不可用。"); return; }
            setShortcutDraft(shortcut);
            setShortcutError("");
          }}>{shortcutDraft ? formatShortcut(shortcutDraft) : "请按下组合键"}</button>
          <small>仅在 Rich 窗口内生效。按清除可取消当前快捷键。</small>
          {shortcutError && <div className="prj-shortcut-error">{shortcutError}</div>}
          <div className="prj-shortcut-actions">
            <button type="button" className="prj-btn-link" onClick={() => setShortcutProject(null)}>取消</button>
            <button type="button" className="prj-btn-link" onClick={() => { setShortcutDraft(""); setShortcutError(""); }}>清除</button>
            <button type="button" className="prj-btn-primary" onClick={() => void saveShortcut()}>保存</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
