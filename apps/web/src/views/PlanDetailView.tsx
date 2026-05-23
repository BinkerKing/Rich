// apps/web/src/views/PlanDetailView.tsx
import { useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { computePlanProgress, computeGoalProgress } from "@ke/domain";
import type { Plan } from "@ke/domain";
import { GoalModal } from "./GreatMeView.js";
import "./PlanDetailView.css";

interface Goal { id: string; scope: "year"|"month"|"week"; title: string; progress: number; planId?: string; parentId?: string; createdAt: number; detail: string; phase: "calibrate" | "execute" | "review" | "close"; due: string }
interface Task { id: string; title: string; done: boolean; date: string; goalId: string; badge: string; note: string }
interface PartialState { plans: Plan[]; goals: Goal[]; tasks: Task[] }

const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

type TabId = "overview" | "month" | "week" | "today";

interface Props<S extends PartialState> {
  plan: Plan;
  state: S;
  setState: Dispatch<SetStateAction<S>>;
  onBack: () => void;
}

export function PlanDetailView<S extends PartialState>({ plan, state, setState, onBack }: Props<S>): ReactNode {
  const [tab, setTab] = useState<TabId>("today");
  /** 父过滤：点 X 父目标的"↓ N 个子目标"后，子 scope tab 只显示这棵子树 */
  const [filterParentId, setFilterParentId] = useState<string | null>(null);

  // 实时进度：把 tasks 传进来，让百分比跟随 task 完成度动起来（递归从 task 算到 week→month→year→plan）
  const progress = useMemo(() => computePlanProgress(
    plan.id,
    state.goals as Parameters<typeof computePlanProgress>[1],
    state.tasks as Parameters<typeof computePlanProgress>[2],
  ), [plan.id, state.goals, state.tasks]);

  const planGoals = state.goals.filter(g => g.planId === plan.id);
  const planTasks = state.tasks.filter(t => planGoals.some(g => g.id === t.goalId));
  const todayTasks = planTasks.filter(t => t.date === new Date().toISOString().slice(0, 10));

  const filterParent = filterParentId ? planGoals.find(g => g.id === filterParentId) : null;
  const childCount = (parentId: string, childScope: "month"|"week"): number =>
    planGoals.filter(g => g.parentId === parentId && g.scope === childScope).length;
  const taskCount = (goalId: string): { done: number; total: number } => {
    const ts = planTasks.filter(t => t.goalId === goalId);
    return { done: ts.filter(t => t.done).length, total: ts.length };
  };
  const drillToChildren = (parentId: string, childScope: "month"|"week"): void => {
    setFilterParentId(parentId);
    setTab(childScope);
  };

  const toggleTask = (id: string): void => setState(prev => ({
    ...prev,
    tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t),
  } as S));
  const delTask = (id: string): void => setState(prev => ({
    ...prev,
    tasks: prev.tasks.filter(t => t.id !== id),
  } as S));

  // === Stage 2.5：可编辑性。GoalModal 状态 + 任务 inline 新建 ===
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [newGoalScope, setNewGoalScope] = useState<"month" | "week" | null>(null);
  const [newGoalParentId, setNewGoalParentId] = useState<string | null>(null);
  const [newTaskDraft, setNewTaskDraft] = useState("");
  /** 树节点折叠状态：被加进 Set 的 node id 表示折叠（默认全展开）。 */
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  /** 今日 tab 当前在 inline 编辑哪条任务标题。 */
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  /** 今日 tab 当前打开了哪条任务的"换目标"小弹窗。 */
  const [reassignTaskId, setReassignTaskId] = useState<string | null>(null);
  /** 给"新建任务"选哪个 goal 当容器：默认本计划最新的 active 周目标。 */
  const defaultNewTaskGoalId = useMemo(() => {
    const week = planGoals.find(g => g.scope === "week" && g.progress > 0 && g.progress < 100);
    return week?.id ?? planGoals.find(g => g.scope === "week")?.id ?? "";
  }, [planGoals]);
  const [newTaskGoalId, setNewTaskGoalId] = useState<string>(defaultNewTaskGoalId);

  const openNewGoal = (scope: "month" | "week", parentId?: string): void => {
    setEditingGoal(null);
    setNewGoalScope(scope);
    setNewGoalParentId(parentId ?? null);
  };
  const openEditGoal = (g: Goal): void => {
    setEditingGoal(g);
    setNewGoalScope(null);
    setNewGoalParentId(null);
  };
  const closeGoalModal = (): void => {
    setEditingGoal(null);
    setNewGoalScope(null);
    setNewGoalParentId(null);
  };

  const handleGoalSave = (g: Omit<Goal, "id" | "createdAt"> & { planId?: string; parentId?: string }): void => {
    if (editingGoal) {
      // 编辑：合并字段
      const id = editingGoal.id;
      setState(prev => ({
        ...prev,
        goals: prev.goals.map(x => x.id === id ? { ...x, ...g } : x),
      } as S));
    } else {
      // 新建：生成 id + createdAt，强制带上 plan.id（保险：以防 lockedPlanId 没传进来）
      setState(prev => ({
        ...prev,
        goals: [...prev.goals, {
          ...g,
          id: uid(),
          createdAt: Date.now(),
          planId: g.planId ?? plan.id,
        }],
      } as S));
    }
    closeGoalModal();
  };

  const addInlineTask = (): void => {
    const title = newTaskDraft.trim();
    if (!title) return;
    setState(prev => ({
      ...prev,
      tasks: [...prev.tasks, {
        id: uid(),
        title,
        done: false,
        date: todayIso(),
        goalId: newTaskGoalId,
        badge: "",
        note: "",
      }],
    } as S));
    setNewTaskDraft("");
  };

  const modalOpen = editingGoal !== null || newGoalScope !== null;
  const modalScope: "year" | "month" | "week" = editingGoal?.scope ?? newGoalScope ?? "week";
  const modalParent = newGoalParentId ? planGoals.find(g => g.id === newGoalParentId) : null;

  // === S5/S6：树节点折叠 + 删除 ===
  const toggleCollapse = (id: string): void => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const deleteGoalCascade = (g: Goal): void => {
    const children = planGoals.filter(x => x.parentId === g.id);
    const tasksUnder = planTasks.filter(t => t.goalId === g.id);
    const childCount = children.length;
    const taskCount = tasksUnder.length;
    const childWord = childCount > 0 ? `${childCount} 个子目标` : "";
    const taskWord = taskCount > 0 ? `${taskCount} 条任务` : "";
    const cascadeNote = childCount + taskCount > 0
      ? `\n这会同时删除：${[childWord, taskWord].filter(Boolean).join(" + ")}`
      : "";
    if (!confirm(`确定删除「${g.title}」？${cascadeNote}`)) return;
    // 递归收集所有要删的 goal id
    const toDelete = new Set<string>([g.id]);
    let added = true;
    while (added) {
      added = false;
      for (const x of planGoals) {
        if (x.parentId && toDelete.has(x.parentId) && !toDelete.has(x.id)) {
          toDelete.add(x.id);
          added = true;
        }
      }
    }
    setState(prev => ({
      ...prev,
      goals: prev.goals.filter(x => !toDelete.has(x.id)),
      tasks: prev.tasks.filter(t => !toDelete.has(t.goalId)),
    } as S));
  };

  // === S4：今日任务 inline 编辑 ===
  const startEditTask = (t: Task): void => {
    setEditingTaskId(t.id);
    setEditingTaskTitle(t.title);
  };
  const commitEditTask = (): void => {
    if (!editingTaskId) return;
    const trimmed = editingTaskTitle.trim();
    if (trimmed) {
      const id = editingTaskId;
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === id ? { ...t, title: trimmed } : t),
      } as S));
    }
    setEditingTaskId(null);
    setEditingTaskTitle("");
  };
  const reassignTask = (taskId: string, newGoalId: string): void => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? { ...t, goalId: newGoalId } : t),
    } as S));
    setReassignTaskId(null);
  };

  /** 递归渲染单个目标节点 + 子目标 + 关联任务。深度决定缩进。 */
  const renderTreeNode = (goal: Goal, depth: number): ReactNode => {
    const children = planGoals
      .filter(g => g.parentId === goal.id)
      .sort((a, b) => a.due.localeCompare(b.due));
    const goalTasks = planTasks
      .filter(t => t.goalId === goal.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const scopeLabel = goal.scope === "year" ? "年" : goal.scope === "month" ? "月" : "周";

    // 实时算的进度（任务完成度 → 周 → 月 → 年），覆盖存储的静态 goal.progress
    const dynProgress = computeGoalProgress(goal.id, planGoals as Parameters<typeof computeGoalProgress>[1], planTasks as Parameters<typeof computeGoalProgress>[2]);

    // 汇总文案：周 = 任务完成数；月/年 = 子目标完成数
    let summary = "";
    if (children.length > 0) {
      // 用动态算的进度判断子目标是否完成
      const doneKids = children.filter(c => computeGoalProgress(c.id, planGoals as Parameters<typeof computeGoalProgress>[1], planTasks as Parameters<typeof computeGoalProgress>[2]) >= 100).length;
      const childWord = children[0].scope === "month" ? "月" : children[0].scope === "week" ? "周" : "目标";
      summary = `${doneKids} / ${children.length} 个${childWord}完成`;
    } else if (goalTasks.length > 0) {
      const doneT = goalTasks.filter(t => t.done).length;
      summary = `${doneT} / ${goalTasks.length} 任务完成`;
    }

    const hasKids = children.length + goalTasks.length > 0;
    const collapsed = collapsedNodes.has(goal.id);
    // 决定子节点的"加目标 / 加任务"快捷按钮的语义：
    //  year 父 → 加 month 子
    //  month 父 → 加 week 子
    //  week 父 → 加 task（这里不是 goal）
    const addChildLabel = goal.scope === "year" ? "+ 月" : goal.scope === "month" ? "+ 周" : "+ 任务";
    const addChild = (): void => {
      if (goal.scope === "year") openNewGoal("month", goal.id);
      else if (goal.scope === "month") openNewGoal("week", goal.id);
      else {
        setNewTaskGoalId(goal.id);
        // 切到今日 tab 让用户输入
        setTab("today");
      }
    };

    return (
      <div key={goal.id} className="pd-tree-node">
        <div className="pd-tree-row" style={{ paddingLeft: depth * 22 }}>
          {/* 折叠 toggle（只有有子的才显示） */}
          {hasKids ? (
            <button className="pd-tree-toggle" title={collapsed ? "展开" : "折叠"}
              onClick={() => toggleCollapse(goal.id)}>
              {collapsed ? "▶" : "▼"}
            </button>
          ) : (
            <span className="pd-tree-toggle pd-tree-toggle--leaf" aria-hidden>·</span>
          )}
          {depth > 0 && <span className="pd-tree-edge" aria-hidden>└─</span>}
          <span className={`pd-tree-scope pd-tree-scope--${goal.scope}`}>{scopeLabel}</span>
          <span className="pd-tree-title is-clickable" title="点击编辑"
            onClick={() => openEditGoal(goal)}>{goal.title}</span>
          <div className="pd-tree-bar"><span style={{ width: `${dynProgress}%` }} /></div>
          <span className="pd-tree-pct">{dynProgress}%</span>
          {summary && <span className="pd-tree-summary">{summary}</span>}
          {/* S5：hover actions */}
          <div className="pd-tree-actions">
            <button className="pd-tree-action" title="编辑"
              onClick={() => openEditGoal(goal)}>✎</button>
            <button className="pd-tree-action" title={`在此节点下${addChildLabel.slice(2)}`}
              onClick={addChild}>{addChildLabel}</button>
            <button className="pd-tree-action pd-tree-action--danger" title="删除"
              onClick={() => deleteGoalCascade(goal)}>🗑</button>
          </div>
        </div>
        {!collapsed && children.map(c => renderTreeNode(c, depth + 1))}
        {!collapsed && goalTasks.length > 0 && goalTasks.map(t => (
          <div key={t.id} className={`pd-tree-task ${t.done ? "is-done" : ""}`}
            style={{ paddingLeft: (depth + 1) * 22 }}>
            <span className="pd-tree-edge" aria-hidden>└─</span>
            <button className={`pd-tree-task__check ${t.done ? "is-done" : ""}`}
              onClick={() => toggleTask(t.id)}
              title={t.done ? "标记未完成" : "标记完成"}>{t.done ? "✓" : ""}</button>
            <span className="pd-tree-task__title">{t.title}</span>
            <span className="pd-tree-task__date">{t.date}</span>
          </div>
        ))}
      </div>
    );
  };

  /** 完整层级树：年→月→周→任务 */
  const renderHierarchyTree = (): ReactNode => {
    // 根节点：本 plan 下没有 parentId 的目标，按 scope 排序（年→月→周）
    const scopeOrder = { year: 0, month: 1, week: 2 } as const;
    const roots = [...planGoals]
      .filter(g => !g.parentId)
      .sort((a, b) => {
        const sd = scopeOrder[a.scope] - scopeOrder[b.scope];
        return sd !== 0 ? sd : a.due.localeCompare(b.due);
      });
    // 也把"孤儿任务"（goalId 不指向本 plan 下任何 goal 的）单列在底部
    const orphanTasks = planTasks.filter(t => !planGoals.some(g => g.id === t.goalId));

    if (roots.length === 0 && orphanTasks.length === 0) {
      return (
        <div className="pd-empty" style={{ padding: 24, fontSize: 12 }}>
          这个计划下还没有目标 / 任务。
        </div>
      );
    }

    return (
      <div className="pd-tree">
        {roots.map(root => renderTreeNode(root, 0))}
        {orphanTasks.length > 0 && (
          <div className="pd-tree-node">
            <div className="pd-tree-row" style={{ paddingLeft: 0, color: "#a87526" }}>
              <span className="pd-tree-scope">⚠</span>
              <span className="pd-tree-title">未挂目标的任务（{orphanTasks.length}）</span>
            </div>
            {orphanTasks.map(t => (
              <div key={t.id} className={`pd-tree-task ${t.done ? "is-done" : ""}`} style={{ paddingLeft: 22 }}>
                <span className="pd-tree-edge" aria-hidden>└─</span>
                <span className={`pd-tree-task__check ${t.done ? "is-done" : ""}`}>{t.done ? "✓" : ""}</span>
                <span className="pd-tree-task__title">{t.title}</span>
                <span className="pd-tree-task__date">{t.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderKanban = (scope: "month"|"week"): ReactNode => {
    // 基础列表：本计划下该 scope 的全部目标
    let scoped = planGoals.filter(g => g.scope === scope);
    // 若有父过滤（来自上一层下钻），仅显示该父下属的子目标
    if (filterParentId && scope === "week") {
      scoped = scoped.filter(g => g.parentId === filterParentId);
    }
    // 用动态算的进度（task 完成度递归得来）来分桶看板列
    const dynP = (g: Goal): number => computeGoalProgress(g.id, planGoals as Parameters<typeof computeGoalProgress>[1], planTasks as Parameters<typeof computeGoalProgress>[2]);
    const planned = scoped.filter(g => dynP(g) === 0);
    const active  = scoped.filter(g => { const p = dynP(g); return p > 0 && p < 100; });
    const done    = scoped.filter(g => dynP(g) >= 100);
    const childScope: "month"|"week"|null = scope === "month" ? "week" : null;

    const card = (g: Goal): ReactNode => {
      const parent = g.parentId ? planGoals.find(x => x.id === g.parentId) : null;
      const kidCount = childScope ? childCount(g.id, childScope) : 0;
      const tc = taskCount(g.id);
      const p = dynP(g);
      return (
        <div key={g.id} className="pd-kanban-card">
          {parent && (
            <div className="pd-kanban-card__parent" title={`属于：${parent.title}`}>
              ↑ {parent.title}
            </div>
          )}
          {/* 点标题进编辑 */}
          <div className="pd-kanban-card__title is-clickable"
            title="点击编辑此目标"
            onClick={() => openEditGoal(g)}>
            {g.title}
          </div>
          <div className="pd-kanban-card__bar"><span style={{ width: `${p}%` }} /></div>
          <div className="pd-kanban-card__foot">
            <div className="pd-kanban-card__links">
              {childScope && kidCount > 0 && (
                <button className="pd-kanban-card__drill"
                  title={`查看下属 ${kidCount} 个周计划`}
                  onClick={() => drillToChildren(g.id, childScope)}>
                  ↓ {kidCount} 个周计划
                </button>
              )}
              {/* 月卡：加"+ 新建周计划"快捷按钮，自动锁父 */}
              {scope === "month" && (
                <button className="pd-kanban-card__quick-add"
                  title="在此月目标下新建周计划"
                  onClick={() => openNewGoal("week", g.id)}>
                  + 新建周计划
                </button>
              )}
              {tc.total > 0 && (
                <span className="pd-kanban-card__tasks" title={`关联 ${tc.done}/${tc.total} 个任务`}>
                  ◇ {tc.done}/{tc.total} 任务
                </span>
              )}
            </div>
            <span className="pd-kanban-card__pct">{p}%</span>
          </div>
        </div>
      );
    };

    const col = (title: string, list: Goal[]): ReactNode => (
      <div className="pd-kanban-col">
        <div className="pd-kanban-col__head">
          <span className="pd-kanban-col__title">{title}</span>
          <div className="pd-kanban-col__head-right">
            <span className="pd-kanban-col__count">{list.length}</span>
            {/* 只在"计划中"列显示 +，避免 3 列各一个噪太多；新建后默认 progress=0 也确实进计划中列 */}
            {title === "计划中" && (
              <button className="pd-kanban-col__add"
                title={`+ 新建${scope === "month" ? "月" : "周"}目标`}
                onClick={() => openNewGoal(scope, scope === "week" ? (filterParentId ?? undefined) : undefined)}>
                +
              </button>
            )}
          </div>
        </div>
        {list.length === 0 ? (
          <div className="pd-empty" style={{ padding: 24, fontSize: 12 }}>暂无</div>
        ) : list.map(card)}
      </div>
    );

    return (
      <>
        {scope === "week" && filterParent && (
          <div className="pd-filter-bar">
            <span className="pd-filter-bar__label">
              仅显示「{filterParent.title}」下属周计划（{scoped.length}）
            </span>
            <button className="pd-filter-bar__clear" onClick={() => setFilterParentId(null)}>
              清除筛选 ×
            </button>
          </div>
        )}
        <div className="pd-kanban">
          {col("计划中", planned)}
          {col("正在进行", active)}
          {col("已完成", done)}
        </div>
      </>
    );
  };

  return (
    <div className="pd">
      <div className="pd__top">
        <button className="pd__back" onClick={onBack}>← 全部计划</button>
        <div className="pd__title">{plan.title}</div>
        <span className="pd__status">{plan.status === "active" ? "进行中" : plan.status === "completed" ? "已完成" : "已归档"}</span>
      </div>

      <div className="pd-hero">
        <div className="pd-hero__bar">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="pd-hero__meta">
          <span>{plan.start || "未设起"}</span>
          <span className="pd-hero__pct">{progress}%</span>
          <span>{plan.end || "未设止"}</span>
        </div>
      </div>

      <div className="pd-tabs">
        {(["overview","month","week","today"] as TabId[]).map(t => (
          <button key={t} className={`pd-tab ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
            {t === "overview" ? "总览" : t === "month" ? "月度" : t === "week" ? "周度" : "今日"}
          </button>
        ))}
      </div>

      <div className="pd-body">
        {tab === "overview" && (
          <div className="pd-overview-v2">
            <div className="pd-overview-v2__kpis">
              <div className="pd-kpi">
                <div className="pd-kpi__num">{planGoals.length}</div>
                <div className="pd-kpi__label">计划下目标数</div>
              </div>
              <div className="pd-kpi">
                <div className="pd-kpi__num">{planTasks.filter(t => t.done).length} / {planTasks.length}</div>
                <div className="pd-kpi__label">任务完成数</div>
              </div>
              <div className="pd-kpi">
                <div className="pd-kpi__num">
                  {(() => {
                    if (!plan.end) return "—";
                    const d = (Date.parse(plan.end) - Date.now()) / 86400000;
                    if (d < 0) return "已过期";
                    return `${Math.ceil(d)} 天`;
                  })()}
                </div>
                <div className="pd-kpi__label">距离截止</div>
              </div>
              <div className="pd-kpi">
                <div className="pd-kpi__num">{progress}%</div>
                <div className="pd-kpi__label">整体进度</div>
              </div>
            </div>
            <div className="pd-overview-v2__tree-card">
              <div className="pd-overview-v2__tree-head">
                <span className="pd-overview-v2__tree-title">计划层级结构</span>
                <span className="pd-overview-v2__tree-hint">年 → 月 → 周 → 日任务</span>
              </div>
              {renderHierarchyTree()}
            </div>
          </div>
        )}
        {tab === "month" && renderKanban("month")}
        {tab === "week"  && renderKanban("week")}
        {tab === "today" && (
          <>
            {/* Stage 2.5：inline 新建任务条 */}
            <div className="pd-today-add">
              <input className="pd-today-add__input"
                placeholder="加一条今日任务..."
                value={newTaskDraft}
                onChange={e => setNewTaskDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addInlineTask(); }} />
              <select className="pd-today-add__goal"
                value={newTaskGoalId}
                onChange={e => setNewTaskGoalId(e.target.value)}
                title="挂到哪个目标">
                {planGoals.length === 0 ? (
                  <option value="">(本计划无目标)</option>
                ) : (
                  planGoals.map(g => (
                    <option key={g.id} value={g.id}>
                      [{g.scope === "year" ? "年" : g.scope === "month" ? "月" : "周"}] {g.title.length > 24 ? g.title.slice(0, 24) + "…" : g.title}
                    </option>
                  ))
                )}
              </select>
              <button className="pd-today-add__btn"
                disabled={!newTaskDraft.trim() || !newTaskGoalId}
                onClick={addInlineTask}>
                + 加入
              </button>
            </div>
          {todayTasks.length === 0 ? (
            <div className="pd-empty">
              <div className="pd-empty__title">今日任务</div>
              <div className="pd-empty__sub">该计划下今天还没有具体任务，从上方加一条。</div>
            </div>
          ) : (
            <div className="pd-today">
              {todayTasks.map(t => {
                const goal = planGoals.find(g => g.id === t.goalId);
                const isEditingThis = editingTaskId === t.id;
                const isReassigningThis = reassignTaskId === t.id;
                return (
                  <div key={t.id} className={`pd-today-item ${t.done ? "is-done" : ""}`}>
                    <button className={`pd-today-item__check ${t.done ? "is-done" : ""}`}
                      onClick={() => toggleTask(t.id)}
                      title={t.done ? "标记未完成" : "标记完成"}>
                      {t.done ? "✓" : ""}
                    </button>
                    {isEditingThis ? (
                      <input className="pd-today-item__edit"
                        autoFocus
                        value={editingTaskTitle}
                        onChange={e => setEditingTaskTitle(e.target.value)}
                        onBlur={commitEditTask}
                        onKeyDown={e => {
                          if (e.key === "Enter") commitEditTask();
                          if (e.key === "Escape") { setEditingTaskId(null); setEditingTaskTitle(""); }
                        }} />
                    ) : (
                      <span className="pd-today-item__title is-clickable"
                        title="点击编辑"
                        onClick={() => startEditTask(t)}>{t.title}</span>
                    )}
                    {/* 目标 pill：点击切换归属（只在不编辑时显示） */}
                    {!isEditingThis && (
                      <div className="pd-today-item__goal-wrap">
                        <button className={`pd-today-item__goal ${goal ? "is-set" : "is-empty"}`}
                          onClick={() => setReassignTaskId(isReassigningThis ? null : t.id)}
                          title={goal ? `当前归属：${goal.title}（点击切换）` : "未挂目标，点击挂上"}>
                          {goal
                            ? `${goal.scope === "year" ? "年" : goal.scope === "month" ? "月" : "周"}·${goal.title.length > 10 ? goal.title.slice(0, 10) + "…" : goal.title}`
                            : "未挂目标"}
                        </button>
                        {isReassigningThis && (
                          <div className="pd-today-item__reassign-pop">
                            {planGoals.length === 0 ? (
                              <div className="pd-today-item__reassign-empty">本计划下还没有目标</div>
                            ) : (
                              planGoals.map(g => (
                                <button key={g.id}
                                  className={`pd-today-item__reassign-row ${g.id === t.goalId ? "is-current" : ""}`}
                                  onClick={() => reassignTask(t.id, g.id)}>
                                  <span className={`pd-today-item__reassign-scope pd-tree-scope--${g.scope}`}>
                                    {g.scope === "year" ? "年" : g.scope === "month" ? "月" : "周"}
                                  </span>
                                  <span>{g.title}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <button className="pd-today-item__del" onClick={() => delTask(t.id)} title="删除">×</button>
                  </div>
                );
              })}
            </div>
          )}
          </>
        )}
      </div>

      {/* Stage 2.5：GoalModal — 新建 / 编辑目标共用 */}
      {modalOpen && (
        <GoalModal
          defaultScope={modalScope}
          editing={editingGoal ?? undefined}
          lockedPlanId={plan.id}
          lockedPlanTitle={plan.title}
          lockedParentId={modalParent?.id}
          lockedParentTitle={modalParent?.title}
          onSave={handleGoalSave}
          onCancel={closeGoalModal} />
      )}
    </div>
  );
}
