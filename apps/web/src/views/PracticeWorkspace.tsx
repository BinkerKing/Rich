import { useRef, useState, type ReactNode } from "react";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import type { Element } from "@ke/domain";
import { DraftPrdModal } from "../components/DraftPrdModal.js";
import { ChildElementDrawer } from "../components/ChildElementDrawer.js";
import "./PracticeWorkspace.css";

type TabId = "overview" | "breakdown" | "mockups";

interface Props {
  practiceId: string;
  onBack: () => void;
}

export function PracticeWorkspace({ practiceId, onBack }: Props): ReactNode {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);
  const [tab, setTab] = useState<TabId>("overview");
  const [openChildId, setOpenChildId] = useState<string | null>(null);
  const [draftPrdOpen, setDraftPrdOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const practice = elements.get(practiceId);
  if (!practice || practice.type !== "practice") {
    return (
      <div className="pw">
        <button className="pw__back" onClick={onBack}>← 全部项目</button>
        <div className="pw__error">项目不存在或已删除</div>
      </div>
    );
  }

  const isProject = (practice.tags ?? []).includes("实战项目");
  const toggleProjectMode = async (): Promise<void> => {
    setToggling(true);
    try {
      const currentTags = practice.tags ?? [];
      const nextTags = isProject
        ? currentTags.filter(t => t !== "实战项目")
        : ["实战项目", ...currentTags];
      await api.patchElement(practice.id, { tags: nextTags });
      await hydrate();
      if (isProject) onBack();
    } catch (e) {
      alert(`切换失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setToggling(false);
    }
  };

  // 新结构：practice → group → 实际子元
  const childrenOf = (parentId: string): Element[] => {
    const ids = relations
      .filter(r => r.kind === "child" && r.from === parentId)
      .map(r => r.to);
    return ids.map(id => elements.get(id)).filter((e): e is Element => !!e);
  };
  const directChildren = childrenOf(practiceId);
  const groups = directChildren.filter(c => c.type === "group");
  const looseChildren = directChildren.filter(c => c.type !== "group");

  // 统计：递归算所有 group 的子元 + 历史孤儿（loose）
  const allDescendants: Element[] = [];
  for (const g of groups) allDescendants.push(...childrenOf(g.id));
  allDescendants.push(...looseChildren);

  // 新类型为主；老类型 concept/case/product-design/step 算同类（向后兼容）
  const concepts = allDescendants.filter(c => c.type === "knowledge" || c.type === "concept").length;
  const cases = allDescendants.filter(c => c.type === "requirement" || c.type === "case").length;
  const prds = allDescendants.filter(c => c.type === "prd" || c.type === "product-design").length;
  const steps = allDescendants.filter(c => c.type === "dev-task" || c.type === "step");
  const stepDone = steps.filter(s => s.status === "done").length;

  return (
    <div className="pw">
      <div className="pw__top">
        <button className="pw__back" onClick={onBack}>← 全部项目</button>
        <div className="pw__title">{practice.title}</div>
        {practice.subtitle && <span className="pw__subtitle">{practice.subtitle}</span>}
        <div style={{ flex: 1 }} />
        <button
          className={`pw__toggle ${isProject ? "is-on" : "is-off"}`}
          disabled={toggling}
          title={isProject ? "关闭后从 项目实战 列表移除（仍在知识树）" : "打开后在 项目实战 列表显示"}
          onClick={() => void toggleProjectMode()}>
          {toggling ? "…" : isProject ? "✓ 在 项目实战 中" : "+ 加入 项目实战"}
        </button>
      </div>

      <div className="pw__tabs">
        {(["overview", "breakdown", "mockups"] as TabId[]).map(t => (
          <button key={t}
            className={`pw__tab ${tab === t ? "is-active" : ""}`}
            onClick={() => setTab(t)}>
            {t === "overview" ? "总览" : t === "breakdown" ? "拆解" : "效果图"}
          </button>
        ))}
      </div>

      <div className="pw__body">
        {tab === "overview" && (
          <OverviewTab concepts={concepts} cases={cases}
            prds={prds} steps={steps.length} stepDone={stepDone}
            practice={practice} />
        )}
        {tab === "breakdown" && (
          <BreakdownTab
            practiceId={practiceId}
            groups={groups}
            looseChildren={looseChildren}
            childrenOf={childrenOf}
            onOpenChild={setOpenChildId}
            onDraftPrd={() => setDraftPrdOpen(true)} />
        )}
        {tab === "mockups" && (
          <MockupsTab practice={practice} />
        )}
      </div>

      {openChildId && (
        <ChildElementDrawer
          elementId={openChildId}
          onClose={() => setOpenChildId(null)} />
      )}
      {draftPrdOpen && (
        <DraftPrdModal
          practice={practice}
          children={allDescendants}
          onClose={() => setDraftPrdOpen(false)} />
      )}
    </div>
  );
}

// ===================================================================
// Tab 1: 总览
// ===================================================================
function OverviewTab({ concepts, cases, prds, steps, stepDone, practice }: {
  concepts: number;
  cases: number;
  prds: number;
  steps: number;
  stepDone: number;
  practice: Element;
}): ReactNode {
  const stepPct = steps === 0 ? 0 : Math.round((stepDone / steps) * 100);
  return (
    <div className="pw-overview">
      <div className="pw-overview__kpis">
        <div className="pw-kpi"><div className="pw-kpi__num">{concepts}</div><div className="pw-kpi__label">知识点</div></div>
        <div className="pw-kpi"><div className="pw-kpi__num">{cases}</div><div className="pw-kpi__label">需求分析</div></div>
        <div className="pw-kpi"><div className="pw-kpi__num">{prds}</div><div className="pw-kpi__label">PRD</div></div>
        <div className="pw-kpi"><div className="pw-kpi__num">{stepDone}/{steps}</div><div className="pw-kpi__label">开发任务</div></div>
      </div>
      {steps > 0 && (
        <div className="pw-overview__progress">
          <div className="pw-overview__progress-label">开发任务进度 {stepPct}%</div>
          <div className="pw-overview__progress-bar"><span style={{ width: `${stepPct}%` }} /></div>
        </div>
      )}
      <div className="pw-overview__meta">
        <span>创建于 {new Date(practice.metadata.createdAt).toLocaleDateString("zh-CN")}</span>
        <span>最近更新 {new Date(practice.metadata.updatedAt).toLocaleDateString("zh-CN")}</span>
      </div>
    </div>
  );
}

// ===================================================================
// Tab 2: 拆解 — 按 group 渲染
// 每个 group 是个 Element (type="group")，下面挂具体子元
// PRD group 多个 🪄 起草按钮；开发任务 group / 含 step 的 group 用看板渲染
// ===================================================================

const GROUP_ICON: Record<string, string> = {
  "知识点": "📚",
  "需求分析": "🎯",
  "PRD": "📄",
  "开发任务": "⚙️",
};
const GROUP_DEFAULT_TYPE: Record<string, "knowledge" | "requirement" | "prd" | "dev-task"> = {
  "知识点": "knowledge",
  "需求分析": "requirement",
  "PRD": "prd",
  "开发任务": "dev-task",
};

function BreakdownTab({
  practiceId, groups, looseChildren, childrenOf,
  onOpenChild, onDraftPrd,
}: {
  practiceId: string;
  groups: Element[];
  looseChildren: Element[];
  childrenOf: (parentId: string) => Element[];
  onOpenChild: (id: string) => void;
  onDraftPrd: () => void;
}): ReactNode {
  const hydrate = useStore(s => s.hydrate);
  const [newTitleByGroup, setNewTitleByGroup] = useState<Record<string, string>>({});
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const addChildToGroup = async (groupId: string, type: "knowledge" | "requirement" | "prd" | "dev-task"): Promise<void> => {
    const title = (newTitleByGroup[groupId] ?? "").trim();
    if (!title) return;
    try {
      await api.createPracticeChild({ parentId: groupId, type, title });
      setNewTitleByGroup(s => ({ ...s, [groupId]: "" }));
      await hydrate();
    } catch (e) {
      alert(`新增失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const addGroup = async (): Promise<void> => {
    const t = newGroupTitle.trim();
    if (!t) return;
    try {
      await api.createPracticeGroup({ practiceId, title: t });
      setNewGroupTitle("");
      setCreatingGroup(false);
      await hydrate();
    } catch (e) {
      alert(`新增分组失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const setStatus = async (id: string, status: "todo" | "doing" | "done"): Promise<void> => {
    try {
      await api.patchElement(id, { status });
      await hydrate();
    } catch (e) {
      alert(`修改状态失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const renderGroup = (group: Element): ReactNode => {
    const children = childrenOf(group.id);
    const icon = GROUP_ICON[group.title] ?? "📁";
    const defaultType = GROUP_DEFAULT_TYPE[group.title] ?? "concept";
    const isPrd = group.title.includes("PRD");
    // 任何 group 只要里面主要是 dev-task / step（或标题含"任务"/"task"）就用看板
    const isKanban = group.title.includes("任务") || group.title.toLowerCase().includes("task")
      || (children.length > 0 && children.every(c => c.type === "dev-task" || c.type === "step"));

    return (
      <div key={group.id} className="pw-bd-group">
        <div className="pw-bd-group__head">
          <button className="pw-bd-group__title-btn" onClick={() => onOpenChild(group.id)}
            title="点击编辑分组标题">
            {icon} {group.title} ({children.length})
          </button>
          <div className="pw-bd-group__actions">
            {isPrd && (
              <button className="pw-bd-ai" onClick={onDraftPrd}>🪄 让 Rich 起草</button>
            )}
            <input className="pw-bd-input"
              placeholder={`+ 新增${group.title}`}
              value={newTitleByGroup[group.id] ?? ""}
              onChange={e => setNewTitleByGroup(s => ({ ...s, [group.id]: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") void addChildToGroup(group.id, defaultType); }} />
          </div>
        </div>

        {isKanban ? (
          <div className="pw-bd-kanban">
            {(["todo", "doing", "done"] as const).map(col => {
              const items = children.filter(c => (c.type === "dev-task" || c.type === "step") && (c.status ?? "todo") === col);
              return (
                <div key={col} className={`pw-bd-col pw-bd-col--${col}`}>
                  <div className="pw-bd-col__head">{col} ({items.length})</div>
                  {items.map(s => (
                    <div key={s.id} className="pw-bd-task">
                      <button className="pw-bd-task__title" onClick={() => onOpenChild(s.id)}>
                        {s.title}
                      </button>
                      <div className="pw-bd-task__actions">
                        {(["todo","doing","done"] as const).map(st => (
                          <button key={st}
                            className={`pw-bd-task__chip ${(s.status ?? "todo") === st ? "is-active" : ""}`}
                            onClick={() => void setStatus(s.id, st)}>
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="pw-bd-empty">空</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {children.map(c => (
              <button key={c.id} className="pw-bd-item" onClick={() => onOpenChild(c.id)}>
                <span className="pw-bd-item__title">{c.title}</span>
                {c.subtitle && <span className="pw-bd-item__sub">{c.subtitle}</span>}
              </button>
            ))}
            {children.length === 0 && <div className="pw-bd-empty">暂无</div>}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="pw-bd">
      {groups.map(renderGroup)}

      {/* 历史孤儿：没挂在 group 下的旧数据兼容显示 */}
      {looseChildren.length > 0 && (
        <div className="pw-bd-group" style={{ borderStyle: "dashed", opacity: 0.85 }}>
          <div className="pw-bd-group__head">
            <span>⚠ 未分组（{looseChildren.length}）</span>
          </div>
          {looseChildren.map(c => (
            <button key={c.id} className="pw-bd-item" onClick={() => onOpenChild(c.id)}>
              <span className="pw-bd-item__title">[{c.type}] {c.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* + 新增分组 */}
      {creatingGroup ? (
        <div className="pw-bd-add-group">
          <input className="pw-bd-input" autoFocus
            placeholder="分组名（例：竞品调研 / 设计稿 / 测试用例）"
            value={newGroupTitle}
            onChange={e => setNewGroupTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") void addGroup();
              if (e.key === "Escape") { setCreatingGroup(false); setNewGroupTitle(""); }
            }} />
          <button className="pw-bd-ai" onClick={() => void addGroup()} disabled={!newGroupTitle.trim()}>新建</button>
          <button className="pw-bd-cancel" onClick={() => { setCreatingGroup(false); setNewGroupTitle(""); }}>取消</button>
        </div>
      ) : (
        <button className="pw-bd-add-group-btn" onClick={() => setCreatingGroup(true)}>+ 新建分组</button>
      )}
    </div>
  );
}

// ===================================================================
// Tab 3: 效果图（网格画廊 + 上传 + 全屏看图）
// ===================================================================
function MockupsTab({ practice }: { practice: Element }): ReactNode {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const hydrate = useStore(s => s.hydrate);

  const images: Array<{ src: string; caption?: string }> =
    (practice.content as { images?: Array<{ src: string; caption?: string }> } | undefined)?.images ?? [];

  const onPick = (): void => fileRef.current?.click();

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      // 复用现有 image 上传 API（实战项目把所有效果图存为 practice.content.images）
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/images/${encodeURIComponent(practice.id)}/upload`, {
        method: "POST", body: fd,
      });
      if (!r.ok) throw new Error(`upload failed: ${r.status}`);
      const { src } = await r.json() as { src: string };
      // 把这张图加进 practice.content.images
      const nextContent = {
        ...(practice.content as Record<string, unknown> ?? {}),
        images: [...images, { src, caption: f.name }],
      };
      await api.patchElement(practice.id, { content: nextContent });
      await hydrate();
    } catch (err) {
      alert(`上传失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="pw-mk">
      <div className="pw-mk__head">
        <span>效果图 ({images.length})</span>
        <button className="pw-mk__upload" onClick={onPick} disabled={uploading}>
          {uploading ? "上传中…" : "+ 上传"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onUpload} />
      </div>
      {images.length === 0 ? (
        <div className="pw-mk__empty">还没有效果图。点 +上传 加一张。</div>
      ) : (
        <div className="pw-mk__grid">
          {images.map((img, i) => (
            <button key={i} className="pw-mk__cell" onClick={() => setFullscreen(i)}>
              <img src={img.src} alt={img.caption ?? `mockup-${i}`} />
              {img.caption && <div className="pw-mk__caption">{img.caption}</div>}
            </button>
          ))}
        </div>
      )}
      {fullscreen !== null && images[fullscreen] && (
        <div className="pw-mk__fs" onClick={() => setFullscreen(null)}>
          <img src={images[fullscreen].src} alt={images[fullscreen].caption ?? ""} />
        </div>
      )}
    </div>
  );
}
