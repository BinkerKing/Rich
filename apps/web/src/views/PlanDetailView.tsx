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
          <div className="pd-overview">
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
