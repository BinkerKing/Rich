// apps/web/src/lib/analytics.ts
//
// 推进分析的纯计算函数。
// 数据 → 健康度 / 卡点列表。无 IO，便于单测，UI 只渲染。
import { computePlanProgress } from "@ke/domain";

// 局部类型镜像 GreatMeView 中的 Goal/Task/Plan 形状（不复用是因为 GreatMeView
// 把它们当 interface 局部声明了；这里只取我们需要的字段，宽容一点）
export interface AnalyzableTask {
  id: string;
  title: string;
  done: boolean;
  date: string;
  goalId: string;
}
export interface AnalyzableGoal {
  id: string;
  scope: "year" | "month" | "week";
  title: string;
  planId?: string;
  parentId?: string;
  progress: number;
  due: string;
}
export interface AnalyzablePlan {
  id: string;
  title: string;
  start: string;
  end: string;
  status: "active" | "archived" | "completed";
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayYmd = (): string => ymd(new Date());

// =========================================================
// 计划健康度
// =========================================================
export type PlanHealthStatus = "completed" | "healthy" | "behind" | "critical" | "no-time";

export interface PlanHealth {
  plan: AnalyzablePlan;
  progress: number;           // 真实进度（task 完成度递归算出来）0-100
  timeProgress: number;       // 时间已过百分比 0-100
  delta: number;              // progress - timeProgress（>0=提前，<0=落后）
  status: PlanHealthStatus;
  weekDone: number;           // 本周完成任务数
  weekTotal: number;          // 本周任务总数
  daysLeft: number;           // 距离截止天数（负数=过期）
}

/** 把一个 plan 加工成 PlanHealth。完成度走 computePlanProgress(... tasks)，即时计算。 */
export function computePlanHealth(
  plan: AnalyzablePlan,
  goals: AnalyzableGoal[],
  tasks: AnalyzableTask[],
): PlanHealth {
  const progress = computePlanProgress(plan.id, goals, tasks);

  let timeProgress = 0;
  let validTime = false;
  if (plan.start && plan.end) {
    const startMs = Date.parse(plan.start);
    const endMs = Date.parse(plan.end);
    const totalMs = endMs - startMs;
    if (totalMs > 0) {
      const elapsed = Date.now() - startMs;
      timeProgress = Math.max(0, Math.min(100, Math.round((elapsed / totalMs) * 100)));
      validTime = true;
    }
  }

  const delta = progress - timeProgress;
  let status: PlanHealthStatus;
  if (progress >= 100) status = "completed";
  else if (!validTime) status = "no-time";
  else if (delta >= -5) status = "healthy";
  else if (delta >= -20) status = "behind";
  else status = "critical";

  // 本周任务（周一 - 周日）
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;  // 周一=0
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStartYmd = ymd(weekStart);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndYmd = ymd(weekEnd);

  const planGoalIds = new Set(goals.filter(g => g.planId === plan.id).map(g => g.id));
  const weekTasksList = tasks.filter(t =>
    planGoalIds.has(t.goalId) && t.date >= weekStartYmd && t.date <= weekEndYmd
  );
  const weekDone = weekTasksList.filter(t => t.done).length;
  const weekTotal = weekTasksList.length;

  let daysLeft = 0;
  if (plan.end) {
    daysLeft = Math.ceil((Date.parse(plan.end) - Date.now()) / 86400000);
  }

  return { plan, progress, timeProgress, delta, status, weekDone, weekTotal, daysLeft };
}

// =========================================================
// 4 类卡点
// =========================================================

/** 逾期未完成：date < today 且 done=false。按日期升序（最久的在最前）。 */
export function findOverdueTasks(tasks: AnalyzableTask[]): AnalyzableTask[] {
  const today = todayYmd();
  return tasks
    .filter(t => !t.done && t.date && t.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 长时间未推进的目标：有任务但近 N 天没有任何任务被完成；且整体未完成。 */
export function findStuckGoals(
  goals: AnalyzableGoal[],
  tasks: AnalyzableTask[],
  days = 14,
): AnalyzableGoal[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffYmd = ymd(cutoff);
  return goals.filter(g => {
    const goalTasks = tasks.filter(t => t.goalId === g.id);
    if (goalTasks.length === 0) return false;          // 没任务 → 走下面的 bucket
    const recentlyDone = goalTasks.some(t => t.done && t.date >= cutoffYmd);
    if (recentlyDone) return false;
    const allDone = goalTasks.every(t => t.done);
    if (allDone) return false;
    return true;
  });
}

/** 叶节点目标（没有子目标）但没有任务的：进度永远 0%，是死目标。 */
export function findGoalsWithoutTasks(
  goals: AnalyzableGoal[],
  tasks: AnalyzableTask[],
): AnalyzableGoal[] {
  return goals.filter(g => {
    const hasChildren = goals.some(x => x.parentId === g.id);
    if (hasChildren) return false;
    const hasTasks = tasks.some(t => t.goalId === g.id);
    return !hasTasks;
  });
}

/** 没挂目标的任务：不计入任何 plan 进度，需要补挂。只看未完成的（已完成的就算了）。 */
export function findOrphanTasks(
  tasks: AnalyzableTask[],
  goals: AnalyzableGoal[],
): AnalyzableTask[] {
  const goalIds = new Set(goals.map(g => g.id));
  return tasks.filter(t => !t.done && (!t.goalId || !goalIds.has(t.goalId)));
}

// =========================================================
// 顶部 KPI
// =========================================================
export interface OverallKPIs {
  activePlans: number;
  weekDone: number;
  weekTotal: number;
  overallProgress: number;     // 加权平均所有活跃 plan 的进度
  streak: number;              // 连续完成天数（至少 1 个 task 完成那天才算）
}

export function computeOverallKPIs(
  plans: AnalyzablePlan[],
  goals: AnalyzableGoal[],
  tasks: AnalyzableTask[],
): OverallKPIs {
  const active = plans.filter(p => p.status === "active");

  // overall progress = active plan 的平均进度
  const overallProgress = active.length === 0
    ? 0
    : Math.round(active.reduce((acc, p) => acc + computePlanProgress(p.id, goals, tasks), 0) / active.length);

  // 本周完成
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStartYmd = ymd(weekStart);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndYmd = ymd(weekEnd);
  const weekTasks = tasks.filter(t => t.date >= weekStartYmd && t.date <= weekEndYmd);

  // streak: 从今天往前数，连续每天至少 1 个 done task
  const doneDates = new Set(tasks.filter(t => t.done).map(t => t.date));
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i++) {
    if (doneDates.has(ymd(cursor))) streak++;
    else if (i > 0) break;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    activePlans: active.length,
    weekDone: weekTasks.filter(t => t.done).length,
    weekTotal: weekTasks.length,
    overallProgress,
    streak,
  };
}
