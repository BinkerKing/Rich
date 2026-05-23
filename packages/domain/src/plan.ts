/**
 * 「计划管理」相关的纯函数：迁移、进度计算、范围判定。
 * 都是 in/out 数据变换，不碰 IO，便于 vitest 单测。
 */
import type { Plan, PlanScope } from "./types/plan.js";

/** 兜底计划的固定 id，迁移和读取都用这个常量 */
export const UNSORTED_PLAN_ID = "unsorted";

interface GoalLike { id: string; planId?: string }
interface StateLike {
  plans?: Plan[];
  goals: GoalLike[];
}

/**
 * 把任何 goal.planId 缺失的旧数据，归到一个 id="unsorted" 的兜底 plan。
 * 幂等：state 里已经有 unsorted plan 就直接复用。
 * goals 全部已挂载时不会建 unsorted plan。
 */
export function migrateLegacyGoals<S extends StateLike>(state: S): S {
  const plans = [...(state.plans ?? [])];
  const orphans = state.goals.filter(g => !g.planId);

  if (orphans.length === 0) {
    return { ...state, plans };
  }

  const hasUnsorted = plans.some(p => p.id === UNSORTED_PLAN_ID);
  if (!hasUnsorted) {
    plans.push({
      id: UNSORTED_PLAN_ID,
      title: "未分组",
      start: "",
      end: "",
      scopes: ["year", "month", "week", "day"],
      status: "active",
      source: "user",
      createdAt: Date.now(),
    });
  }
  const goals = state.goals.map(g => g.planId ? g : { ...g, planId: UNSORTED_PLAN_ID });
  return { ...state, plans, goals };
}

interface ScopedGoal { id: string; planId?: string; parentId?: string; scope: "year"|"month"|"week"; progress: number }
interface TaskLike { goalId: string; done: boolean }

/**
 * 计算单个目标的实时进度（递归）：
 * - 有子目标：取所有子目标 computeGoalProgress 的平均
 * - 无子目标但有任务：done 任务数 / 总任务数 * 100
 * - 都没有：回退到 goal.progress（手动维护的兜底）
 *
 * 这样 toggle 一条 task 完成度，整棵树（周→月→年→plan）的百分比都跟着动。
 */
export function computeGoalProgress(
  goalId: string,
  goals: ScopedGoal[],
  tasks: TaskLike[],
): number {
  const children = goals.filter(g => g.parentId === goalId);
  if (children.length > 0) {
    const sum = children.reduce((acc, c) => acc + computeGoalProgress(c.id, goals, tasks), 0);
    return Math.round(sum / children.length);
  }
  const ts = tasks.filter(t => t.goalId === goalId);
  if (ts.length > 0) {
    const done = ts.filter(t => t.done).length;
    return Math.round((done / ts.length) * 100);
  }
  const g = goals.find(x => x.id === goalId);
  return g?.progress ?? 0;
}

/**
 * 计算某个 plan 的进度：取最细一层有 goal 的 scope，对所有 goal.progress 求平均（四舍五入）。
 * - week 有 goal → 平均 week 的 progress
 * - 否则 month → 平均 month
 * - 否则 year → 平均 year
 * - 都没有 → 0
 *
 * 若传入 tasks（可选），改用 computeGoalProgress 实时算 task 完成率；不传 tasks 时
 * 保留旧行为（直接读 goal.progress），确保现有测试 / 老调用站不破。
 */
export function computePlanProgress(planId: string, goals: ScopedGoal[], tasks: TaskLike[] = []): number {
  const mine = goals.filter(g => g.planId === planId);
  if (mine.length === 0) return 0;
  const byScope = (s: "year"|"month"|"week"): ScopedGoal[] => mine.filter(g => g.scope === s);
  const pick = byScope("week").length > 0 ? byScope("week")
             : byScope("month").length > 0 ? byScope("month")
             : byScope("year");
  if (pick.length === 0) return 0;
  const useDynamic = tasks.length > 0;
  const sum = pick.reduce((acc, g) =>
    acc + (useDynamic ? computeGoalProgress(g.id, goals, tasks) : g.progress), 0);
  return Math.round(sum / pick.length);
}

/** 一个月按多少天近似计算。v1 简化处理，不做日历感知 */
const DAYS_PER_MONTH = 30;

/**
 * 根据 plan 的起止日期推断该 plan 该用到哪些 scope。
 * - 没填起止 → 全部 4 层（年/月/周/日）作为兜底
 * - 跨度 ≥ 2 个月 → 含 month
 * - 跨度 ≥ 12 个月 → 含 year
 * - 周/日始终包含
 */
export function planScopes(start: string, end: string): PlanScope[] {
  if (!start || !end) return ["year", "month", "week", "day"];
  const startMs = Date.parse(start);
  const endMs   = Date.parse(end);
  const months  = Math.ceil((endMs - startMs) / (DAYS_PER_MONTH * 86400000));
  const scopes: PlanScope[] = ["day", "week"];
  if (months >= 2) scopes.push("month");
  if (months >= 12) scopes.unshift("year");
  return scopes;
}
