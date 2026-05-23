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

export function PlanDetailView<S extends PartialState>({ plan, state, onBack }: Props<S>): ReactNode {
  const [tab, setTab] = useState<TabId>("today");
  const progress = useMemo(() => computePlanProgress(plan.id, state.goals as Parameters<typeof computePlanProgress>[1]), [plan.id, state.goals]);

  const planGoals = state.goals.filter(g => g.planId === plan.id);
  const planTasks = state.tasks.filter(t => planGoals.some(g => g.id === t.goalId));
  const todayTasks = planTasks.filter(t => t.date === new Date().toISOString().slice(0, 10));

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
        {tab === "month" && (
          <div className="pd-empty">
            <div className="pd-empty__title">月度目标</div>
            <div className="pd-empty__sub">{planGoals.filter(g => g.scope === "month").length} 个月目标。Kanban 视图待接入。</div>
          </div>
        )}
        {tab === "week" && (
          <div className="pd-empty">
            <div className="pd-empty__title">周度目标</div>
            <div className="pd-empty__sub">{planGoals.filter(g => g.scope === "week").length} 个周目标。Kanban 视图待接入。</div>
          </div>
        )}
        {tab === "today" && (
          <div className="pd-empty">
            <div className="pd-empty__title">今日任务</div>
            <div className="pd-empty__sub">{todayTasks.length} 条。任务列表待接入。</div>
          </div>
        )}
      </div>
    </div>
  );
}
