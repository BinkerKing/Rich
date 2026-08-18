import type { PgPool } from "../db/postgres.js";
import type {
  HealthProfile,
  WeightEntry,
  WorkoutSession,
  WorkoutSet,
  MealEntry,
  MealItem,
  SleepEntry,
  MoodEntry,
  WeeklyPlan,
  WeeklyReport,
  HealthAlert,
  AlertStatus,
  HealthReminder,
  HealthSex,
  HealthGoal,
  HealthActivityLevel,
  MealType,
  WeightSource,
  WorkoutSource,
  MealSource,
  SleepSource,
  AlertKind,
  AlertSeverity,
  WeeklyPlanStatus,
  WeeklyReportMetrics,
} from "@ke/domain";
import type { HealthRepo } from "./HealthRepo.js";

/* ── row → domain mappers ───────────────────────────────────────── */

interface ProfileRow {
  user_id: string;
  height_cm: number | null;
  sex: string | null;
  dob: string | null;
  goal: string | null;
  activity_level: string | null;
  target_weight_kg: number | null;
  health_notes: string | null;
  allergies: string | null;
  updated_at: string;
}
function rowToProfile(r: ProfileRow): HealthProfile {
  return {
    userId: r.user_id,
    heightCm: r.height_cm ?? undefined,
    sex: (r.sex as HealthSex | null) ?? undefined,
    dob: r.dob ?? undefined,
    goal: (r.goal as HealthGoal | null) ?? undefined,
    activityLevel: (r.activity_level as HealthActivityLevel | null) ?? undefined,
    targetWeightKg: r.target_weight_kg ?? undefined,
    healthNotes: r.health_notes ?? undefined,
    allergies: r.allergies ?? undefined,
    updatedAt: r.updated_at,
  };
}

interface WeightRow {
  id: string;
  logged_at: string;
  kg: number;
  body_fat_pct: number | null;
  notes: string | null;
  source: string;
  created_at: string;
}
function rowToWeight(r: WeightRow): WeightEntry {
  return {
    id: r.id,
    loggedAt: r.logged_at,
    kg: r.kg,
    bodyFatPct: r.body_fat_pct ?? undefined,
    notes: r.notes ?? undefined,
    source: r.source as WeightSource,
    createdAt: r.created_at,
  };
}

interface WorkoutRow {
  id: string;
  session_name: string | null;
  performed_at: string;
  duration_min: number | null;
  total_volume: number | null;
  rpe_avg: number | null;
  notes: string | null;
  source: string;
  created_at: string;
}
function rowToWorkout(r: WorkoutRow): WorkoutSession {
  return {
    id: r.id,
    sessionName: r.session_name ?? undefined,
    performedAt: r.performed_at,
    durationMin: r.duration_min ?? undefined,
    totalVolume: r.total_volume ?? undefined,
    rpeAvg: r.rpe_avg ?? undefined,
    notes: r.notes ?? undefined,
    source: r.source as WorkoutSource,
    createdAt: r.created_at,
  };
}

interface SetRow {
  id: string;
  workout_id: string;
  exercise: string;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  order_index: number;
  notes: string | null;
}
function rowToSet(r: SetRow): WorkoutSet {
  return {
    id: r.id,
    workoutId: r.workout_id,
    exercise: r.exercise,
    reps: r.reps ?? undefined,
    weightKg: r.weight_kg ?? undefined,
    rpe: r.rpe ?? undefined,
    orderIndex: r.order_index,
    notes: r.notes ?? undefined,
  };
}

interface MealRow {
  id: string;
  consumed_at: string;
  meal_type: string | null;
  items: unknown;                       // JSONB 自动反序列化
  total_kcal: number | null;
  total_protein_g: number | null;
  total_carb_g: number | null;
  total_fat_g: number | null;
  total_fiber_g: number | null;
  photo_url: string | null;
  source: string;
  notes: string | null;
  created_at: string;
}
function rowToMeal(r: MealRow): MealEntry {
  return {
    id: r.id,
    consumedAt: r.consumed_at,
    mealType: (r.meal_type as MealType | null) ?? undefined,
    items: (r.items as MealItem[]) ?? [],
    totalKcal: r.total_kcal ?? undefined,
    totalProteinG: r.total_protein_g ?? undefined,
    totalCarbG: r.total_carb_g ?? undefined,
    totalFatG: r.total_fat_g ?? undefined,
    totalFiberG: r.total_fiber_g ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    source: r.source as MealSource,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

interface SleepRow {
  id: string;
  sleep_date: string;
  duration_min: number | null;
  quality: number | null;
  bedtime: string | null;
  wake_time: string | null;
  notes: string | null;
  source: string;
  created_at: string;
}
function rowToSleep(r: SleepRow): SleepEntry {
  return {
    id: r.id,
    sleepDate: r.sleep_date,
    durationMin: r.duration_min ?? undefined,
    quality: r.quality ?? undefined,
    bedtime: r.bedtime ?? undefined,
    wakeTime: r.wake_time ?? undefined,
    notes: r.notes ?? undefined,
    source: r.source as SleepSource,
    createdAt: r.created_at,
  };
}

interface MoodRow {
  id: string;
  logged_at: string;
  energy: number | null;
  mood: number | null;
  fatigue: number | null;
  soreness: number | null;
  notes: string | null;
  created_at: string;
}
function rowToMood(r: MoodRow): MoodEntry {
  return {
    id: r.id,
    loggedAt: r.logged_at,
    energy: r.energy ?? undefined,
    mood: r.mood ?? undefined,
    fatigue: r.fatigue ?? undefined,
    soreness: r.soreness ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

interface PlanRow {
  id: string;
  week_start: string;
  goal_snapshot: string | null;
  diet_plan: string | null;
  training_plan: string | null;
  notes: string | null;
  generated_at: string;
  generated_by: string;
  status: string;
}
function rowToPlan(r: PlanRow): WeeklyPlan {
  return {
    id: r.id,
    weekStart: r.week_start,
    goalSnapshot: r.goal_snapshot ?? undefined,
    dietPlan: r.diet_plan ?? undefined,
    trainingPlan: r.training_plan ?? undefined,
    notes: r.notes ?? undefined,
    generatedAt: r.generated_at,
    generatedBy: r.generated_by as "ai" | "user",
    status: r.status as WeeklyPlanStatus,
  };
}

interface ReportRow {
  id: string;
  week_start: string;
  body: string;
  metrics: unknown;
  generated_at: string;
}
function rowToReport(r: ReportRow): WeeklyReport {
  return {
    id: r.id,
    weekStart: r.week_start,
    body: r.body,
    metrics: (r.metrics as WeeklyReportMetrics | null) ?? undefined,
    generatedAt: r.generated_at,
  };
}

interface AlertRow {
  id: string;
  kind: string;
  severity: string;
  message: string;
  context: unknown;
  status: string;
  created_at: string;
  acknowledged_at: string | null;
}
function rowToAlert(r: AlertRow): HealthAlert {
  return {
    id: r.id,
    kind: r.kind as AlertKind,
    severity: r.severity as AlertSeverity,
    message: r.message,
    context: (r.context as Record<string, unknown> | null) ?? undefined,
    status: r.status as AlertStatus,
    createdAt: r.created_at,
    acknowledgedAt: r.acknowledged_at ?? undefined,
  };
}

/* ── 范围 SQL 构造小帮手 ─────────────────────────────────────────── */
function buildRange(field: string, opts: { since?: string; until?: string; limit?: number } | undefined) {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts?.since) {
    args.push(opts.since);
    where.push(`${field} >= $${args.length}`);
  }
  if (opts?.until) {
    args.push(opts.until);
    where.push(`${field} <= $${args.length}`);
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 5000);
  args.push(limit);
  const limitSql = ` LIMIT $${args.length}`;
  return { whereSql, limitSql, args };
}

/* ── PostgresHealthRepo ─────────────────────────────────────────── */

export class PostgresHealthRepo implements HealthRepo {
  constructor(private pool: PgPool) {}

  // profile
  async getProfile(): Promise<HealthProfile | null> {
    const { rows } = await this.pool.query<ProfileRow>(
      "SELECT * FROM health_profile WHERE user_id = 'me'",
    );
    return rows[0] ? rowToProfile(rows[0]) : null;
  }

  async putProfile(p: HealthProfile): Promise<void> {
    await this.pool.query(`
      INSERT INTO health_profile
        (user_id, height_cm, sex, dob, goal, activity_level,
         target_weight_kg, health_notes, allergies, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id) DO UPDATE SET
        height_cm        = EXCLUDED.height_cm,
        sex              = EXCLUDED.sex,
        dob              = EXCLUDED.dob,
        goal             = EXCLUDED.goal,
        activity_level   = EXCLUDED.activity_level,
        target_weight_kg = EXCLUDED.target_weight_kg,
        health_notes     = EXCLUDED.health_notes,
        allergies        = EXCLUDED.allergies,
        updated_at       = EXCLUDED.updated_at
    `, [
      p.userId,
      p.heightCm ?? null,
      p.sex ?? null,
      p.dob ?? null,
      p.goal ?? null,
      p.activityLevel ?? null,
      p.targetWeightKg ?? null,
      p.healthNotes ?? null,
      p.allergies ?? null,
      p.updatedAt,
    ]);
  }

  // weight
  async appendWeight(e: WeightEntry): Promise<void> {
    await this.pool.query(`
      INSERT INTO health_weight_log
        (id, logged_at, kg, body_fat_pct, notes, source, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING
    `, [
      e.id, e.loggedAt, e.kg,
      e.bodyFatPct ?? null, e.notes ?? null, e.source, e.createdAt,
    ]);
  }

  async listWeights(opts?: { since?: string; until?: string; limit?: number }): Promise<WeightEntry[]> {
    const { whereSql, limitSql, args } = buildRange("logged_at", opts);
    const { rows } = await this.pool.query<WeightRow>(
      `SELECT * FROM health_weight_log${whereSql} ORDER BY logged_at DESC${limitSql}`,
      args,
    );
    return rows.map(rowToWeight);
  }

  async deleteWeight(id: string): Promise<void> {
    await this.pool.query("DELETE FROM health_weight_log WHERE id = $1", [id]);
  }

  // workout
  async appendWorkout(w: WorkoutSession, sets: WorkoutSet[]): Promise<void> {
    await this.pool.query(`
      INSERT INTO health_workout_log
        (id, session_name, performed_at, duration_min, total_volume, rpe_avg, notes, source, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `, [
      w.id, w.sessionName ?? null, w.performedAt,
      w.durationMin ?? null, w.totalVolume ?? null, w.rpeAvg ?? null,
      w.notes ?? null, w.source, w.createdAt,
    ]);
    for (const s of sets) {
      await this.pool.query(`
        INSERT INTO health_workout_set
          (id, workout_id, exercise, reps, weight_kg, rpe, order_index, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [
        s.id, s.workoutId, s.exercise,
        s.reps ?? null, s.weightKg ?? null, s.rpe ?? null,
        s.orderIndex, s.notes ?? null,
      ]);
    }
  }

  async listWorkouts(opts?: { since?: string; until?: string; limit?: number }): Promise<WorkoutSession[]> {
    const { whereSql, limitSql, args } = buildRange("performed_at", opts);
    const { rows } = await this.pool.query<WorkoutRow>(
      `SELECT * FROM health_workout_log${whereSql} ORDER BY performed_at DESC${limitSql}`,
      args,
    );
    return rows.map(rowToWorkout);
  }

  async getWorkoutSets(workoutId: string): Promise<WorkoutSet[]> {
    const { rows } = await this.pool.query<SetRow>(
      "SELECT * FROM health_workout_set WHERE workout_id = $1 ORDER BY order_index ASC",
      [workoutId],
    );
    return rows.map(rowToSet);
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.pool.query("DELETE FROM health_workout_set WHERE workout_id = $1", [id]);
    await this.pool.query("DELETE FROM health_workout_log WHERE id = $1", [id]);
  }

  // meal
  async appendMeal(m: MealEntry): Promise<void> {
    await this.pool.query(`
      INSERT INTO health_meal_log
        (id, consumed_at, meal_type, items, total_kcal, total_protein_g,
         total_carb_g, total_fat_g, total_fiber_g, photo_url, source, notes, created_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO NOTHING
    `, [
      m.id, m.consumedAt, m.mealType ?? null, JSON.stringify(m.items),
      m.totalKcal ?? null, m.totalProteinG ?? null, m.totalCarbG ?? null,
      m.totalFatG ?? null, m.totalFiberG ?? null,
      m.photoUrl ?? null, m.source, m.notes ?? null, m.createdAt,
    ]);
  }

  async listMeals(opts?: { since?: string; until?: string; limit?: number }): Promise<MealEntry[]> {
    const { whereSql, limitSql, args } = buildRange("consumed_at", opts);
    const { rows } = await this.pool.query<MealRow>(
      `SELECT * FROM health_meal_log${whereSql} ORDER BY consumed_at DESC${limitSql}`,
      args,
    );
    return rows.map(rowToMeal);
  }

  async deleteMeal(id: string): Promise<void> {
    await this.pool.query("DELETE FROM health_meal_log WHERE id = $1", [id]);
  }

  // sleep
  async appendSleep(s: SleepEntry): Promise<void> {
    await this.pool.query(`
      INSERT INTO health_sleep_log
        (id, sleep_date, duration_min, quality, bedtime, wake_time, notes, source, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `, [
      s.id, s.sleepDate, s.durationMin ?? null, s.quality ?? null,
      s.bedtime ?? null, s.wakeTime ?? null, s.notes ?? null, s.source, s.createdAt,
    ]);
  }

  async listSleep(opts?: { since?: string; until?: string; limit?: number }): Promise<SleepEntry[]> {
    const { whereSql, limitSql, args } = buildRange("sleep_date", opts);
    const { rows } = await this.pool.query<SleepRow>(
      `SELECT * FROM health_sleep_log${whereSql} ORDER BY sleep_date DESC${limitSql}`,
      args,
    );
    return rows.map(rowToSleep);
  }

  // mood
  async appendMood(m: MoodEntry): Promise<void> {
    await this.pool.query(`
      INSERT INTO health_mood_log
        (id, logged_at, energy, mood, fatigue, soreness, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
    `, [
      m.id, m.loggedAt,
      m.energy ?? null, m.mood ?? null, m.fatigue ?? null, m.soreness ?? null,
      m.notes ?? null, m.createdAt,
    ]);
  }

  async listMoods(opts?: { since?: string; until?: string; limit?: number }): Promise<MoodEntry[]> {
    const { whereSql, limitSql, args } = buildRange("logged_at", opts);
    const { rows } = await this.pool.query<MoodRow>(
      `SELECT * FROM health_mood_log${whereSql} ORDER BY logged_at DESC${limitSql}`,
      args,
    );
    return rows.map(rowToMood);
  }

  // plan / report
  async putWeeklyPlan(p: WeeklyPlan): Promise<void> {
    await this.pool.query(`
      INSERT INTO health_weekly_plan
        (id, week_start, goal_snapshot, diet_plan, training_plan, notes,
         generated_at, generated_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        week_start    = EXCLUDED.week_start,
        goal_snapshot = EXCLUDED.goal_snapshot,
        diet_plan     = EXCLUDED.diet_plan,
        training_plan = EXCLUDED.training_plan,
        notes         = EXCLUDED.notes,
        generated_at  = EXCLUDED.generated_at,
        generated_by  = EXCLUDED.generated_by,
        status        = EXCLUDED.status
    `, [
      p.id, p.weekStart, p.goalSnapshot ?? null,
      p.dietPlan ?? null, p.trainingPlan ?? null, p.notes ?? null,
      p.generatedAt, p.generatedBy, p.status,
    ]);
  }

  async latestWeeklyPlan(): Promise<WeeklyPlan | null> {
    const { rows } = await this.pool.query<PlanRow>(
      "SELECT * FROM health_weekly_plan ORDER BY week_start DESC LIMIT 1",
    );
    return rows[0] ? rowToPlan(rows[0]) : null;
  }

  async getWeeklyPlanByStart(weekStart: string): Promise<WeeklyPlan | null> {
    const { rows } = await this.pool.query<PlanRow>(
      "SELECT * FROM health_weekly_plan WHERE week_start = $1 LIMIT 1",
      [weekStart],
    );
    return rows[0] ? rowToPlan(rows[0]) : null;
  }

  async listWeeklyPlans(limit = 12): Promise<WeeklyPlan[]> {
    const { rows } = await this.pool.query<PlanRow>(
      "SELECT * FROM health_weekly_plan ORDER BY week_start DESC LIMIT $1",
      [Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map(rowToPlan);
  }

  async putWeeklyReport(r: WeeklyReport): Promise<void> {
    await this.pool.query(`
      INSERT INTO health_weekly_report (id, week_start, body, metrics, generated_at)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      ON CONFLICT (id) DO UPDATE SET
        week_start   = EXCLUDED.week_start,
        body         = EXCLUDED.body,
        metrics      = EXCLUDED.metrics,
        generated_at = EXCLUDED.generated_at
    `, [
      r.id, r.weekStart, r.body,
      r.metrics ? JSON.stringify(r.metrics) : null,
      r.generatedAt,
    ]);
  }

  async latestWeeklyReport(): Promise<WeeklyReport | null> {
    const { rows } = await this.pool.query<ReportRow>(
      "SELECT * FROM health_weekly_report ORDER BY week_start DESC LIMIT 1",
    );
    return rows[0] ? rowToReport(rows[0]) : null;
  }

  async listWeeklyReports(limit = 12): Promise<WeeklyReport[]> {
    const { rows } = await this.pool.query<ReportRow>(
      "SELECT * FROM health_weekly_report ORDER BY week_start DESC LIMIT $1",
      [Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map(rowToReport);
  }

  // alert
  async appendAlert(a: HealthAlert): Promise<void> {
    await this.pool.query(`
      INSERT INTO health_alert
        (id, kind, severity, message, context, status, created_at, acknowledged_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
    `, [
      a.id, a.kind, a.severity, a.message,
      a.context ? JSON.stringify(a.context) : null,
      a.status, a.createdAt, a.acknowledgedAt ?? null,
    ]);
  }

  async listAlerts(opts?: { status?: AlertStatus; limit?: number }): Promise<HealthAlert[]> {
    const where: string[] = [];
    const args: unknown[] = [];
    if (opts?.status) {
      args.push(opts.status);
      where.push(`status = $${args.length}`);
    }
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    args.push(Math.min(Math.max(opts?.limit ?? 100, 1), 1000));
    const { rows } = await this.pool.query<AlertRow>(
      `SELECT * FROM health_alert${whereSql} ORDER BY created_at DESC LIMIT $${args.length}`,
      args,
    );
    return rows.map(rowToAlert);
  }

  async updateAlertStatus(id: string, status: AlertStatus): Promise<void> {
    await this.pool.query(
      "UPDATE health_alert SET status = $1, acknowledged_at = $2 WHERE id = $3",
      [status, status === "open" ? null : new Date().toISOString(), id],
    );
  }

  // ── 提醒 + 飞书 webhook（state 表 JSON blob）─────────────────
  async listReminders(): Promise<HealthReminder[]> {
    const { rows } = await this.pool.query<{ value: string }>(
      "SELECT value FROM state WHERE key = 'health.reminders'",
    );
    if (!rows[0]) return [];
    try {
      const parsed = JSON.parse(rows[0].value);
      return Array.isArray(parsed) ? parsed as HealthReminder[] : [];
    } catch { return []; }
  }

  async putReminders(rs: HealthReminder[]): Promise<void> {
    const ts = new Date().toISOString();
    await this.pool.query(`
      INSERT INTO state (key, value, updated_at) VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `, ["health.reminders", JSON.stringify(rs), ts]);
  }

  async getFeishuWebhook(): Promise<string | null> {
    const { rows } = await this.pool.query<{ value: string }>(
      "SELECT value FROM state WHERE key = 'health.feishu_webhook'",
    );
    if (!rows[0]) return null;
    try {
      const v = JSON.parse(rows[0].value);
      return typeof v === "string" ? v : null;
    } catch { return null; }
  }

  async setFeishuWebhook(url: string | null): Promise<void> {
    const ts = new Date().toISOString();
    if (url === null) {
      await this.pool.query("DELETE FROM state WHERE key = 'health.feishu_webhook'");
      return;
    }
    await this.pool.query(`
      INSERT INTO state (key, value, updated_at) VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `, ["health.feishu_webhook", JSON.stringify(url), ts]);
  }
}
