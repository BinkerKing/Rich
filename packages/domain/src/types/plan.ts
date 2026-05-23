// packages/domain/src/types/plan.ts
/**
 * 「计划管理」的顶层抽象：一个 Plan 是用户提的一个高层愿望（例："3 个月减 10 斤"），
 * 独立于年/月/周时间尺度。多个 Plan 并行；每个 Plan 下挂多层 Goal + 天级 Task。
 *
 * 数据层落在 GreatMeState.plans。所有字段都是可序列化的 JSON。
 */
export type PlanScope = "year" | "month" | "week" | "day";
export type PlanStatus = "active" | "archived" | "completed";
export type GoalSource = "user" | "ai" | "ai-confirmed";
export type TaskSource = "user" | "ai" | "ai-template";

export interface Plan {
  id: string;
  title: string;
  detail?: string;
  /** ISO 日期，计划开始 */
  start: string;
  /** ISO 日期，计划结束 */
  end: string;
  scopes: PlanScope[];       // 用到哪些层级，比如 ["month","week","day"] 跳过 year
  status: PlanStatus;
  source: "user" | "ai-decompose";
  createdAt: number;
  archivedAt?: number;
  /** 拆解溯源，可选 */
  aiTrace?: { messageId: string; conversationId: string; decomposedAt: number };
}

/** 量化指标。给 "跑 12km" 这种数值目标用，画曲线/算完成率用 */
export interface Metric {
  unit: string;
  target: number;
  /** 当前累计值；与 target 同单位 */
  actual?: number;
}

/** Goal/Task 上新增的可选字段，老数据全部为 undefined，行为不变 */
export interface PlanLinkage {
  /** 所属 Plan 的 id；老数据 migrate 后填充 */
  planId?: string;
  /** 上一层 Goal 的 id；用于 year→month→week 父子链 */
  parentId?: string;
}
