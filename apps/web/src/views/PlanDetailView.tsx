// apps/web/src/views/PlanDetailView.tsx
import { useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { computePlanProgress } from "@ke/domain";
import type { Plan } from "@ke/domain";
import "./PlanDetailView.css";

interface Goal { id: string; scope: "year"|"month"|"week"; title: string; progress: number; planId?: string; parentId?: string; createdAt: number; detail: string; phase: string; due: string }
interface Task { id: string; title: string; done: boolean; date: string; goalId: string; badge: string; note: string }
interface PartialState { plans: Plan[]; goals: Goal[]; tasks: Task[] }

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

  const progress = useMemo(() => computePlanProgress(plan.id, state.goals as Parameters<typeof computePlanProgress>[1]), [plan.id, state.goals]);

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

  /** 递归渲染单个目标节点 + 子目标 + 关联任务。深度决定缩进。 */
  const renderTreeNode = (goal: Goal, depth: number): ReactNode => {
    const children = planGoals
      .filter(g => g.parentId === goal.id)
      .sort((a, b) => a.due.localeCompare(b.due));
    const goalTasks = planTasks
      .filter(t => t.goalId === goal.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const scopeLabel = goal.scope === "year" ? "年" : goal.scope === "month" ? "月" : "周";

    // 汇总文案：周 = 任务完成数；月/年 = 子目标完成数
    let summary = "";
    if (children.length > 0) {
      const doneKids = children.filter(c => c.progress >= 100).length;
      const childWord = children[0].scope === "month" ? "月" : children[0].scope === "week" ? "周" : "目标";
      summary = `${doneKids} / ${children.length} 个${childWord}完成`;
    } else if (goalTasks.length > 0) {
      const doneT = goalTasks.filter(t => t.done).length;
      summary = `${doneT} / ${goalTasks.length} 任务完成`;
    }

    return (
      <div key={goal.id} className="pd-tree-node">
        <div className="pd-tree-row" style={{ paddingLeft: depth * 22 }}>
          {depth > 0 && <span className="pd-tree-edge" aria-hidden>└─</span>}
          <span className={`pd-tree-scope pd-tree-scope--${goal.scope}`}>{scopeLabel}</span>
          <span className="pd-tree-title">{goal.title}</span>
          <div className="pd-tree-bar"><span style={{ width: `${goal.progress}%` }} /></div>
          <span className="pd-tree-pct">{goal.progress}%</span>
          {summary && <span className="pd-tree-summary">{summary}</span>}
        </div>
        {children.map(c => renderTreeNode(c, depth + 1))}
        {goalTasks.length > 0 && goalTasks.map(t => (
          <div key={t.id} className={`pd-tree-task ${t.done ? "is-done" : ""}`}
            style={{ paddingLeft: (depth + 1) * 22 }}>
            <span className="pd-tree-edge" aria-hidden>└─</span>
            <span className={`pd-tree-task__check ${t.done ? "is-done" : ""}`}>{t.done ? "✓" : ""}</span>
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
    const planned = scoped.filter(g => g.progress === 0);
    const active  = scoped.filter(g => g.progress > 0 && g.progress < 100);
    const done    = scoped.filter(g => g.progress >= 100);
    const childScope: "month"|"week"|null = scope === "month" ? "week" : null;

    const card = (g: Goal): ReactNode => {
      const parent = g.parentId ? planGoals.find(x => x.id === g.parentId) : null;
      const kidCount = childScope ? childCount(g.id, childScope) : 0;
      const tc = taskCount(g.id);
      return (
        <div key={g.id} className="pd-kanban-card">
          {parent && (
            <div className="pd-kanban-card__parent" title={`属于：${parent.title}`}>
              ↑ {parent.title}
            </div>
          )}
          <div className="pd-kanban-card__title">{g.title}</div>
          <div className="pd-kanban-card__bar"><span style={{ width: `${g.progress}%` }} /></div>
          <div className="pd-kanban-card__foot">
            <div className="pd-kanban-card__links">
              {childScope && kidCount > 0 && (
                <button className="pd-kanban-card__drill"
                  title={`查看下属 ${kidCount} 个周计划`}
                  onClick={() => drillToChildren(g.id, childScope)}>
                  ↓ {kidCount} 个周计划
                </button>
              )}
              {tc.total > 0 && (
                <span className="pd-kanban-card__tasks" title={`关联 ${tc.done}/${tc.total} 个任务`}>
                  ◇ {tc.done}/{tc.total} 任务
                </span>
              )}
            </div>
            <span className="pd-kanban-card__pct">{g.progress}%</span>
          </div>
        </div>
      );
    };

    const col = (title: string, list: Goal[]): ReactNode => (
      <div className="pd-kanban-col">
        <div className="pd-kanban-col__head">
          <span className="pd-kanban-col__title">{title}</span>
          <span className="pd-kanban-col__count">{list.length}</span>
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
          todayTasks.length === 0 ? (
            <div className="pd-empty">
              <div className="pd-empty__title">今日任务</div>
              <div className="pd-empty__sub">该计划下今天还没有具体任务。</div>
            </div>
          ) : (
            <div className="pd-today">
              {todayTasks.map(t => {
                const goal = planGoals.find(g => g.id === t.goalId);
                return (
                  <div key={t.id} className={`pd-today-item ${t.done ? "is-done" : ""}`}>
                    <button className={`pd-today-item__check ${t.done ? "is-done" : ""}`}
                      onClick={() => toggleTask(t.id)}
                      title={t.done ? "标记未完成" : "标记完成"}>
                      {t.done ? "✓" : ""}
                    </button>
                    <span className="pd-today-item__title">{t.title}</span>
                    {goal && (
                      <span className="pd-today-item__goal">
                        {goal.scope === "year" ? "年" : goal.scope === "month" ? "月" : "周"}·{goal.title.length > 10 ? goal.title.slice(0, 10) + "…" : goal.title}
                      </span>
                    )}
                    <button className="pd-today-item__del" onClick={() => delTask(t.id)} title="删除">×</button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
