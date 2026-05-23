import { Hono } from "hono";
import { z } from "zod";
import type { GreatMeRepo } from "../repos/GreatMeRepo.js";

/**
 * Persistence for 伟大的我 cockpit (redesigned to match TheGreatMe Mac).
 * Single-blob storage in SQLite `state` table under key `greatme.cockpit.v2`.
 * v1 schema (the old PDCA/axes thing) is deliberately incompatible — server
 * returns null + warning if the blob doesn't parse, so the client falls back
 * to defaults.
 */

const SectionId = z.enum([
  "home", "goals", "events", "analytics", "weekly_review", "mission_control", "settings",
]);
const RangeId = z.enum(["week", "month", "year", "all", "custom"]);
const HQPersonality = z.enum(["nova", "strict", "warm", "custom"]);

const ProfileSchema = z.object({
  codename: z.string().max(80).default(""),
  city: z.string().max(80).default(""),
  mbti: z.string().max(8).default(""),
  background: z.string().max(800).default(""),
  hqPersonality: HQPersonality.default("nova"),
  weekStart: z.number().int().min(0).max(6).default(1),
}).default(() => ({
  codename: "", city: "", mbti: "", background: "", hqPersonality: "nova" as const, weekStart: 1,
}));

const MetricSchema = z.object({
  unit: z.string().max(20),
  target: z.number(),
  actual: z.number().optional(),
});

const GoalSchema = z.object({
  id: z.string().min(1).max(80),
  scope: z.enum(["year", "month", "week"]),
  title: z.string().min(1).max(280),
  detail: z.string().max(800).default(""),
  phase: z.enum(["calibrate", "execute", "review", "close"]).default("execute"),
  due: z.string().max(20).default(""),  // ISO date
  progress: z.number().min(0).max(100).default(0),
  createdAt: z.number(),
  // === 新增（全部 optional 以保兼容） ===
  planId: z.string().max(80).optional(),
  parentId: z.string().max(80).optional(),
  source: z.enum(["user", "ai", "ai-confirmed"]).optional(),
  metric: MetricSchema.optional(),
});

const TaskSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(280),
  done: z.boolean().default(false),
  date: z.string().max(20).default(""),
  badge: z.string().max(20).default(""),  // 每日 / 可选 / ""
  goalId: z.string().max(80).default(""),
  note: z.string().max(400).default(""),
  // === 新增 ===
  source: z.enum(["user", "ai", "ai-template"]).optional(),
  metric: MetricSchema.optional(),
  archived: z.boolean().optional(),
});

const PlanSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  detail: z.string().max(800).optional(),
  start: z.string().max(20).default(""),
  end: z.string().max(20).default(""),
  scopes: z.array(z.enum(["year","month","week","day"])).max(4).default(["month","week","day"]),
  status: z.enum(["active","archived","completed"]).default("active"),
  source: z.enum(["user","ai-decompose"]).default("user"),
  createdAt: z.number(),
  archivedAt: z.number().optional(),
  aiTrace: z.object({
    messageId: z.string().max(120),
    conversationId: z.string().max(120),
    decomposedAt: z.number(),
  }).optional(),
});

const EventSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  heat: z.number().min(1).max(100).default(20),  // 决定泡泡大小
  category: z.string().max(40).default(""),
  updatedAt: z.number(),
  notes: z.array(z.object({
    at: z.number(),
    text: z.string().max(400),
  })).max(200).default([]),
});

const DailyEntrySchema = z.object({
  date: z.string().max(20),  // YYYY-MM-DD
  tomorrowPlan: z.string().max(800).default(""),
  doingToday: z.string().max(800).default(""),
  meditation: z.string().max(400).default(""),
  victoryBlocker: z.string().max(800).default(""),
  nightReport: z.string().max(800).default(""),
});

const ReviewSchema = z.object({
  id: z.string().min(1).max(80),
  weekOf: z.string().max(20),  // ISO date of week start
  score: z.number().min(0).max(100).default(0),
  victory: z.array(z.string().max(280)).max(10).default([]),
  blocker: z.array(z.string().max(280)).max(10).default([]),
  planning: z.array(z.string().max(280)).max(10).default([]),
  summary: z.string().max(2000).default(""),
  createdAt: z.number(),
});

const AbilitySchema = z.object({
  execution: z.number().min(0).max(100).default(0),
  focus: z.number().min(0).max(100).default(0),
  rhythm: z.number().min(0).max(100).default(0),
  review: z.number().min(0).max(100).default(0),
  recovery: z.number().min(0).max(100).default(0),
  evidence: z.number().min(0).max(100).default(0),
}).default(() => ({ execution: 0, focus: 0, rhythm: 0, review: 0, recovery: 0, evidence: 0 }));

const ConversationSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().max(120).default(""),
  personality: HQPersonality.default("nova"),
  createdAt: z.number(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(8000),
    at: z.number(),
  })).max(200).default([]),
});

const GreatMeStateSchema = z.object({
  profile: ProfileSchema,
  plans: z.array(PlanSchema).max(50).default([]),  // ← 新增这一行
  goals: z.array(GoalSchema).max(200).default([]),
  tasks: z.array(TaskSchema).max(500).default([]),
  events: z.array(EventSchema).max(200).default([]),
  daily: z.array(DailyEntrySchema).max(366).default([]),
  reviews: z.array(ReviewSchema).max(200).default([]),
  ability: AbilitySchema,
  compounding: z.object({
    score: z.number().min(0).max(100).default(0),
    trend: z.array(z.number()).max(60).default([]),
    topAssets: z.array(z.string().max(120)).max(5).default([]),
    topBlockers: z.array(z.string().max(120)).max(5).default([]),
  }).default(() => ({ score: 0, trend: [], topAssets: [], topBlockers: [] })),
  conversations: z.array(ConversationSchema).max(50).default([]),
  activeSection: SectionId.default("home"),
  activeRange: RangeId.default("week"),
  soundOn: z.boolean().default(true),
});

export type GreatMeStatePayload = z.infer<typeof GreatMeStateSchema>;

const MAX_BODY_BYTES = 256 * 1024;  // 256KB — larger to fit goals/tasks/events history

export function greatMeRoutes(repo: GreatMeRepo): Hono {
  const r = new Hono();

  r.get("/state", async (c) => {
    const raw = await repo.get();
    if (raw == null) return c.json({ state: null });
    const parsed = GreatMeStateSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ state: null, warning: "stored state failed schema; ignored" });
    }
    return c.json({ state: parsed.data });
  });

  r.put("/state", async (c) => {
    const text = await c.req.text();
    if (text.length > MAX_BODY_BYTES) {
      return c.json({ error: `state too large (>${MAX_BODY_BYTES} bytes)` }, 413);
    }
    let body: unknown;
    try { body = JSON.parse(text); }
    catch { return c.json({ error: "invalid JSON" }, 400); }
    const parsed = GreatMeStateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400);
    }
    await repo.put(parsed.data);
    return c.json({ ok: true });
  });

  return r;
}
