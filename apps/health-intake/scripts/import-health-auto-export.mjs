#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";

const zipPath = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!zipPath) {
  console.error("Usage: pnpm --filter @ke/health-intake import:health-auto-export <HealthAutoExport.zip> [--dry-run]");
  process.exit(1);
}

const DATABASE_URL = await resolveDatabaseUrl();
const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

try {
  const entries = zipEntries(zipPath);
  const now = new Date().toISOString();
  const stats = {
    raw: 0,
    weight: 0,
    sleep: 0,
    meal: 0,
    workout: 0,
    skipped: 0,
  };

  if (!dryRun) await ensureSchema();

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(".csv")) continue;
    const text = zipText(zipPath, entry);
    if (!text.trim()) continue;

    const rows = csvRows(text);
    const header = rows.shift()?.map(h => h.replace(/^\uFEFF/, "").trim()) ?? [];
    if (header.length === 0) continue;

    const kind = kindForEntry(entry);
    for (let i = 0; i < rows.length; i += 1) {
      const record = objectFromRow(header, rows[i]);
      const recordAt = firstValue(record, ["日期/时间", "Start", "开始"]) ?? null;
      const idBase = `${entry}:${recordAt ?? i}`;
      const rawId = `hae-raw-${hash(idBase)}`;

      await maybeQuery(
        `INSERT INTO health_raw_import (id, source, kind, record_at, payload, imported_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         ON CONFLICT (id) DO UPDATE
         SET payload = EXCLUDED.payload, imported_at = EXCLUDED.imported_at`,
        [rawId, entry, kind, toIso(recordAt), JSON.stringify(record), now],
      );
      stats.raw += 1;

      if (kind === "daily") {
        await importDaily(record, now, stats);
      } else if (kind === "workout") {
        await importWorkout(record, now, stats);
      }
    }
  }

  console.log(JSON.stringify({ dryRun, zip: path.basename(zipPath), stats }, null, 2));
} finally {
  await pool.end().catch(() => undefined);
}

async function importDaily(record, now, stats) {
  const date = dayOf(firstValue(record, ["日期/时间"]));
  if (!date) {
    stats.skipped += 1;
    return;
  }

  const kg = num(record["体重 (千克)"]);
  const bodyFatPct = num(record["体脂百分比 (%)"]);
  if (kg !== null && kg > 20 && kg < 300) {
    await maybeQuery(
      `INSERT INTO health_weight_log (id, logged_at, kg, body_fat_pct, notes, source, created_at)
       VALUES ($1, $2, $3, $4, $5, 'apple-health', $6)
       ON CONFLICT (id) DO UPDATE
       SET logged_at = EXCLUDED.logged_at,
           kg = EXCLUDED.kg,
           body_fat_pct = EXCLUDED.body_fat_pct,
           notes = EXCLUDED.notes`,
      [`hae-weight-${date}`, `${date}T08:00:00+08:00`, kg, bodyFatPct, "Health Auto Export", now],
    );
    stats.weight += 1;
  }

  const sleepHours = num(record["睡眠分析 [睡眠时长] (小时)"]) ?? num(record["睡眠分析 [Total] (小时)"]);
  if (sleepHours !== null && sleepHours > 0) {
    const notes = compactJson({
      inBedHours: num(record["睡眠分析 [在床上] (小时)"]),
      coreHours: num(record["睡眠分析 [核心] (小时)"]),
      deepHours: num(record["睡眠分析 [深度] (小时)"]),
      remHours: num(record["睡眠分析 [快速动眼期] (小时)"]),
      awakeHours: num(record["睡眠分析 [清醒] (小时)"]),
    });
    await maybeQuery(
      `INSERT INTO health_sleep_log (id, sleep_date, duration_min, quality, bedtime, wake_time, notes, source, created_at)
       VALUES ($1, $2, $3, NULL, NULL, NULL, $4, 'apple-health', $5)
       ON CONFLICT (id) DO UPDATE
       SET duration_min = EXCLUDED.duration_min,
           notes = EXCLUDED.notes`,
      [`hae-sleep-${date}`, date, Math.round(sleepHours * 60), notes, now],
    );
    stats.sleep += 1;
  }

  const kcal = kJToKcal(num(record["膳食能量 (kJ)"]));
  const protein = num(record["蛋白质 (克)"]);
  const carb = num(record["碳水化合物 (克)"]);
  const fat = num(record["总脂肪 (克)"]);
  const fiber = num(record["膳食纤维 (克)"]);
  if ([kcal, protein, carb, fat, fiber].some(v => v !== null && v > 0)) {
    await maybeQuery(
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
      [`hae-meal-${date}`, `${date}T23:59:00+08:00`, kcal, protein, carb, fat, fiber, "Health Auto Export daily nutrition", now],
    );
    stats.meal += 1;
  }

  const exerciseMin = num(record["Apple锻炼时间 (分钟)"]);
  const activeKcal = kJToKcal(num(record["活动能量 (kJ)"]));
  const steps = num(record["步数 (步)"]);
  const distanceKm = num(record["步行 + 跑步距离 (km)"]);
  if ((exerciseMin !== null && exerciseMin > 0) || (activeKcal !== null && activeKcal > 0)) {
    const notes = compactJson({ steps, distanceKm, activeKcal });
    await maybeQuery(
      `INSERT INTO health_workout_log
         (id, session_name, performed_at, duration_min, total_volume, rpe_avg, notes, source, created_at)
       VALUES ($1, $2, $3, $4, NULL, NULL, $5, 'apple-health', $6)
       ON CONFLICT (id) DO UPDATE
       SET duration_min = EXCLUDED.duration_min,
           notes = EXCLUDED.notes`,
      [`hae-activity-${date}`, "Apple Health 活动摘要", `${date}T20:00:00+08:00`, exerciseMin !== null ? Math.round(exerciseMin) : null, notes, now],
    );
    stats.workout += 1;
  }
}

async function importWorkout(record, now, stats) {
  const start = firstValue(record, ["Start"]);
  const date = dayOf(start);
  if (!date) {
    stats.skipped += 1;
    return;
  }
  const durationMin = durationToMin(record.Duration);
  const workoutType = firstValue(record, ["Workout Type"]) ?? "Apple Health Workout";
  await maybeQuery(
    `INSERT INTO health_workout_log
       (id, session_name, performed_at, duration_min, total_volume, rpe_avg, notes, source, created_at)
     VALUES ($1, $2, $3, $4, NULL, NULL, $5, 'apple-watch', $6)
     ON CONFLICT (id) DO UPDATE
     SET session_name = EXCLUDED.session_name,
         duration_min = EXCLUDED.duration_min,
         notes = EXCLUDED.notes`,
    [
      `hae-workout-${hash(`${workoutType}:${start}`)}`,
      workoutType,
      toIso(start) ?? `${date}T12:00:00+08:00`,
      durationMin,
      compactJson({
        end: firstValue(record, ["End"]),
        distanceKm: num(record["距离 (km)"]),
        activeKcal: kJToKcal(num(record["活动能量 (kJ)"])),
        averageHeartRate: num(record["平均心率 (bpm)"]),
        maxHeartRate: num(record["最大心率 (bpm)"]),
      }),
      now,
    ],
  );
  stats.workout += 1;
}

async function ensureSchema() {
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

async function maybeQuery(sql, params) {
  if (dryRun) return;
  await pool.query(sql, params);
}

async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.RICH_DB_URL) return process.env.RICH_DB_URL;

  const envPath = path.join(os.homedir(), ".rich-cloud-postgres.env");
  const text = await readFile(envPath, "utf8").catch(() => "");
  const env = parseEnv(text);
  if (env.RICH_DB_URL) return env.RICH_DB_URL;
  throw new Error("DATABASE_URL or RICH_DB_URL is required");
}

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    let value = line.slice(idx + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function zipEntries(file) {
  return execFileSync("zipinfo", ["-1", file], { encoding: "utf8" })
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function zipText(file, entry) {
  return execFileSync("unzip", ["-p", file, entry], { encoding: "utf8", maxBuffer: 1024 * 1024 * 100 });
}

function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter(r => r.some(v => v.trim() !== ""));
}

function objectFromRow(header, row) {
  const out = {};
  for (let i = 0; i < header.length; i += 1) {
    out[header[i]] = row[i] ?? "";
  }
  return out;
}

function kindForEntry(entry) {
  const lower = entry.toLowerCase();
  if (lower.includes("workout")) return "workout";
  if (lower.includes("symptom")) return "symptom";
  if (lower.includes("ecg")) return "ecg";
  return "daily";
}

function firstValue(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function num(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function kJToKcal(kj) {
  return kj === null ? null : Math.round((kj / 4.184) * 10) / 10;
}

function dayOf(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function toIso(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const withTz = text.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);
  if (withTz) return `${withTz[1]}T${withTz[2]}${withTz[3]}:${withTz[4]}`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text)) return `${text.replace(" ", "T")}+08:00`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00+08:00`;
  return text;
}

function durationToMin(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return Math.round(numeric);
  const hms = text.match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
  if (!hms) return null;
  const h = Number(hms[1] ?? 0);
  const m = Number(hms[2]);
  const s = Number(hms[3]);
  return Math.round(h * 60 + m + s / 60);
}

function compactJson(value) {
  const clean = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== null && val !== undefined && val !== "") clean[key] = val;
  }
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

function hash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}
