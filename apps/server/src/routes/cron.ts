import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Hermes cron jobs read-only proxy.
 *
 * Hermes stores its scheduled jobs in ~/.hermes/cron/jobs.json. The user
 * creates / pauses / removes jobs by talking to Hermes in the chat overlay
 * ("帮我每天 10 点生成 AI 早报") — Hermes calls its built-in `cronjob` tool
 * which writes to that file. This endpoint just reads it and surfaces the
 * configuration to Rich's admin UI so the user can audit what Hermes has
 * been told to do on their behalf, without leaving Rich.
 *
 * Mutation deliberately NOT exposed here: writing jobs needs Hermes's full
 * validation pipeline (prompt-injection scanner, schedule parser, skill
 * resolver, etc.). The right way to add / edit jobs remains: tell Hermes.
 */

const HERMES_HOME = process.env.HERMES_HOME || join(homedir(), ".hermes");
const JOBS_FILE = join(HERMES_HOME, "cron", "jobs.json");

interface HermesRawJob {
  id?: string;
  name?: string;
  prompt?: string;
  skill?: string;
  skills?: string[];
  schedule?: { kind?: string; expr?: string; display?: string } | string;
  schedule_display?: string;
  /** Hermes stores repeat as { times: number|null, completed: number }. `times`
   * = null means infinite; the integer means "after N runs, auto-pause". */
  repeat?: { times?: number | null; completed?: number } | number;
  deliver?: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string;
  last_error?: string;
  last_delivery_error?: string;
  enabled?: boolean;
  state?: string;
  paused_at?: string;
  paused_reason?: string;
  model?: string;
  provider?: string;
  base_url?: string;
  created_at?: string;
}

interface CronJobView {
  id: string;
  name: string;
  prompt_preview: string;
  schedule: string;
  repeat: string | null;
  state: "scheduled" | "paused" | "unknown";
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_delivery_error: string | null;
  deliver: string;
  skills: string[];
  model: string | null;
  provider: string | null;
}

function repeatDisplay(repeat: HermesRawJob["repeat"]): string | null {
  if (repeat == null) return null;
  if (typeof repeat === "number") {
    if (repeat === 0) return "无限循环";
    if (repeat === 1) return "执行 1 次";
    return `重复 ${repeat} 次`;
  }
  // Object shape: { times, completed }. times=null → infinite.
  const times = repeat.times;
  const completed = repeat.completed ?? 0;
  if (times == null) return completed > 0 ? `无限循环 · 已跑 ${completed} 次` : "无限循环";
  if (times === 1) return completed > 0 ? "已执行完（1/1）" : "执行 1 次";
  return `${completed}/${times} 次`;
}

function formatJob(j: HermesRawJob): CronJobView {
  const id = String(j.id ?? "unknown");
  const prompt = String(j.prompt ?? "");
  const skills = Array.isArray(j.skills) ? j.skills : (j.skill ? [j.skill] : []);
  const name = String(j.name ?? prompt.slice(0, 50) ?? skills[0] ?? id ?? "cron job");
  const stateRaw = j.state ?? (j.enabled === false ? "paused" : "scheduled");
  const state: CronJobView["state"] =
    stateRaw === "scheduled" || stateRaw === "paused" ? stateRaw : "unknown";
  return {
    id,
    name,
    prompt_preview: prompt.length > 140 ? prompt.slice(0, 140) + "..." : prompt,
    schedule: String(j.schedule_display ?? "?"),
    repeat: repeatDisplay(j.repeat),
    state,
    enabled: j.enabled !== false,
    next_run_at: j.next_run_at ?? null,
    last_run_at: j.last_run_at ?? null,
    last_status: j.last_status ?? null,
    last_delivery_error: j.last_delivery_error ?? null,
    deliver: String(j.deliver ?? "local"),
    skills,
    model: j.model ?? null,
    provider: j.provider ?? null,
  };
}

export function cronRoutes(): Hono {
  const r = new Hono();

  // GET /api/cron/jobs — return the current Hermes cron job table.
  // Sorts by next_run_at ascending so the imminent jobs are listed first;
  // null next_run_at (paused / errored) sinks to the bottom.
  r.get("/jobs", async (c) => {
    try {
      const raw = await readFile(JOBS_FILE, "utf-8").catch((err) => {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return '{"jobs":[]}';
        throw err;
      });
      const parsed = JSON.parse(raw) as unknown;
      // Hermes uses `{ jobs: [...], updated_at }` envelope. Tolerate older
      // / hand-edited variants by also accepting a bare array.
      const list: HermesRawJob[] = Array.isArray(parsed)
        ? parsed as HermesRawJob[]
        : (parsed && typeof parsed === "object" && Array.isArray((parsed as { jobs?: unknown }).jobs)
          ? (parsed as { jobs: HermesRawJob[] }).jobs
          : []);
      const formatted = list.map(formatJob);
      formatted.sort((a, b) => {
        if (a.next_run_at && b.next_run_at) return a.next_run_at.localeCompare(b.next_run_at);
        if (a.next_run_at) return -1;
        if (b.next_run_at) return 1;
        return a.name.localeCompare(b.name);
      });
      return c.json({
        ok: true,
        source: JOBS_FILE,
        count: formatted.length,
        jobs: formatted,
      });
    } catch (err) {
      return c.json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        source: JOBS_FILE,
        count: 0,
        jobs: [],
      }, 500);
    }
  });

  return r;
}
