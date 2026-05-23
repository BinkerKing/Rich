// apps/web/src/views/PlanDetailView.tsx
import { useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { computePlanProgress } from "@ke/domain";
import type { Plan } from "@ke/domain";
import "./PlanDetailView.css";

interface Goal { id: string; scope: "year"|"month"|"week"; title: string; progress: number; planId?: string; createdAt: number; detail: string; phase: string; due: string }
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
  const progress = useMemo(() => computePlanProgress(plan.id, state.goals as Parameters<typeof computePlanProgress>[1]), [plan.id, state.goals]);

  const planGoals = state.goals.filter(g => g.planId === plan.id);
  const planTasks = state.tasks.filter(t => planGoals.some(g => g.id === t.goalId));
  const todayTasks = planTasks.filter(t => t.date === new Date().toISOString().slice(0, 10));

  const toggleTask = (id: string): void => setState(prev => ({
    ...prev,
    tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t),
  } as S));
  const delTask = (id: string): void => setState(prev => ({
    ...prev,
    tasks: prev.tasks.filter(t => t.id !== id),
  } as S));

  const renderKanban = (scope: "month"|"week"): ReactNode => {
    const scoped = planGoals.filter(g => g.scope === scope);
    const planned = scoped.filter(g => g.progress === 0);
    const active  = scoped.filter(g => g.progress > 0 && g.progress < 100);
    const done    = scoped.filter(g => g.progress >= 100);
    const col = (title: string, list: Goal[]): ReactNode => (
      <div className="pd-kanban-col">
        <div className="pd-kanban-col__head">
          <span className="pd-kanban-col__title">{title}</span>
          <span className="pd-kanban-col__count">{list.length}</span>
        </div>
        {list.length === 0 ? (
          <div className="pd-empty" style={{ padding: 24, fontSize: 12 }}>暂无</div>
        ) : list.map(g => (
          <div key={g.id} className="pd-kanban-card">
            <div className="pd-kanban-card__title">{g.title}</div>
            <div className="pd-kanban-card__bar"><span style={{ width: `${g.progress}%` }} /></div>
            <div className="pd-kanban-card__pct">{g.progress}%</div>
          </div>
        ))}
      </div>
    );
    return (
      <div className="pd-kanban">
        {col("计划中", planned)}
        {col("正在进行", active)}
        {col("已完成", done)}
      </div>
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
          <div className="pd-empty">
            <div className="pd-empty__title">总览（待开发）</div>
            <div className="pd-empty__sub">这里以后会显示里程碑节点、跨月趋势、关联事件。</div>
            <div className="pd-empty__stats">月目标 {planGoals.filter(g => g.scope === "month").length} · 周目标 {planGoals.filter(g => g.scope === "week").length} · 今日任务 {todayTasks.length}</div>
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
