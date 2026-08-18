/**
 * Rich health-intake —— 部署在阿里云 ECS 的 slim 健康数据接收服务。
 *
 * 只负责：
 *   POST /api/health/intake/from-apple   接收苹果快捷指令推送
 *   GET  /api/health/intake/status       回看最近 1 条 + 各指标计数
 *   GET  /healthz                        健康检查
 *
 * 不做：Rich 全套（chat / mcp / electron 等都不在这），保最小攻击面。
 * 直连 localhost postgres（跟 Rich Mac 端共用同一个 rich 数据库）。
 *
 * 鉴权：HEALTH_INTAKE_TOKEN env 必须设；请求带 Authorization: Bearer <token>。
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createHash } from "node:crypto";
import { Pool } from "pg";

const TOKEN = process.env.HEALTH_INTAKE_TOKEN;
if (!TOKEN || TOKEN.length < 16) {
  console.error("[health-intake] HEALTH_INTAKE_TOKEN env required (>= 16 chars)");
  process.exit(2);
}

const PORT = parseInt(process.env.PORT ?? "31516", 10);
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[health-intake] DATABASE_URL env required");
  process.exit(2);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

const app = new Hono();

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function nowISO() { return new Date().toISOString(); }

type JsonRecord = Record<string, unknown>;

type DailyHealth = {
  date: string;
  kg?: number;
  bodyFatPct?: number;
  sleepDurationMin?: number;
  totalKcal?: number;
  totalProteinG?: number;
  totalCarbG?: number;
  totalFatG?: number;
  totalFiberG?: number;
  exerciseMin?: number;
  activeKcal?: number;
  steps?: number;
  distanceKm?: number;
  flightsClimbed?: number;
  walkingSpeedKmh?: Stat;
  walkingStepLengthCm?: Stat;
  walkingDoubleSupportPct?: Stat;
  walkingAsymmetryPct?: Stat;
  headphoneAudioExposureDbaspl?: Stat;
};

type Stat = {
  sum: number;
  count: number;
  max?: number;
};

type MetricSample = {
  id: string;
  rawImportId: string | null;
  source: string;
  metric: string;
  category: string;
  aggregationStyle: "cumulative" | "discrete";
  appleIdentifier: string;
  recordedAt: string;
  value: number;
  unit: string;
  importedAt: string;
};

// 只记录请求元信息，不记录健康数据正文。
app.use("/api/*", async (c, next) => {
  const started = Date.now();
  await next();
  console.log(JSON.stringify({
    ts: nowISO(),
    msg: "health-intake.request",
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    contentType: c.req.header("content-type") ?? null,
    ms: Date.now() - started,
  }));
});

// ─── 鉴权中间件 ──────────────────────────────────────
app.use("/api/*", async (c, next) => {
  const auth = c.req.header("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!provided || provided !== TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

// ─── 健康检查（无鉴权）────────────────────────────────
app.get("/healthz", c => c.json({
  ok: true,
  service: "rich-health-intake",
  ts: nowISO(),
  uptime: Math.round(process.uptime()),
}));

// ─── 主入口：接收 Apple Shortcut 推送 ────────────────
app.post("/api/health/intake/from-apple", async c => {
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ error: "JSON body required" }, 400);

  const ingested: Record<string, number> = {};
  const errors: string[] = [];

  // 体重
  const weight = body.weight as { kg?: number; bodyFatPct?: number; loggedAt?: string } | undefined;
  if (weight && typeof weight.kg === "number" && weight.kg > 20 && weight.kg < 300) {
    try {
      await pool.query(
        `INSERT INTO health_weight_log (id, logged_at, kg, body_fat_pct, source, created_at)
         VALUES ($1, $2, $3, $4, 'apple-health', $5)
         ON CONFLICT (id) DO NOTHING`,
        [newId("w"), weight.loggedAt ?? nowISO(), weight.kg,
         typeof weight.bodyFatPct === "number" ? weight.bodyFatPct : null, nowISO()],
      );
      ingested.weight = 1;
    } catch (e) { errors.push(`weight: ${msg(e)}`); }
  }

  // 睡眠
  const sleep = body.sleep as { durationMin?: number; quality?: number; sleepDate?: string; bedtime?: string; wakeTime?: string } | undefined;
  if (sleep && (typeof sleep.durationMin === "number" || typeof sleep.quality === "number")) {
    try {
      await pool.query(
        `INSERT INTO health_sleep_log (id, sleep_date, duration_min, quality, bedtime, wake_time, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'apple-health', $7)
         ON CONFLICT (id) DO NOTHING`,
        [newId("sl"),
         sleep.sleepDate ?? new Date().toISOString().slice(0, 10),
         typeof sleep.durationMin === "number" ? sleep.durationMin : null,
         typeof sleep.quality === "number" ? sleep.quality : null,
         typeof sleep.bedtime === "string" ? sleep.bedtime : null,
         typeof sleep.wakeTime === "string" ? sleep.wakeTime : null,
         nowISO()],
      );
      ingested.sleep = 1;
    } catch (e) { errors.push(`sleep: ${msg(e)}`); }
  }

  // 训练
  const workout = body.workout as { sessionName?: string; performedAt?: string; durationMin?: number; totalVolume?: number; notes?: string } | undefined;
  if (workout && (typeof workout.durationMin === "number" || workout.sessionName)) {
    try {
      await pool.query(
        `INSERT INTO health_workout_log (id, session_name, performed_at, duration_min, total_volume, notes, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'apple-watch', $7)
         ON CONFLICT (id) DO NOTHING`,
        [newId("wk"),
         workout.sessionName ?? null,
         workout.performedAt ?? nowISO(),
         typeof workout.durationMin === "number" ? workout.durationMin : null,
         typeof workout.totalVolume === "number" ? workout.totalVolume : null,
         workout.notes ?? null,
         nowISO()],
      );
      ingested.workout = 1;
    } catch (e) { errors.push(`workout: ${msg(e)}`); }
  }

  // 饮食（只总量，没 items）
  const meal = body.meal as { mealType?: string; totalKcal?: number; totalProteinG?: number; totalCarbG?: number; totalFatG?: number; consumedAt?: string } | undefined;
  if (meal && typeof meal.totalKcal === "number") {
    try {
      await pool.query(
        `INSERT INTO health_meal_log (id, consumed_at, meal_type, items, total_kcal, total_protein_g, total_carb_g, total_fat_g, source, created_at)
         VALUES ($1, $2, $3, '[]'::jsonb, $4, $5, $6, $7, 'ai-text', $8)
         ON CONFLICT (id) DO NOTHING`,
        [newId("ml"),
         meal.consumedAt ?? nowISO(),
         meal.mealType ?? null,
         meal.totalKcal,
         typeof meal.totalProteinG === "number" ? meal.totalProteinG : null,
         typeof meal.totalCarbG === "number" ? meal.totalCarbG : null,
         typeof meal.totalFatG === "number" ? meal.totalFatG : null,
         nowISO()],
      );
      ingested.meal = 1;
    } catch (e) { errors.push(`meal: ${msg(e)}`); }
  }

  // 主观感受
  const mood = body.mood as { energy?: number; mood?: number; fatigue?: number; soreness?: number; notes?: string; loggedAt?: string } | undefined;
  if (mood && (mood.energy !== undefined || mood.mood !== undefined || mood.fatigue !== undefined || mood.soreness !== undefined)) {
    try {
      await pool.query(
        `INSERT INTO health_mood_log (id, logged_at, energy, mood, fatigue, soreness, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [newId("md"),
         mood.loggedAt ?? nowISO(),
         typeof mood.energy === "number" ? mood.energy : null,
         typeof mood.mood === "number" ? mood.mood : null,
         typeof mood.fatigue === "number" ? mood.fatigue : null,
         typeof mood.soreness === "number" ? mood.soreness : null,
         mood.notes ?? null,
         nowISO()],
      );
      ingested.mood = 1;
    } catch (e) { errors.push(`mood: ${msg(e)}`); }
  }

  const total = Object.values(ingested).reduce((a, b) => a + b, 0);
  if (total === 0 && errors.length === 0) {
    return c.json({
      ingested: {},
      errors: ["no recognised data — body 里没找到任何可识别的 weight / sleep / workout / meal / mood 字段"],
    }, 400);
  }
  return c.json({ ingested, totalIngested: total, errors });
});

// ─── Health Auto Export REST 自动同步 ───────────────
app.post("/api/health/intake/health-auto-export", async c => {
  const body = await c.req.json().catch(() => null) as JsonRecord | JsonRecord[] | null;
  if (!body) return c.json({ error: "JSON body required" }, 400);

  const importedAt = nowISO();
  const ingested: Record<string, number> = { raw: 0 };
  const errors: string[] = [];
  const daily = new Map<string, DailyHealth>();

  try {
    await ensureHealthImportTables();
  } catch (e) {
    return c.json({ error: `health import tables unavailable: ${msg(e)}` }, 500);
  }

  const metrics = metricRecords(body);
  const workouts = arrayAt(body, ["workouts", "workout", "activities"]);

  if (metrics.length === 0 && workouts.length === 0) {
    await insertRawImport("health-auto-export-rest", "payload", nowISO(), body, importedAt);
    ingested.raw = 1;
  }

  for (const metric of metrics) {
    const at = recordDateTime(metric) ?? nowISO();
    try {
      const rawImportId = await insertRawImport("health-auto-export-rest", "metric", at, metric, importedAt);
      ingested.raw += 1;
      const sample = metricSampleFor(metric, rawImportId, importedAt);
      if (sample) {
        await insertMetricSample(sample);
        ingested.metricSample = (ingested.metricSample ?? 0) + 1;
      }
      collectMetric(metric, daily);
    } catch (e) {
      errors.push(`metric: ${msg(e)}`);
    }
  }

  for (const workout of workouts) {
    const record = isRecord(workout) ? workout : { value: workout };
    const at = recordDateTime(record) ?? nowISO();
    try {
      await insertRawImport("health-auto-export-rest", "workout", at, record, importedAt);
      ingested.raw += 1;
      if (await importHealthAutoExportWorkout(record, importedAt)) {
        ingested.workout = (ingested.workout ?? 0) + 1;
      }
    } catch (e) {
      errors.push(`workout: ${msg(e)}`);
    }
  }

  for (const item of daily.values()) {
    try {
      const counts = await importDailyHealth(item, importedAt);
      for (const [key, value] of Object.entries(counts)) {
        ingested[key] = (ingested[key] ?? 0) + value;
      }
    } catch (e) {
      errors.push(`daily:${item.date}: ${msg(e)}`);
    }
  }

  const totalStructured = Object.entries(ingested)
    .filter(([key]) => key !== "raw")
    .reduce((sum, [, value]) => sum + value, 0);

  return c.json({
    source: "health-auto-export",
    ingested,
    totalStructured,
    errors,
  });
});

// ─── 同步状态查询 ────────────────────────────────────
app.get("/api/health/intake/status", async c => {
  const [weight, sleep, workout, meal, mood] = await Promise.all([
    pool.query("SELECT * FROM health_weight_log ORDER BY logged_at DESC LIMIT 1"),
    pool.query("SELECT * FROM health_sleep_log ORDER BY sleep_date DESC LIMIT 1"),
    pool.query("SELECT * FROM health_workout_log ORDER BY performed_at DESC LIMIT 1"),
    pool.query("SELECT * FROM health_meal_log ORDER BY consumed_at DESC LIMIT 1"),
    pool.query("SELECT * FROM health_mood_log ORDER BY logged_at DESC LIMIT 1"),
  ]);
  return c.json({
    weight:  { latest: weight.rows[0]  ?? null, hasData: weight.rows.length > 0 },
    sleep:   { latest: sleep.rows[0]   ?? null, hasData: sleep.rows.length > 0 },
    workout: { latest: workout.rows[0] ?? null, hasData: workout.rows.length > 0 },
    meal:    { latest: meal.rows[0]    ?? null, hasData: meal.rows.length > 0 },
    mood:    { latest: mood.rows[0]    ?? null, hasData: mood.rows.length > 0 },
  });
});

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function ensureHealthImportTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS health_raw_import (
      id            TEXT PRIMARY KEY,
      source        TEXT NOT NULL,
      kind          TEXT NOT NULL,
      record_at     TEXT,
      payload       JSONB NOT NULL,
      imported_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_raw_import_at ON health_raw_import(record_at DESC);
    CREATE INDEX IF NOT EXISTS idx_health_raw_import_source ON health_raw_import(source, kind);

    CREATE TABLE IF NOT EXISTS health_metric_sample (
      id                 TEXT PRIMARY KEY,
      raw_import_id      TEXT,
      source             TEXT NOT NULL,
      metric             TEXT NOT NULL,
      category           TEXT NOT NULL,
      aggregation_style  TEXT NOT NULL,
      apple_identifier   TEXT,
      recorded_at        TEXT NOT NULL,
      value              REAL NOT NULL,
      unit               TEXT,
      imported_at        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_metric_sample_metric_at ON health_metric_sample(metric, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_health_metric_sample_category_at ON health_metric_sample(category, recorded_at DESC);

    CREATE TABLE IF NOT EXISTS health_daily_activity_summary (
      summary_date                              TEXT NOT NULL,
      source                                    TEXT NOT NULL DEFAULT 'apple-health',
      steps_count                               REAL,
      walking_running_distance_km               REAL,
      flights_climbed                           REAL,
      walking_speed_avg_kmh                     REAL,
      walking_speed_samples                     INTEGER NOT NULL DEFAULT 0,
      walking_step_length_avg_cm                REAL,
      walking_step_length_samples               INTEGER NOT NULL DEFAULT 0,
      walking_double_support_avg_pct            REAL,
      walking_double_support_samples            INTEGER NOT NULL DEFAULT 0,
      walking_asymmetry_avg_pct                 REAL,
      walking_asymmetry_samples                 INTEGER NOT NULL DEFAULT 0,
      headphone_audio_exposure_avg_dbaspl       REAL,
      headphone_audio_exposure_max_dbaspl       REAL,
      headphone_audio_exposure_samples          INTEGER NOT NULL DEFAULT 0,
      updated_at                                TEXT NOT NULL,
      PRIMARY KEY (summary_date, source)
    );
    CREATE INDEX IF NOT EXISTS idx_health_daily_activity_date ON health_daily_activity_summary(summary_date DESC);
  `);
}

async function insertRawImport(source: string, kind: string, recordAt: string, payload: unknown, importedAt: string) {
  const id = `hae-rest-raw-${hash(`${source}:${kind}:${recordAt}:${JSON.stringify(payload)}`)}`;
  await pool.query(
    `INSERT INTO health_raw_import (id, source, kind, record_at, payload, imported_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     ON CONFLICT (id) DO UPDATE
     SET payload = EXCLUDED.payload, imported_at = EXCLUDED.imported_at`,
    [id, source, kind, recordAt, JSON.stringify(payload), importedAt],
  );
  return id;
}

async function insertMetricSample(sample: MetricSample) {
  await pool.query(
    `INSERT INTO health_metric_sample
       (id, raw_import_id, source, metric, category, aggregation_style, apple_identifier,
        recorded_at, value, unit, imported_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE
     SET source = EXCLUDED.source,
         metric = EXCLUDED.metric,
         category = EXCLUDED.category,
         aggregation_style = EXCLUDED.aggregation_style,
         apple_identifier = EXCLUDED.apple_identifier,
         recorded_at = EXCLUDED.recorded_at,
         value = EXCLUDED.value,
         unit = EXCLUDED.unit,
         imported_at = EXCLUDED.imported_at`,
    [
      sample.id,
      sample.rawImportId,
      sample.source,
      sample.metric,
      sample.category,
      sample.aggregationStyle,
      sample.appleIdentifier,
      sample.recordedAt,
      sample.value,
      sample.unit,
      sample.importedAt,
    ],
  );
}

async function importDailyHealth(item: DailyHealth, importedAt: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  if (item.kg !== undefined && item.kg > 20 && item.kg < 300) {
    await pool.query(
      `INSERT INTO health_weight_log (id, logged_at, kg, body_fat_pct, notes, source, created_at)
       VALUES ($1, $2, $3, $4, $5, 'apple-health', $6)
       ON CONFLICT (id) DO UPDATE
       SET logged_at = EXCLUDED.logged_at,
           kg = EXCLUDED.kg,
           body_fat_pct = COALESCE(EXCLUDED.body_fat_pct, health_weight_log.body_fat_pct),
           notes = EXCLUDED.notes`,
      [`hae-rest-weight-${item.date}`, `${item.date}T08:00:00+08:00`, item.kg, item.bodyFatPct ?? null, "Health Auto Export REST", importedAt],
    );
    counts.weight = 1;
  }

  if (item.sleepDurationMin !== undefined && item.sleepDurationMin > 0) {
    await pool.query(
      `INSERT INTO health_sleep_log (id, sleep_date, duration_min, quality, bedtime, wake_time, notes, source, created_at)
       VALUES ($1, $2, $3, NULL, NULL, NULL, $4, 'apple-health', $5)
       ON CONFLICT (id) DO UPDATE
       SET duration_min = EXCLUDED.duration_min,
           notes = EXCLUDED.notes`,
      [`hae-rest-sleep-${item.date}`, item.date, Math.round(item.sleepDurationMin), "Health Auto Export REST", importedAt],
    );
    counts.sleep = 1;
  }

  if ([item.totalKcal, item.totalProteinG, item.totalCarbG, item.totalFatG, item.totalFiberG].some(v => v !== undefined && v > 0)) {
    await pool.query(
      `INSERT INTO health_meal_log
         (id, consumed_at, meal_type, items, total_kcal, total_protein_g,
          total_carb_g, total_fat_g, total_fiber_g, source, notes, created_at)
       VALUES ($1, $2, 'daily', '[]'::jsonb, $3, $4, $5, $6, $7, 'apple-health', $8, $9)
       ON CONFLICT (id) DO UPDATE
       SET total_kcal = EXCLUDED.total_kcal,
           total_protein_g = EXCLUDED.total_protein_g,
           total_carb_g = EXCLUDED.total_carb_g,
           total_fat_g = EXCLUDED.total_fat_g,
           total_fiber_g = EXCLUDED.total_fiber_g,
           notes = EXCLUDED.notes`,
      [
        `hae-rest-meal-${item.date}`,
        `${item.date}T23:59:00+08:00`,
        item.totalKcal ?? null,
        item.totalProteinG ?? null,
        item.totalCarbG ?? null,
        item.totalFatG ?? null,
        item.totalFiberG ?? null,
        "Health Auto Export REST daily nutrition",
        importedAt,
      ],
    );
    counts.meal = 1;
  }

  if ([item.exerciseMin, item.activeKcal, item.steps, item.distanceKm].some(v => v !== undefined && v > 0)) {
    await pool.query(
      `INSERT INTO health_workout_log
         (id, session_name, performed_at, duration_min, total_volume, rpe_avg, notes, source, created_at)
       VALUES ($1, $2, $3, $4, NULL, NULL, $5, 'apple-health', $6)
       ON CONFLICT (id) DO UPDATE
       SET duration_min = EXCLUDED.duration_min,
           notes = EXCLUDED.notes`,
      [
        `hae-rest-activity-${item.date}`,
        "Apple Health 活动摘要",
        `${item.date}T20:00:00+08:00`,
        item.exerciseMin !== undefined ? Math.round(item.exerciseMin) : null,
        compactJson({ steps: item.steps, distanceKm: item.distanceKm, activeKcal: item.activeKcal }),
        importedAt,
      ],
    );
    counts.workout = 1;
  }

  if (hasDailyActivitySummary(item)) {
    const speed = avgStat(item.walkingSpeedKmh);
    const stepLength = avgStat(item.walkingStepLengthCm);
    const doubleSupport = avgStat(item.walkingDoubleSupportPct);
    const asymmetry = avgStat(item.walkingAsymmetryPct);
    const audio = avgStat(item.headphoneAudioExposureDbaspl);
    await pool.query(
      `INSERT INTO health_daily_activity_summary
         (summary_date, source, steps_count, walking_running_distance_km, flights_climbed,
          walking_speed_avg_kmh, walking_speed_samples,
          walking_step_length_avg_cm, walking_step_length_samples,
          walking_double_support_avg_pct, walking_double_support_samples,
          walking_asymmetry_avg_pct, walking_asymmetry_samples,
          headphone_audio_exposure_avg_dbaspl, headphone_audio_exposure_max_dbaspl,
          headphone_audio_exposure_samples, updated_at)
       VALUES ($1, 'apple-health', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (summary_date, source) DO UPDATE
       SET steps_count = EXCLUDED.steps_count,
           walking_running_distance_km = EXCLUDED.walking_running_distance_km,
           flights_climbed = EXCLUDED.flights_climbed,
           walking_speed_avg_kmh = EXCLUDED.walking_speed_avg_kmh,
           walking_speed_samples = EXCLUDED.walking_speed_samples,
           walking_step_length_avg_cm = EXCLUDED.walking_step_length_avg_cm,
           walking_step_length_samples = EXCLUDED.walking_step_length_samples,
           walking_double_support_avg_pct = EXCLUDED.walking_double_support_avg_pct,
           walking_double_support_samples = EXCLUDED.walking_double_support_samples,
           walking_asymmetry_avg_pct = EXCLUDED.walking_asymmetry_avg_pct,
           walking_asymmetry_samples = EXCLUDED.walking_asymmetry_samples,
           headphone_audio_exposure_avg_dbaspl = EXCLUDED.headphone_audio_exposure_avg_dbaspl,
           headphone_audio_exposure_max_dbaspl = EXCLUDED.headphone_audio_exposure_max_dbaspl,
           headphone_audio_exposure_samples = EXCLUDED.headphone_audio_exposure_samples,
           updated_at = EXCLUDED.updated_at`,
      [
        item.date,
        item.steps ?? null,
        item.distanceKm ?? null,
        item.flightsClimbed ?? null,
        speed,
        item.walkingSpeedKmh?.count ?? 0,
        stepLength,
        item.walkingStepLengthCm?.count ?? 0,
        doubleSupport,
        item.walkingDoubleSupportPct?.count ?? 0,
        asymmetry,
        item.walkingAsymmetryPct?.count ?? 0,
        audio,
        item.headphoneAudioExposureDbaspl?.max ?? null,
        item.headphoneAudioExposureDbaspl?.count ?? 0,
        importedAt,
      ],
    );
    counts.dailySummary = 1;
  }

  return counts;
}

async function importHealthAutoExportWorkout(record: JsonRecord, importedAt: string): Promise<boolean> {
  const performedAt = recordDateTime(record);
  const date = dayOf(performedAt);
  if (!date) return false;

  const name = strAt(record, ["name", "type", "workoutType", "workout_type", "Workout Type"]) ?? "Apple Health Workout";
  const durationMin = durationMinFrom(record);
  const id = `hae-rest-workout-${hash(`${name}:${performedAt}`)}`;
  await pool.query(
    `INSERT INTO health_workout_log
       (id, session_name, performed_at, duration_min, total_volume, rpe_avg, notes, source, created_at)
     VALUES ($1, $2, $3, $4, NULL, NULL, $5, 'apple-watch', $6)
     ON CONFLICT (id) DO UPDATE
     SET session_name = EXCLUDED.session_name,
         duration_min = EXCLUDED.duration_min,
         notes = EXCLUDED.notes`,
    [
      id,
      name,
      toIso(performedAt) ?? `${date}T12:00:00+08:00`,
      durationMin,
      compactJson({
        distanceKm: asDistanceKm(numAt(record, ["distance", "distanceKm", "distance_km", "距离 (km)"]), strAt(record, ["distanceUnit", "unit"])),
        activeKcal: energyAsKcal(numAt(record, ["activeEnergy", "active_energy", "calories", "活动能量 (kJ)"]), strAt(record, ["activeEnergyUnit", "energyUnit", "unit"])),
        averageHeartRate: numAt(record, ["averageHeartRate", "avgHeartRate", "平均心率 (bpm)"]),
        maxHeartRate: numAt(record, ["maxHeartRate", "最大心率 (bpm)"]),
      }),
      importedAt,
    ],
  );
  return true;
}

function collectMetric(record: JsonRecord, daily: Map<string, DailyHealth>) {
  const name = normalizeName(strAt(record, ["metric", "name", "type", "identifier", "quantityType", "title"]) ?? "");
  const value = numAt(record, ["value", "qty", "quantity", "amount", "total", "sum", "count", "duration"]);
  if (value === null) return;

  const at = recordDateTime(record);
  const date = dayOf(at);
  if (!date) return;

  const unit = strAt(record, ["unit", "units", "valueUnit", "quantityUnit"]);
  const item = daily.get(date) ?? { date };
  daily.set(date, item);

  if (hasAny(name, ["body_mass", "bodymass", "body_weight", "weight", "体重"])) item.kg = weightAsKg(value, unit);
  else if (hasAny(name, ["body_fat", "bodyfat", "fat_percentage", "body_fat_percentage", "体脂"])) item.bodyFatPct = value;
  else if (hasAny(name, ["sleep", "睡眠"])) item.sleepDurationMin = durationValueAsMin(value, unit);
  else if (hasAny(name, ["dietary_energy", "dietaryenergy", "energy_consumed", "膳食能量"])) item.totalKcal = add(item.totalKcal, energyAsKcal(value, unit));
  else if (hasAny(name, ["dietary_protein", "protein", "蛋白"])) item.totalProteinG = add(item.totalProteinG, value);
  else if (hasAny(name, ["dietary_carbohydrates", "carbohydrate", "carb", "碳水"])) item.totalCarbG = add(item.totalCarbG, value);
  else if (hasAny(name, ["dietary_fat_total", "total_fat", "fat_total", "总脂肪"])) item.totalFatG = add(item.totalFatG, value);
  else if (hasAny(name, ["dietary_fiber", "fiber", "膳食纤维"])) item.totalFiberG = add(item.totalFiberG, value);
  else if (hasAny(name, ["apple_exercise_time", "exercise_time", "workout_time", "锻炼时间"])) item.exerciseMin = add(item.exerciseMin, durationValueAsMin(value, unit));
  else if (hasAny(name, ["active_energy", "activeenergy", "活动能量"])) item.activeKcal = add(item.activeKcal, energyAsKcal(value, unit));
  else if (hasAny(name, ["step_count", "steps", "步数"])) item.steps = add(item.steps, value);
  else if (hasAny(name, ["walking_running_distance", "distance_walking_running", "步行_跑步距离"])) item.distanceKm = add(item.distanceKm, asDistanceKm(value, unit));
  else if (hasAny(name, ["flights_climbed", "flightsclimbed", "爬楼"])) item.flightsClimbed = add(item.flightsClimbed, value);
  else if (hasAny(name, ["walking_speed", "walkingspeed", "步行速度"])) item.walkingSpeedKmh = addStat(item.walkingSpeedKmh, speedAsKmh(value, unit));
  else if (hasAny(name, ["walking_step_length", "walkingsteplength", "步长"])) item.walkingStepLengthCm = addStat(item.walkingStepLengthCm, lengthAsCm(value, unit));
  else if (hasAny(name, ["walking_double_support_percentage", "walkingdoublesupportpercentage", "双脚支撑"])) item.walkingDoubleSupportPct = addStat(item.walkingDoubleSupportPct, percentValue(value, unit));
  else if (hasAny(name, ["walking_asymmetry_percentage", "walkingasymmetrypercentage", "步行不对称"])) item.walkingAsymmetryPct = addStat(item.walkingAsymmetryPct, percentValue(value, unit));
  else if (hasAny(name, ["headphone_audio_exposure", "headphoneaudioexposure", "耳机音频"])) item.headphoneAudioExposureDbaspl = addStat(item.headphoneAudioExposureDbaspl, value);
}

function metricSampleFor(record: JsonRecord, rawImportId: string | null, importedAt: string): MetricSample | null {
  const metric = canonicalMetric(strAt(record, ["metric", "name", "type", "identifier", "quantityType", "title"]) ?? "");
  if (!metric) return null;

  const rawValue = numAt(record, ["value", "qty", "quantity", "amount", "total", "sum", "count", "duration"]);
  const recordedAt = recordDateTime(record);
  if (rawValue === null || !recordedAt) return null;

  const unit = strAt(record, ["unit", "units", "valueUnit", "quantityUnit"]);
  const normalized = normalizeMetricValue(metric, rawValue, unit);
  const def = metricDefinition(metric);
  if (!def) return null;
  return {
    id: `hae-rest-sample-${hash(`${metric}:${recordedAt}:${normalized.value}:${rawImportId ?? ""}`)}`,
    rawImportId,
    source: "health-auto-export-rest",
    metric,
    category: def.category,
    aggregationStyle: def.aggregationStyle,
    appleIdentifier: def.appleIdentifier,
    recordedAt: toIso(recordedAt) ?? recordedAt,
    value: normalized.value,
    unit: normalized.unit,
    importedAt,
  };
}

function canonicalMetric(value: string): string | null {
  const name = normalizeName(value);
  if (hasAny(name, ["step_count", "steps", "步数"])) return "step_count";
  if (hasAny(name, ["walking_running_distance", "distance_walking_running", "步行_跑步距离"])) return "walking_running_distance";
  if (hasAny(name, ["flights_climbed", "flightsclimbed", "爬楼"])) return "flights_climbed";
  if (hasAny(name, ["walking_speed", "walkingspeed", "步行速度"])) return "walking_speed";
  if (hasAny(name, ["walking_step_length", "walkingsteplength", "步长"])) return "walking_step_length";
  if (hasAny(name, ["walking_double_support_percentage", "walkingdoublesupportpercentage", "双脚支撑"])) return "walking_double_support_percentage";
  if (hasAny(name, ["walking_asymmetry_percentage", "walkingasymmetrypercentage", "步行不对称"])) return "walking_asymmetry_percentage";
  if (hasAny(name, ["headphone_audio_exposure", "headphoneaudioexposure", "耳机音频"])) return "headphone_audio_exposure";
  return null;
}

function metricDefinition(metric: string) {
  const defs: Record<string, Omit<MetricSample, "id" | "rawImportId" | "source" | "metric" | "recordedAt" | "value" | "unit" | "importedAt">> = {
    step_count: {
      category: "activity",
      aggregationStyle: "cumulative",
      appleIdentifier: "HKQuantityTypeIdentifier.stepCount",
    },
    walking_running_distance: {
      category: "activity",
      aggregationStyle: "cumulative",
      appleIdentifier: "HKQuantityTypeIdentifier.distanceWalkingRunning",
    },
    flights_climbed: {
      category: "activity",
      aggregationStyle: "cumulative",
      appleIdentifier: "HKQuantityTypeIdentifier.flightsClimbed",
    },
    walking_speed: {
      category: "mobility",
      aggregationStyle: "discrete",
      appleIdentifier: "HKQuantityTypeIdentifier.walkingSpeed",
    },
    walking_step_length: {
      category: "mobility",
      aggregationStyle: "discrete",
      appleIdentifier: "HKQuantityTypeIdentifier.walkingStepLength",
    },
    walking_double_support_percentage: {
      category: "mobility",
      aggregationStyle: "discrete",
      appleIdentifier: "HKQuantityTypeIdentifier.walkingDoubleSupportPercentage",
    },
    walking_asymmetry_percentage: {
      category: "mobility",
      aggregationStyle: "discrete",
      appleIdentifier: "HKQuantityTypeIdentifier.walkingAsymmetryPercentage",
    },
    headphone_audio_exposure: {
      category: "hearing",
      aggregationStyle: "discrete",
      appleIdentifier: "HKQuantityTypeIdentifier.headphoneAudioExposure",
    },
  };
  return defs[metric];
}

function normalizeMetricValue(metric: string, value: number, unit: string | null): { value: number; unit: string } {
  if (metric === "walking_running_distance") return { value: asDistanceKm(value, unit) ?? value, unit: "km" };
  if (metric === "walking_speed") return { value: speedAsKmh(value, unit), unit: "km/hr" };
  if (metric === "walking_step_length") return { value: lengthAsCm(value, unit), unit: "cm" };
  if (metric === "walking_double_support_percentage" || metric === "walking_asymmetry_percentage") {
    return { value: percentValue(value, unit), unit: "%" };
  }
  if (metric === "headphone_audio_exposure") return { value, unit: "dBASPL" };
  return { value, unit: unit ?? "count" };
}

function metricRecords(body: JsonRecord | JsonRecord[]): JsonRecord[] {
  const source = Array.isArray(body) ? body : arrayAt(body, ["metrics", "healthMetrics", "data"]);
  const out: JsonRecord[] = [];
  for (const item of source) {
    if (!isRecord(item)) continue;
    const nested = arrayAt(item, ["data", "values", "samples"]);
    if (nested.length === 0) {
      out.push(item);
      continue;
    }
    for (const point of nested) {
      out.push({
        metric: strAt(item, ["metric", "name", "type", "identifier", "title"]),
        unit: strAt(item, ["unit", "units"]),
        ...(isRecord(point) ? point : { value: point }),
      });
    }
  }
  return out;
}

function arrayAt(body: unknown, keys: string[]): unknown[] {
  if (Array.isArray(body)) return body;
  if (!isRecord(body)) return [];
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) return value;
  }
  for (const value of Object.values(body)) {
    if (isRecord(value)) {
      const nested = arrayAt(value, keys);
      if (nested.length) return nested;
    }
  }
  return [];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strAt(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function numAt(record: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = parseNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function recordDateTime(record: JsonRecord) {
  return strAt(record, ["date", "datetime", "timestamp", "start", "startDate", "start_time", "Start", "日期/时间", "开始"]);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const n = Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[\s+\-()[\]/]+/g, "_");
}

function hasAny(value: string, needles: string[]) {
  return needles.some(needle => value.includes(needle));
}

function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  const withTz = text.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);
  if (withTz) return `${withTz[1]}T${withTz[2]}${withTz[3]}:${withTz[4]}`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) return `${text.replace(" ", "T")}+08:00`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00+08:00`;
  return text;
}

function weightAsKg(value: number, unit: string | null) {
  const normalized = (unit ?? "").toLowerCase();
  return normalized.includes("lb") ? Math.round(value * 0.45359237 * 100) / 100 : value;
}

function energyAsKcal(value: number | null, unit: string | null) {
  if (value === null) return undefined;
  const normalized = (unit ?? "").toLowerCase();
  if (normalized.includes("kj") || normalized.includes("千焦")) return Math.round((value / 4.184) * 10) / 10;
  return value;
}

function durationValueAsMin(value: number, unit: string | null) {
  const normalized = (unit ?? "").toLowerCase();
  if (normalized.includes("hour") || normalized.includes("hr") || normalized.includes("小时")) return Math.round(value * 60);
  if (normalized.includes("sec") || normalized.includes("秒")) return Math.round(value / 60);
  return Math.round(value);
}

function durationMinFrom(record: JsonRecord) {
  const direct = numAt(record, ["durationMin", "duration_min", "durationMinutes"]);
  if (direct !== null) return Math.round(direct);
  const value = numAt(record, ["duration", "Duration"]);
  if (value !== null) return durationValueAsMin(value, strAt(record, ["durationUnit", "unit"]));
  const text = strAt(record, ["duration", "Duration"]);
  const hms = text?.match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
  if (!hms) return null;
  return Math.round(Number(hms[1] ?? 0) * 60 + Number(hms[2]) + Number(hms[3]) / 60);
}

function asDistanceKm(value: number | null, unit: string | null) {
  if (value === null) return undefined;
  const normalized = (unit ?? "").toLowerCase();
  if (normalized === "m" || normalized.includes("meter") || normalized.includes("米")) return Math.round((value / 1000) * 100) / 100;
  if (normalized.includes("mi")) return Math.round(value * 1.609344 * 100) / 100;
  return value;
}

function speedAsKmh(value: number, unit: string | null) {
  const normalized = (unit ?? "").toLowerCase();
  if (normalized.includes("m/s") || normalized.includes("meter/second")) return Math.round(value * 3.6 * 100) / 100;
  if (normalized.includes("mph")) return Math.round(value * 1.609344 * 100) / 100;
  return value;
}

function lengthAsCm(value: number, unit: string | null) {
  const normalized = (unit ?? "").toLowerCase();
  if (normalized === "m" || normalized.includes("meter") || normalized.includes("米")) return Math.round(value * 100 * 100) / 100;
  if (normalized.includes("mm")) return Math.round((value / 10) * 100) / 100;
  if (normalized.includes("inch") || normalized === "in") return Math.round(value * 2.54 * 100) / 100;
  return value;
}

function percentValue(value: number, unit: string | null) {
  const normalized = (unit ?? "").toLowerCase();
  if ((normalized.includes("%") || normalized.includes("percent")) && value > 0 && value <= 1) {
    return Math.round(value * 100 * 100) / 100;
  }
  return value;
}

function compactJson(value: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== null && val !== undefined && val !== "") clean[key] = val;
  }
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

function add(current: number | undefined, next: number | undefined) {
  return next === undefined ? current : Math.round(((current ?? 0) + next) * 100) / 100;
}

function addStat(current: Stat | undefined, next: number | undefined): Stat | undefined {
  if (next === undefined || !Number.isFinite(next)) return current;
  return {
    sum: Math.round(((current?.sum ?? 0) + next) * 100) / 100,
    count: (current?.count ?? 0) + 1,
    max: current?.max === undefined ? next : Math.max(current.max, next),
  };
}

function avgStat(stat: Stat | undefined) {
  if (!stat || stat.count === 0) return null;
  return Math.round((stat.sum / stat.count) * 100) / 100;
}

function hasDailyActivitySummary(item: DailyHealth) {
  return [
    item.steps,
    item.distanceKm,
    item.flightsClimbed,
    item.walkingSpeedKmh?.count,
    item.walkingStepLengthCm?.count,
    item.walkingDoubleSupportPct?.count,
    item.walkingAsymmetryPct?.count,
    item.headphoneAudioExposureDbaspl?.count,
  ].some(v => v !== undefined && v > 0);
}

function hash(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

// ─── boot ─────────────────────────────────────────
serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" });
console.log(JSON.stringify({
  ts: nowISO(),
  msg: "health-intake.listening",
  port: PORT,
  pid: process.pid,
}));

// 优雅退出 —— systemd 重启 / kill -TERM 时 flush 数据库
async function shutdown() {
  console.log(JSON.stringify({ ts: nowISO(), msg: "health-intake.shutdown" }));
  await pool.end().catch(() => undefined);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
