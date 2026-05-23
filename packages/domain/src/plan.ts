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

/** 占位实现，下一个 task 才真正实现 */
export function computePlanProgress(_planId: string, _goals: GoalLike[]): number {
  return 0;
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
