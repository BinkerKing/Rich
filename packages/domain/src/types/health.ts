/**
 * Body Insights —— 私人健康档案的 domain 类型。
 *
 * 单用户 MVP（user_id 固定 'me'）。所有时间字段用 ISO 8601 字符串。
 * 数据库表名对应：health_profile / health_weight_log / health_workout_log /
 * health_workout_set / health_meal_log / health_sleep_log / health_mood_log /
 * health_weekly_plan / health_weekly_report / health_alert。
 */

// ── 静态档案 ────────────────────────────────────────────────────
export type HealthSex = "male" | "female" | "other";
export type HealthGoal = "cut" | "maintain" | "bulk";
export type HealthActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very-active";

export interface HealthProfile {
  userId: string;            // 单用户 MVP 固定 'me'
  heightCm?: number;
  sex?: HealthSex;
  dob?: string;              // ISO date
  goal?: HealthGoal;
  activityLevel?: HealthActivityLevel;
  targetWeightKg?: number;
  healthNotes?: string;
  allergies?: string;
  updatedAt: string;
}

// ── 体重 ────────────────────────────────────────────────────────
export type WeightSource = "manual" | "apple-health" | "smart-scale" | "ai-photo";

export interface WeightEntry {
  id: string;
  loggedAt: string;           // ISO datetime
  kg: number;
  bodyFatPct?: number;
  notes?: string;
  source: WeightSource;
  createdAt: string;
}

// ── 训练 ────────────────────────────────────────────────────────
export interface WorkoutSet {
  id: string;
  workoutId: string;
  exercise: string;           // e.g. "Bench Press"
  reps?: number;
  weightKg?: number;
  rpe?: number;               // 1-10
  orderIndex: number;
  notes?: string;
}

export type WorkoutSource = "manual" | "ai-text" | "apple-watch";

export interface WorkoutSession {
  id: string;
  sessionName?: string;       // "推 / 拉 / 腿" or "周二上肢"
  performedAt: string;        // ISO datetime
  durationMin?: number;
  totalVolume?: number;       // sum(weight × reps)
  rpeAvg?: number;
  notes?: string;
  source: WorkoutSource;
  createdAt: string;
}

// ── 饮食 ────────────────────────────────────────────────────────
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type MealSource = "manual" | "ai-text" | "ai-photo";

export interface MealItem {
  name: string;               // e.g. "鸡胸"
  grams?: number;             // 估计分量
  kcal?: number;
  proteinG?: number;
  carbG?: number;
  fatG?: number;
  fiberG?: number;
  /** AI 给的置信度（0..1），用户可校准 */
  confidence?: number;
}

export interface MealEntry {
  id: string;
  consumedAt: string;
  mealType?: MealType;
  items: MealItem[];
  totalKcal?: number;
  totalProteinG?: number;
  totalCarbG?: number;
  totalFatG?: number;
  totalFiberG?: number;
  photoUrl?: string;
  source: MealSource;
  notes?: string;
  createdAt: string;
}

// ── 睡眠 ────────────────────────────────────────────────────────
export type SleepSource = "manual" | "apple-watch" | "apple-health";

export interface SleepEntry {
  id: string;
  sleepDate: string;          // 该夜入睡日期（ISO date）
  durationMin?: number;
  quality?: number;           // 1-10
  bedtime?: string;
  wakeTime?: string;
  notes?: string;
  source: SleepSource;
  createdAt: string;
}

// ── 主观感受 ────────────────────────────────────────────────────
export interface MoodEntry {
  id: string;
  loggedAt: string;
  energy?: number;            // 1-10
  mood?: number;
  fatigue?: number;
  soreness?: number;
  notes?: string;
  createdAt: string;
}

// ── 周计划 + 周报 ───────────────────────────────────────────────
export type WeeklyPlanStatus = "draft" | "active" | "archived";

export interface WeeklyPlan {
  id: string;
  weekStart: string;          // ISO date, 周一
  goalSnapshot?: string;      // 当时档案 goal 快照
  dietPlan?: string;          // markdown
  trainingPlan?: string;      // markdown
  notes?: string;
  generatedAt: string;
  generatedBy: "ai" | "user";
  status: WeeklyPlanStatus;
}

export interface WeeklyReportMetrics {
  weightAvg?: number;
  weightDelta?: number;       // 与上周比的 kg 变化
  kcalAvg?: number;
  proteinAvg?: number;
  trainingSessions?: number;
  trainingVolume?: number;
  sleepAvgHours?: number;
}

export interface WeeklyReport {
  id: string;
  weekStart: string;
  body: string;               // markdown 周报正文
  metrics?: WeeklyReportMetrics;
  generatedAt: string;
}

// ── 异常报警 ────────────────────────────────────────────────────
export type AlertKind =
  | "weight-spike"
  | "weight-drop"
  | "low-protein"
  | "low-kcal"
  | "overtrain"
  | "low-sleep"
  | "missed-training"
  | "rhr-rising"
  | "custom";

export type AlertSeverity = "low" | "medium" | "high";
export type AlertStatus = "open" | "acknowledged" | "dismissed";

export interface HealthAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  context?: Record<string, unknown>;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
}

// ── 提醒 ────────────────────────────────────────────────────────
export type ReminderKind = "workout" | "water" | "meds" | "sleep" | "meal" | "custom";
export type ReminderChannel = "feishu" | "screen" | "inapp";
/** V0.1 仅支持「每天固定时间点」(daily) 或「按间隔分钟」(interval)。复杂 cron 留 V0.2。 */
export type ReminderScheduleKind = "daily" | "interval";

export interface ReminderSchedule {
  kind: ReminderScheduleKind;
  /** daily: "HH:mm"（例 "09:00"）；interval: 仅 intervalMin 生效 */
  time?: string;
  /** interval: 间隔分钟。例 90 = 每 90 分钟 */
  intervalMin?: number;
}

export interface HealthReminder {
  id: string;
  kind: ReminderKind;
  title: string;                  // banner 标题
  body?: string;                  // banner 正文
  schedule: ReminderSchedule;
  channels: ReminderChannel[];
  enabled: boolean;
  /** 上次成功触发的 ISO 时间（用于避免同一分钟重复触发） */
  lastFiredAt?: string;
  createdAt: string;
  updatedAt: string;
}
