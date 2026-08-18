import { useMemo, useState, type ReactNode } from "react";
import type { ProjectContent } from "@ke/domain";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";

interface Props { onPick: (id: string) => void }

/** 项目卡片墙。复用 store 里的 elements（实时同步），过滤逻辑：
 *  1. type === "project"
 *  2. tags 含 "project-language" (跟用户原有数据一致)
 *  3. 不是其他 project 的子元（防止把"任务看板""风险"这种 category 节点当成项目列出来）
 */
const PROJECT_TAG = "project-management";

export function ProjectListView({ onPick }: Props): ReactNode {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

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
      const r = await api.createElement({ title: t, type: "project" });
      // 加 tag 区分（createElement 不带 tag，单独 patch）
      await api.patchElement(r.element.id, { tags: [PROJECT_TAG] });
      setNewTitle("");
      setCreating(false);
      await hydrate();
      onPick(r.element.id);
    } catch (e) {
      window.alert(`创建失败: ${e instanceof Error ? e.message : String(e)}`);
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
        <button className="prj__create-btn" onClick={() => setCreating(true)}>+ 新项目</button>
      </header>

      {creating && (
        <div className="prj__create-bar">
          <input className="prj__create-input" autoFocus
            placeholder="项目名称（例：客户 A 商城 / Rich 自己 / 公司内部 OA）"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") void createProject();
              if (e.key === "Escape") { setCreating(false); setNewTitle(""); }
            }} />
          <button className="prj__btn-primary" onClick={() => void createProject()} disabled={!newTitle.trim()}>
            创建
          </button>
          <button className="prj__btn-link" onClick={() => { setCreating(false); setNewTitle(""); }}>取消</button>
        </div>
      )}

      <div className="prj__grid">
        {projects.map(p => {
          const c = (p.content ?? {}) as ProjectContent;
          const s = statsOf(p.id);
          const statusDot = c.status === "archived" ? "is-archived"
                          : c.status === "paused" ? "is-paused"
                          : "is-active";
          const todoPct = s.todos === 0 ? 0 : Math.round((s.todosDone / s.todos) * 100);
          return (
            <button key={p.id} className="prj-card" onClick={() => onPick(p.id)}>
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
        {projects.length === 0 && !creating && (
          <div className="prj__empty">
            还没有项目。点 <b>+ 新项目</b> 建一个，或让 Hermes 帮你建。
          </div>
        )}
      </div>
    </div>
  );
}
