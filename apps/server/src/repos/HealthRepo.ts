import type {
  HealthProfile,
  WeightEntry,
  WorkoutSession,
  WorkoutSet,
  MealEntry,
  SleepEntry,
  MoodEntry,
  WeeklyPlan,
  WeeklyReport,
  HealthAlert,
  AlertStatus,
  HealthReminder,
} from "@ke/domain";

/**
 * HealthRepo —— 私人健康档案的统一存储接口。所有 health_* 表的访问都走这里。
 * 单一 Repo 设计（不是 9 个小 Repo）：所有 health 实体强耦合且共用 since/until
 * 日期范围查询，集中接口更好用。
 *
 * 时间窗约定：since/until 都是 inclusive，ISO 8601 字符串；不传则默认全表。
 */
export interface HealthRepo {
  // ── 静态档案 ────────────────────────────────────────────────
  getProfile(): Promise<HealthProfile | null>;
  putProfile(p: HealthProfile): Promise<void>;

  // ── 体重 ────────────────────────────────────────────────────
  appendWeight(e: WeightEntry): Promise<void>;
  listWeights(opts?: { since?: string; until?: string; limit?: number }): Promise<WeightEntry[]>;
  deleteWeight(id: string): Promise<void>;

  // ── 训练 ────────────────────────────────────────────────────
  appendWorkout(w: WorkoutSession, sets: WorkoutSet[]): Promise<void>;
  listWorkouts(opts?: { since?: string; until?: string; limit?: number }): Promise<WorkoutSession[]>;
  getWorkoutSets(workoutId: string): Promise<WorkoutSet[]>;
  deleteWorkout(id: string): Promise<void>;

  // ── 饮食 ────────────────────────────────────────────────────
  appendMeal(m: MealEntry): Promise<void>;
  listMeals(opts?: { since?: string; until?: string; limit?: number }): Promise<MealEntry[]>;
  deleteMeal(id: string): Promise<void>;

  // ── 睡眠 ────────────────────────────────────────────────────
  appendSleep(s: SleepEntry): Promise<void>;
  listSleep(opts?: { since?: string; until?: string; limit?: number }): Promise<SleepEntry[]>;

  // ── 主观感受 ────────────────────────────────────────────────
  appendMood(m: MoodEntry): Promise<void>;
  listMoods(opts?: { since?: string; until?: string; limit?: number }): Promise<MoodEntry[]>;

  // ── 周计划 / 周报 ───────────────────────────────────────────
  putWeeklyPlan(p: WeeklyPlan): Promise<void>;
  latestWeeklyPlan(): Promise<WeeklyPlan | null>;
  getWeeklyPlanByStart(weekStart: string): Promise<WeeklyPlan | null>;
  listWeeklyPlans(limit?: number): Promise<WeeklyPlan[]>;

  putWeeklyReport(r: WeeklyReport): Promise<void>;
  latestWeeklyReport(): Promise<WeeklyReport | null>;
  listWeeklyReports(limit?: number): Promise<WeeklyReport[]>;

  // ── 异常报警 ────────────────────────────────────────────────
  appendAlert(a: HealthAlert): Promise<void>;
  listAlerts(opts?: { status?: AlertStatus; limit?: number }): Promise<HealthAlert[]>;
  updateAlertStatus(id: string, status: AlertStatus): Promise<void>;

  // ── 提醒 + 飞书 webhook（state 表，JSON blob，无新表）──────────
  listReminders(): Promise<HealthReminder[]>;
  putReminders(rs: HealthReminder[]): Promise<void>;
  getFeishuWebhook(): Promise<string | null>;
  setFeishuWebhook(url: string | null): Promise<void>;
}
