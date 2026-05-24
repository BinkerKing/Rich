import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import type { Element } from "@ke/domain";
import { DraftPrdModal } from "../components/DraftPrdModal.js";
import { ChildElementModal } from "../components/ChildElementModal.js";
import { AddPracticeChildModal } from "../components/AddPracticeChildModal.js";
import { InquiryCard } from "../components/InquiryCard.js";
import "./PracticeWorkspace.css";

type TabId = "overview" | "mockups" | "revisions" | "inquiries";

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (openChildId || draftPrdOpen) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) return;
      event.preventDefault();
      onBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draftPrdOpen, onBack, openChildId]);

  const practice = elements.get(practiceId);
  if (!practice || practice.type !== "practice") {
    return (
      <div className="pw">
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
  const features = allDescendants.filter(c => c.type === "feature").length;
  const prds = allDescendants.filter(c => c.type === "prd" || c.type === "product-design").length;
  const steps = allDescendants.filter(c => c.type === "dev-task" || c.type === "step");
  const stepDone = steps.filter(s => s.status === "done").length;
  const revisions = allDescendants.filter(c => c.type === "revision").length;
  const inquiriesAll = allDescendants.filter(c => c.type === "inquiry");
  const inquiriesPending = inquiriesAll.filter(c => (c.status ?? "todo") !== "done").length;

  return (
    <div className="pw">
      <div className="pw__top">
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
        {(["overview", "mockups", "revisions", "inquiries"] as TabId[]).map(t => (
          <button key={t}
            className={`pw__tab ${tab === t ? "is-active" : ""} pw__tab--${t}`}
            onClick={() => setTab(t)}>
            {t === "overview" ? "总览"
              : t === "mockups" ? "效果图"
              : t === "revisions" ? `整改建议${revisions > 0 ? ` (${revisions})` : ""}`
              : `提问${inquiriesPending > 0 ? ` (${inquiriesPending})` : ""}`}
          </button>
        ))}
      </div>

      <div className="pw__body">
        {tab === "overview" && (
          <OverviewTab
            practiceId={practiceId}
            practice={practice}
            groups={groups}
            looseChildren={looseChildren}
            childrenOf={childrenOf}
            concepts={concepts}
            cases={cases}
            features={features}
            prds={prds}
            stepsTotal={steps.length}
            stepDone={stepDone}
            revisions={revisions}
            inquiriesPending={inquiriesPending}
            inquiriesTotal={inquiriesAll.length}
            onOpenChild={setOpenChildId}
            onDraftPrd={() => setDraftPrdOpen(true)} />
        )}
        {tab === "mockups" && (
          <MockupsTab practice={practice} />
        )}
        {tab === "revisions" && (
          <RevisionsTab
            practiceId={practiceId}
            practice={practice}
            group={groups.find(g => g.title === "整改建议")}
            children={(() => {
              const g = groups.find(gr => gr.title === "整改建议");
              return g ? childrenOf(g.id) : [];
            })()}
            onOpenChild={setOpenChildId} />
        )}
        {tab === "inquiries" && (
          <InquiriesTab
            inquiries={inquiriesAll}
            elements={elements} />
        )}
      </div>

      {openChildId && (
        <ChildElementModal
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
// 总览 = KPI + 拆解全部内容（知识点/需求分析 双列 + PRD + 开发任务）
// ===================================================================

const GROUP_ICON: Record<string, string> = {
  "知识点": "📚",
  "场景分析": "🎯",
  "功能说明": "✨",
  "PRD": "📄",
  "开发任务": "⚙️",
  "整改建议": "🔧",
  "提问": "❓",
};
const GROUP_DEFAULT_TYPE: Record<string, "knowledge" | "requirement" | "feature" | "prd" | "dev-task" | "revision" | "inquiry"> = {
  "知识点": "knowledge",
  "场景分析": "requirement",
  "功能说明": "feature",
  "PRD": "prd",
  "开发任务": "dev-task",
  "整改建议": "revision",
  "提问": "inquiry",
};
// 历史数据兼容：老 group 标题 "需求分析" 等同于 "场景分析"。
// 找 group 时两个都查；首次发现老标题，UI 会静默 patch 成新标题。
const SCENARIO_TITLES = ["场景分析", "需求分析"];

function OverviewTab({
  practiceId, practice, groups, looseChildren, childrenOf,
  concepts, cases, features, prds, stepsTotal, stepDone, revisions,
  inquiriesPending, inquiriesTotal,
  onOpenChild, onDraftPrd,
}: {
  practiceId: string;
  practice: Element;
  groups: Element[];
  looseChildren: Element[];
  childrenOf: (parentId: string) => Element[];
  concepts: number;
  cases: number;
  features: number;
  prds: number;
  stepsTotal: number;
  stepDone: number;
  revisions: number;
  inquiriesPending: number;
  inquiriesTotal: number;
  onOpenChild: (id: string) => void;
  onDraftPrd: () => void;
}): ReactNode {
  const hydrate = useStore(s => s.hydrate);
  const stepPct = stepsTotal === 0 ? 0 : Math.round((stepDone / stepsTotal) * 100);

  // 5 个默认 group 按固定顺序定位；其他 group 当作"扩展"，放在最后整段
  const findGroup = (title: string): Element | undefined => groups.find(g => g.title === title);
  const gKnowledge   = findGroup("知识点");
  const gRequirement = groups.find(g => SCENARIO_TITLES.includes(g.title));   // 兼容老 "需求分析"
  const gFeature     = findGroup("功能说明");
  const gPrd         = findGroup("PRD");
  const gDevTask     = findGroup("开发任务");
  // gRevision 现在在 RevisionsTab 里查找；overview 只保留 KPI 计数
  // 注意：整改建议 + 提问 各自有独立 tab，不在 overview 渲染；defaultTitles 包含它们
  // 是为了让 extraGroups 不重复渲染（避免 overview 底部冒出第二份"提问 / 整改建议"框）
  const defaultTitles = new Set(["知识点", "场景分析", "需求分析", "功能说明", "PRD", "开发任务", "整改建议", "提问"]);
  const extraGroups   = groups.filter(g => !defaultTitles.has(g.title));

  // 一次性迁移：把老分组 "需求分析" 改名成 "场景分析"。
  // 用 useEffect 而不是直接 await——避免阻塞首次渲染；下次 hydrate 后 title 已更新。
  useEffect(() => {
    if (gRequirement && gRequirement.title === "需求分析") {
      void api.patchElement(gRequirement.id, { title: "场景分析" }).then(() => hydrate()).catch(() => {});
    }
  }, [gRequirement?.id, gRequirement?.title, hydrate]);

  return (
    <div className="pw-overview">
      <div className="pw-overview__kpis">
        <div className="pw-kpi pw-kpi--knowledge"><div className="pw-kpi__num">{concepts}</div><div className="pw-kpi__label">知识点</div></div>
        <div className="pw-kpi pw-kpi--requirement"><div className="pw-kpi__num">{cases}</div><div className="pw-kpi__label">场景分析</div></div>
        <div className="pw-kpi pw-kpi--feature"><div className="pw-kpi__num">{features}</div><div className="pw-kpi__label">功能说明</div></div>
        <div className="pw-kpi pw-kpi--prd"><div className="pw-kpi__num">{prds}</div><div className="pw-kpi__label">PRD</div></div>
        <div className="pw-kpi pw-kpi--dev-task"><div className="pw-kpi__num">{stepDone}/{stepsTotal}</div><div className="pw-kpi__label">开发任务</div></div>
        <div className="pw-kpi pw-kpi--revision"><div className="pw-kpi__num">{revisions}</div><div className="pw-kpi__label">整改建议</div></div>
        <div className="pw-kpi pw-kpi--inquiry"><div className="pw-kpi__num">{inquiriesPending}{inquiriesTotal > 0 && inquiriesPending !== inquiriesTotal ? <span className="pw-kpi__num-sub">/{inquiriesTotal}</span> : null}</div><div className="pw-kpi__label">待回答提问</div></div>
      </div>
      {stepsTotal > 0 && (
        <div className="pw-overview__progress">
          <div className="pw-overview__progress-label">开发任务进度 {stepPct}%</div>
          <div className="pw-overview__progress-bar"><span style={{ width: `${stepPct}%` }} /></div>
        </div>
      )}
      <div className="pw-overview__meta">
        <span>创建于 {new Date(practice.metadata.createdAt).toLocaleDateString("zh-CN")}</span>
        <span>最近更新 {new Date(practice.metadata.updatedAt).toLocaleDateString("zh-CN")}</span>
      </div>

      {/* —— 拆解：知识点 + 场景分析 + 功能说明（同行 3 列，固定大小） —— */}
      <div className="pw-bd-row pw-bd-row--three">
        <GroupBox
          group={gKnowledge}
          title="知识点"
          fallbackType="knowledge"
          children={gKnowledge ? childrenOf(gKnowledge.id) : []}
          practiceId={practiceId}
          practice={practice}
          onOpenChild={onOpenChild} />
        <GroupBox
          group={gRequirement}
          title="场景分析"
          fallbackType="requirement"
          children={gRequirement ? childrenOf(gRequirement.id) : []}
          practiceId={practiceId}
          practice={practice}
          onOpenChild={onOpenChild}
          sortable={true} />
        <GroupBox
          group={gFeature}
          title="功能说明"
          fallbackType="feature"
          children={gFeature ? childrenOf(gFeature.id) : []}
          practiceId={practiceId}
          practice={practice}
          onOpenChild={onOpenChild}
          hint="列出需要什么功能 — 显性 + 隐性，比如 '历史回看（显）' / '空状态提示文案（隐）'" />
      </div>

      {/* —— 拆解：PRD（整宽） —— */}
      <GroupBox
        group={gPrd}
        title="PRD"
        fallbackType="prd"
        children={gPrd ? childrenOf(gPrd.id) : []}
        practiceId={practiceId}
        practice={practice}
        onOpenChild={onOpenChild}
        extraAction={
          <button className="pw-bd-ai" onClick={onDraftPrd}>🪄 让 Rich 起草</button>
        } />

      {/* —— 拆解：开发任务（看板） —— */}
      <GroupBox
        group={gDevTask}
        title="开发任务"
        fallbackType="dev-task"
        children={gDevTask ? childrenOf(gDevTask.id) : []}
        practiceId={practiceId}
        practice={practice}
        onOpenChild={onOpenChild}
        kanban={true} />

      {/* 整改建议有自己的 tab，这里不渲染（保留 KPI 计数） */}

      {/* 额外分组（用户后续手动新建的，整宽列出） */}
      {extraGroups.map(g => (
        <GroupBox key={g.id}
          group={g}
          title={g.title}
          fallbackType="knowledge"
          children={childrenOf(g.id)}
          practiceId={practiceId}
          practice={practice}
          onOpenChild={onOpenChild} />
      ))}

      {/* 历史孤儿：没挂在 group 下的旧数据兼容显示 */}
      {looseChildren.length > 0 && (
        <div className="pw-bd-orphans">
          <div className="pw-bd-orphans__head">⚠ 未分组（{looseChildren.length}）</div>
          {looseChildren.map(c => (
            <button key={c.id} className="pw-bd-item" onClick={() => onOpenChild(c.id)}>
              <span className="pw-bd-item__title">[{c.type}] {c.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 单个 group 的盒子。
// - 普通：子元列表（标题 + 副标题），底部 + 新增 按钮（点开弹框）
// - kanban=true：3 列 todo/doing/done 看板
// - sortable=true：标题旁多个排序下拉。**默认排序按 "场景 N" 数字升序**，没数字
//   就 fallback 到创建顺序。其他模式：新→旧 / 旧→新 / 标题
// - hint=string：标题下方一行轻提示文案
// - 没有这个 group：点 "+ 新增" 时自动建 group 再开弹框
//
// PRD 例外：fallbackType==="prd" 时不开 AddPracticeChildModal（PRD 有独立
// 的 DraftPrdModal 走 8-section 模板），保留输入框直接建占位 PRD。
type SortMode = "default" | "newest" | "oldest" | "title";
function GroupBox({
  group, title, fallbackType, children, practiceId, practice,
  onOpenChild, kanban, extraAction, sortable, hint,
}: {
  group: Element | undefined;
  title: string;
  fallbackType: "knowledge" | "requirement" | "feature" | "prd" | "dev-task" | "revision";
  children: Element[];
  practiceId: string;
  practice: Element;
  onOpenChild: (id: string) => void;
  kanban?: boolean;
  extraAction?: ReactNode;
  sortable?: boolean;
  hint?: string;
}): ReactNode {
  const hydrate = useStore(s => s.hydrate);
  const [prdInputTitle, setPrdInputTitle] = useState("");      // 仅 PRD 的 inline input 用
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [modalOpen, setModalOpen] = useState(false);
  const [ensuredGroup, setEnsuredGroup] = useState<Element | undefined>(undefined);

  // 排序应用在 children 上：
  // - default：如果标题里能找出 "场景 N" 的 N 就按 N 升序；否则按创建顺序
  // - 其他模式：常规
  const sortedChildren = (() => {
    if (sortMode === "default") {
      // 尝试提取标题前缀的数字（"场景 1: xxx"、"场景1：xxx"、"Scene 3 - ..." 都能匹配）
      const withNum = children.map(c => {
        const m = c.title.match(/^[^\d]*?(\d+)/);
        return { c, n: m ? parseInt(m[1], 10) : null };
      });
      const allHaveNum = withNum.length > 0 && withNum.every(x => x.n !== null);
      if (allHaveNum) {
        return [...withNum]
          .sort((a, b) => (a.n as number) - (b.n as number))
          .map(x => x.c);
      }
      return children;
    }
    const sorted = [...children];
    if (sortMode === "newest") {
      sorted.sort((a, b) => b.metadata.createdAt.localeCompare(a.metadata.createdAt));
    } else if (sortMode === "oldest") {
      sorted.sort((a, b) => a.metadata.createdAt.localeCompare(b.metadata.createdAt));
    } else if (sortMode === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
    }
    return sorted;
  })();

  const ensureGroup = async (): Promise<Element | undefined> => {
    if (group) return group;
    setCreatingGroup(true);
    try {
      const g = await api.createPracticeGroup({ practiceId, title });
      await hydrate();
      return g;
    } catch (e) {
      alert(`建分组失败: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    } finally {
      setCreatingGroup(false);
    }
  };

  // PRD 走 inline input（保留旧行为，因为 PRD 有专门的 🪄 起草模板）
  const addPrdInline = async (): Promise<void> => {
    const t = prdInputTitle.trim();
    if (!t) return;
    const g = await ensureGroup();
    if (!g) return;
    try {
      await api.createPracticeChild({ parentId: g.id, type: "prd", title: t });
      setPrdInputTitle("");
      await hydrate();
    } catch (e) {
      alert(`新增失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // 其他类型走 AddPracticeChildModal：先 ensureGroup 拿到 group，再开弹框
  const openAddModal = async (): Promise<void> => {
    const g = await ensureGroup();
    if (!g) return;
    setEnsuredGroup(g);
    setModalOpen(true);
  };

  const setStatus = async (id: string, status: "todo" | "doing" | "done"): Promise<void> => {
    try {
      await api.patchElement(id, { status });
      await hydrate();
    } catch (e) {
      alert(`修改状态失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const icon = GROUP_ICON[title] ?? "📁";

  return (
    <section className={`pw-bd-group pw-bd-group--${fallbackType} ${kanban ? "pw-bd-group--kanban" : ""}`}>
      <header className="pw-bd-group__head">
        <button className="pw-bd-group__title-btn"
          onClick={() => group && onOpenChild(group.id)}
          disabled={!group}
          title={group ? "点击编辑分组" : "下方 + 新增 时自动建分组"}>
          {icon} {title} <span className="pw-bd-group__count">({children.length})</span>
        </button>
        <div className="pw-bd-group__actions">
          {sortable && children.length > 1 && (
            <select className="pw-bd-sort"
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              title="排序方式">
              <option value="default">默认（场景序号）</option>
              <option value="newest">新→旧</option>
              <option value="oldest">旧→新</option>
              <option value="title">标题 A→Z</option>
            </select>
          )}
          {extraAction}
          {fallbackType === "prd" ? (
            <input className="pw-bd-input"
              placeholder={`+ 新增${title}`}
              value={prdInputTitle}
              disabled={creatingGroup}
              onChange={e => setPrdInputTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void addPrdInline(); }} />
          ) : (
            <button className="pw-bd-add-btn"
              disabled={creatingGroup}
              onClick={() => void openAddModal()}>
              + 新增{title}
            </button>
          )}
        </div>
      </header>
      {hint && <div className="pw-bd-group__hint">{hint}</div>}

      {kanban ? (
        <div className="pw-bd-kanban">
          {(["todo", "doing", "done"] as const).map(col => {
            const items = children.filter(c =>
              (c.type === "dev-task" || c.type === "step") &&
              (c.status ?? "todo") === col);
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
                          className={`pw-bd-task__chip pw-bd-task__chip--${st} ${(s.status ?? "todo") === st ? "is-active" : ""}`}
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
        <div className="pw-bd-list">
          {sortedChildren.length === 0 ? (
            <div className="pw-bd-empty">暂无，下方新增第一个</div>
          ) : (
            sortedChildren.map(c => (
              <button key={c.id} className="pw-bd-item" onClick={() => onOpenChild(c.id)}>
                <span className="pw-bd-item__title">{c.title}</span>
                {c.subtitle && <span className="pw-bd-item__sub">{c.subtitle}</span>}
              </button>
            ))
          )}
        </div>
      )}

      {modalOpen && ensuredGroup && fallbackType !== "prd" && (
        <AddPracticeChildModal
          practice={practice}
          group={ensuredGroup}
          childType={fallbackType}
          existingTitles={children.map(c => c.title)}
          groupLabel={title}
          onClose={() => setModalOpen(false)} />
      )}
    </section>
  );
}

// ===================================================================
// Tab: 整改建议 — 看到当前版本提建议 → AI 分析 → 规划 → 实施
// 用一个全宽 GroupBox，复用列表 / 弹框新增 / 调整 等行为。
// ===================================================================
function RevisionsTab({
  practiceId, practice, group, children, onOpenChild,
}: {
  practiceId: string;
  practice: Element;
  group: Element | undefined;
  children: Element[];
  onOpenChild: (id: string) => void;
}): ReactNode {
  return (
    <div className="pw-revisions">
      <div className="pw-revisions__intro">
        看到 Rich 当前版本后想到的改进。写下方向（一两句话），让 Rich 帮你分析影响 / 风险 + 给出整改方案；
        实施完的可以挂到 开发任务 里追踪。
      </div>
      <GroupBox
        group={group}
        title="整改建议"
        fallbackType="revision"
        children={children}
        practiceId={practiceId}
        practice={practice}
        onOpenChild={onOpenChild}
        sortable={true} />
    </div>
  );
}

// ===================================================================
// Tab: 提问 — AI 写 PRD / 场景 / 功能时不确定的地方，列出来让用户选
// ===================================================================
function InquiriesTab({
  inquiries,
  elements,
}: {
  inquiries: Element[];
  elements: Map<string, Element>;
}): ReactNode {
  const pending = inquiries.filter(i => (i.status ?? "todo") !== "done");
  const answered = inquiries.filter(i => i.status === "done");

  if (inquiries.length === 0) {
    return (
      <div className="pw-inquiries">
        <div className="pw-inquiries__empty">
          <div className="pw-inquiries__empty-icon">❓</div>
          <div className="pw-inquiries__empty-text">
            还没有问题。Rich 在写 PRD / 场景 / 功能 / 整改建议 的时候，碰到不确定的地方会自动列到这里。
          </div>
          <div className="pw-inquiries__empty-hint">
            目前的设计：AI 输出 inquiries 数组时，前端会把每条建成独立的提问元（黄色），挂在「提问」分组下。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pw-inquiries">
      {pending.length > 0 && (
        <section className="pw-inquiries__section">
          <header className="pw-inquiries__section-head">
            <span className="pw-inquiries__section-title">待回答 ({pending.length})</span>
            <span className="pw-inquiries__section-sub">Rich 在分析过程中冒出来的拍板点</span>
          </header>
          <div className="pw-inquiries__list">
            {pending.map(inq => (
              <div key={inq.id} className="pw-inquiries__item">
                <InquiryCard inquiry={inq} />
                {(() => {
                  const c = inq.content as { relatedTo?: string } | undefined;
                  const related = c?.relatedTo ? elements.get(c.relatedTo) : undefined;
                  return related ? (
                    <div className="pw-inquiries__related">
                      关联：<span className="pw-inquiries__related-name">{related.title}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
        </section>
      )}

      {answered.length > 0 && (
        <section className="pw-inquiries__section">
          <header className="pw-inquiries__section-head">
            <span className="pw-inquiries__section-title pw-inquiries__section-title--done">
              已回答 ({answered.length})
            </span>
            <span className="pw-inquiries__section-sub">
              你的答案 — 可以用「调整」按钮把答案落到关联的元里
            </span>
          </header>
          <div className="pw-inquiries__list">
            {answered.map(inq => (
              <InquiryCard key={inq.id} inquiry={inq} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ===================================================================
// Tab 2: 效果图（网格画廊 + 上传 + 全屏看图）
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
