/**
 * MCP tools for the 计划管理 module — gives Hermes / Codex / Claude Desktop
 * the full CRUD surface over plans, goals, and tasks plus high-leverage
 * helpers (decompose intent, analyze progress, today's tasks, blockers).
 *
 * Storage: single-blob via GreatMeRepo. Each write does a read-modify-write
 * and bumps `version`. Concurrent writes from the UI use the same version
 * field at the HTTP layer (PUT /api/great-me/state), so cross-process
 * conflicts surface to UI as a 409 on its next save and trigger a refetch.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GreatMeRepo } from "../repos/GreatMeRepo.js";
import type { AIAdapter } from "../ai/adapter.js";
import { pickScenarioAdapter } from "../ai/pickAdapter.js";
import { runDecomposePlan, runAnalyzeProgress } from "../ai/operations.js";

/* -------------------------------------------------------------------------- */
/* Local types — mirror the GreatMeStateSchema in routes/greatMe.ts, but kept
 * loose. We don't re-validate (the UI's PUT route does). We only need enough
 * shape to read/mutate safely. */

type Scope = "year" | "month" | "week";
type PlanScope = "year" | "month" | "week" | "day";

interface Plan {
  id: string;
  title: string;
  detail?: string;
  start: string;
  end: string;
  scopes: PlanScope[];
  status: "active" | "archived" | "completed";
  source: "user" | "ai-decompose";
  createdAt: number;
  archivedAt?: number;
}
interface Goal {
  id: string;
  scope: Scope;
  title: string;
  detail: string;
  phase: "calibrate" | "execute" | "review" | "close";
  due: string;
  progress: number;
  createdAt: number;
  planId?: string;
  parentId?: string;
  source?: "user" | "ai" | "ai-confirmed";
  metric?: { unit: string; target: number; actual?: number };
}
interface Task {
  id: string;
  title: string;
  done: boolean;
  date: string;
  badge: string;
  goalId: string;
  note: string;
  source?: "user" | "ai" | "ai-template";
}
interface GreatMeState {
  profile: Record<string, unknown>;
  plans: Plan[];
  goals: Goal[];
  tasks: Task[];
  events: unknown[];
  daily: unknown[];
  reviews: unknown[];
  ability: Record<string, number>;
  compounding: { score: number; trend: number[]; topAssets: string[]; topBlockers: string[] };
  conversations: unknown[];
  activeSection: string;
  activeRange: string;
  soundOn: boolean;
  version: number;
}

const DEFAULT_STATE: GreatMeState = {
  profile: { codename: "大斌哥", city: "", mbti: "", background: "", hqPersonality: "nova", weekStart: 1 },
  plans: [],
  goals: [], tasks: [], events: [], daily: [], reviews: [],
  ability: { execution: 0, focus: 0, rhythm: 0, review: 0, recovery: 0, evidence: 0 },
  compounding: { score: 0, trend: [], topAssets: [], topBlockers: [] },
  conversations: [],
  activeSection: "home", activeRange: "week", soundOn: true,
  version: 0,
};

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayYmd = (): string => ymd(new Date());
const uid = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/* -------------------------------------------------------------------------- */
/* Load / save helpers */

async function loadState(repo: GreatMeRepo): Promise<GreatMeState> {
  const raw = await repo.get();
  if (raw == null) return { ...DEFAULT_STATE };
  return { ...DEFAULT_STATE, ...(raw as Partial<GreatMeState>) };
}

async function saveState(repo: GreatMeRepo, prev: GreatMeState, next: Partial<GreatMeState>): Promise<GreatMeState> {
  const merged: GreatMeState = { ...prev, ...next, version: (prev.version ?? 0) + 1 };
  await repo.put(merged);
  return merged;
}

/* -------------------------------------------------------------------------- */
/* Analytics helpers (mirrors apps/web/src/lib/analytics.ts) */

function computeGoalProgress(goalId: string, goals: Goal[], tasks: Task[]): number {
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
  return goals.find(g => g.id === goalId)?.progress ?? 0;
}

function computePlanProgress(planId: string, goals: Goal[], tasks: Task[]): number {
  const mine = goals.filter(g => g.planId === planId);
  if (mine.length === 0) return 0;
  const byScope = (s: Scope): Goal[] => mine.filter(g => g.scope === s);
  const pick = byScope("week").length > 0 ? byScope("week")
             : byScope("month").length > 0 ? byScope("month")
             : byScope("year");
  if (pick.length === 0) return 0;
  const sum = pick.reduce((acc, g) => acc + computeGoalProgress(g.id, goals, tasks), 0);
  return Math.round(sum / pick.length);
}

function planHealthOf(plan: Plan, goals: Goal[], tasks: Task[]): {
  progress: number; timeProgress: number; delta: number;
  status: "healthy"|"behind"|"critical"|"completed"|"no-time";
  weekDone: number; weekTotal: number; daysLeft: number;
} {
  const progress = computePlanProgress(plan.id, goals, tasks);
  let timeProgress = 0;
  let validTime = false;
  if (plan.start && plan.end) {
    const startMs = Date.parse(plan.start);
    const endMs = Date.parse(plan.end);
    if (endMs > startMs) {
      timeProgress = Math.max(0, Math.min(100, Math.round(((Date.now() - startMs) / (endMs - startMs)) * 100)));
      validTime = true;
    }
  }
  const delta = progress - timeProgress;
  let status: "healthy"|"behind"|"critical"|"completed"|"no-time";
  if (progress >= 100) status = "completed";
  else if (!validTime) status = "no-time";
  else if (delta >= -5) status = "healthy";
  else if (delta >= -20) status = "behind";
  else status = "critical";

  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const ws = ymd(weekStart), we = ymd(weekEnd);
  const planGoalIds = new Set(goals.filter(g => g.planId === plan.id).map(g => g.id));
  const wt = tasks.filter(t => planGoalIds.has(t.goalId) && t.date >= ws && t.date <= we);
  const weekDone = wt.filter(t => t.done).length;
  const weekTotal = wt.length;
  const daysLeft = plan.end ? Math.ceil((Date.parse(plan.end) - Date.now()) / 86400000) : 0;
  return { progress, timeProgress, delta, status, weekDone, weekTotal, daysLeft };
}

/* -------------------------------------------------------------------------- */
/* Tool registration */

export function registerPlanTools(
  server: McpServer,
  greatMe: GreatMeRepo,
  adapters: AIAdapter[],
  eventBus: import("../lib/eventBus.js").RichEventBus,
): void {
  const ok = (obj: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(obj) }] });
  const err = (msg: string) => ({ isError: true, content: [{ type: "text" as const, text: msg }] });
  const fire = (op: string, detail: Record<string, unknown>): void => {
    eventBus.publish("greatme.changed", { source: "mcp", detail: { op, ...detail } });
  };

  /* ============================ PLAN CRUD ================================= */

  server.tool(
    "plan_list",
    "List 计划 (plans) in the 计划管理 module. Returns each plan with its real-time progress, time-progress, health status (healthy/behind/critical/completed/no-time), days-left, and this-week task counts. Use status='all' to include archived/completed. This is the first tool you should call to orient — 大斌哥's plans live here and goals/tasks dangle off them.",
    {
      status: z.enum(["active", "archived", "completed", "all"]).default("active")
        .describe("Filter. Default 'active' = only the plans 大斌哥 is currently working on."),
    },
    async ({ status }) => {
      const s = await loadState(greatMe);
      let plans = s.plans;
      if (status !== "all") plans = plans.filter(p => p.status === status);
      const enriched = plans.map(p => ({
        ...p,
        health: planHealthOf(p, s.goals, s.tasks),
        goalCount: s.goals.filter(g => g.planId === p.id).length,
      }));
      return ok({ count: enriched.length, plans: enriched });
    },
  );

  server.tool(
    "plan_get",
    "Fetch one 计划 with its full goal tree + tasks. Returns plan, all goals under it (year→month→week with parentId chains), and all tasks attached to those goals. Use this when you need to reason about a single plan's structure — e.g. before suggesting how to push it.",
    { id: z.string().min(1).describe("Plan id (e.g. 'plan-mpinueuf').") },
    async ({ id }) => {
      const s = await loadState(greatMe);
      const plan = s.plans.find(p => p.id === id);
      if (!plan) return err(`Plan ${id} not found`);
      const goals = s.goals.filter(g => g.planId === id);
      const goalIds = new Set(goals.map(g => g.id));
      const tasks = s.tasks.filter(t => goalIds.has(t.goalId));
      return ok({
        plan,
        health: planHealthOf(plan, s.goals, s.tasks),
        goals,
        tasks,
      });
    },
  );

  server.tool(
    "plan_create",
    "Create a new EMPTY plan. Use this when 大斌哥 just wants a bucket — for AI-decomposed plans use `plan_decompose` instead (it creates plan + goals + tasks in one shot). After creating, use `goal_create` / `task_create` to populate.",
    {
      title: z.string().min(1).max(200),
      detail: z.string().max(800).optional(),
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("ISO YYYY-MM-DD. Defaults to today."),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("ISO YYYY-MM-DD. If omitted, plan has no due date."),
      scopes: z.array(z.enum(["year", "month", "week", "day"])).max(4).default(["month", "week", "day"]),
    },
    async ({ title, detail, start, end, scopes }) => {
      const s = await loadState(greatMe);
      const newPlan: Plan = {
        id: uid("plan"),
        title, detail,
        start: start ?? todayYmd(),
        end: end ?? "",
        scopes,
        status: "active",
        source: "user",
        createdAt: Date.now(),
      };
      await saveState(greatMe, s, { plans: [...s.plans, newPlan] });
      fire("plan.create", { id: newPlan.id });
      return ok({ ok: true, plan: newPlan });
    },
  );

  server.tool(
    "plan_update",
    "Patch fields on an existing plan. Pass only the fields you want to change. Use status='completed' to mark done, status='archived' to hide. Title/detail/dates can all be changed.",
    {
      id: z.string().min(1),
      title: z.string().min(1).max(200).optional(),
      detail: z.string().max(800).optional(),
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      status: z.enum(["active", "archived", "completed"]).optional(),
    },
    async ({ id, ...patch }) => {
      const s = await loadState(greatMe);
      const idx = s.plans.findIndex(p => p.id === id);
      if (idx < 0) return err(`Plan ${id} not found`);
      const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const updated = { ...s.plans[idx], ...cleaned };
      const plans = [...s.plans]; plans[idx] = updated;
      await saveState(greatMe, s, { plans });
      fire("plan.update", { id });
      return ok({ ok: true, plan: updated });
    },
  );

  server.tool(
    "plan_delete",
    "Delete a plan and CASCADE delete all its goals + tasks. This is destructive — only use when 大斌哥 explicitly says 'remove that plan'. Prefer plan_update with status='archived' to hide without losing the data.",
    { id: z.string().min(1) },
    async ({ id }) => {
      const s = await loadState(greatMe);
      const plan = s.plans.find(p => p.id === id);
      if (!plan) return err(`Plan ${id} not found`);
      const goalIds = new Set(s.goals.filter(g => g.planId === id).map(g => g.id));
      const plans = s.plans.filter(p => p.id !== id);
      const goals = s.goals.filter(g => g.planId !== id);
      const tasks = s.tasks.filter(t => !goalIds.has(t.goalId));
      await saveState(greatMe, s, { plans, goals, tasks });
      fire("plan.delete", { id, removedGoals: goalIds.size, removedTasks: s.tasks.length - tasks.length });
      return ok({ ok: true, removedGoals: goalIds.size, removedTasks: s.tasks.length - tasks.length });
    },
  );

  /* ============================ GOAL CRUD ================================= */

  server.tool(
    "goal_list",
    "List goals across all plans, with optional filters. Returns each goal with its real-time dynamic progress (recursively computed from descendant task completion). Use planId to scope to one plan, scope to filter by year/month/week, parentId to get direct children of a goal.",
    {
      planId: z.string().optional(),
      scope: z.enum(["year", "month", "week"]).optional(),
      parentId: z.string().optional(),
    },
    async ({ planId, scope, parentId }) => {
      const s = await loadState(greatMe);
      let goals = s.goals;
      if (planId) goals = goals.filter(g => g.planId === planId);
      if (scope) goals = goals.filter(g => g.scope === scope);
      if (parentId !== undefined) goals = goals.filter(g => g.parentId === parentId);
      const enriched = goals.map(g => ({
        ...g,
        dynamicProgress: computeGoalProgress(g.id, s.goals, s.tasks),
        taskCount: s.tasks.filter(t => t.goalId === g.id).length,
        doneCount: s.tasks.filter(t => t.goalId === g.id && t.done).length,
      }));
      return ok({ count: enriched.length, goals: enriched });
    },
  );

  server.tool(
    "goal_create",
    "Create a new goal under a plan. scope determines layer (year/month/week). parentId optionally nests under another goal (e.g. a week goal under a month goal). Hand-rolled progress (0-100) is stored but the UI recomputes dynamic progress from task completion.",
    {
      planId: z.string().min(1),
      scope: z.enum(["year", "month", "week"]),
      title: z.string().min(1).max(280),
      detail: z.string().max(800).default(""),
      due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("ISO YYYY-MM-DD"),
      parentId: z.string().optional(),
      metric: z.object({
        unit: z.string().max(20),
        target: z.number(),
      }).optional(),
    },
    async ({ planId, scope, title, detail, due, parentId, metric }) => {
      const s = await loadState(greatMe);
      if (!s.plans.some(p => p.id === planId)) return err(`Plan ${planId} not found`);
      if (parentId && !s.goals.some(g => g.id === parentId)) return err(`Parent goal ${parentId} not found`);
      const newGoal: Goal = {
        id: uid("g"),
        scope, title, detail,
        phase: "execute",
        due,
        progress: 0,
        createdAt: Date.now(),
        planId, parentId,
        source: "ai",
        metric,
      };
      await saveState(greatMe, s, { goals: [...s.goals, newGoal] });
      fire("goal.create", { id: newGoal.id, planId });
      return ok({ ok: true, goal: newGoal });
    },
  );

  server.tool(
    "goal_update",
    "Patch fields on an existing goal. Common uses: rename title, push out the due date, change parentId to reorganize the tree, set progress manually when a goal isn't task-driven.",
    {
      id: z.string().min(1),
      title: z.string().min(1).max(280).optional(),
      detail: z.string().max(800).optional(),
      due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      parentId: z.string().optional(),
      progress: z.number().int().min(0).max(100).optional(),
      phase: z.enum(["calibrate", "execute", "review", "close"]).optional(),
    },
    async ({ id, ...patch }) => {
      const s = await loadState(greatMe);
      const idx = s.goals.findIndex(g => g.id === id);
      if (idx < 0) return err(`Goal ${id} not found`);
      const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const updated = { ...s.goals[idx], ...cleaned };
      const goals = [...s.goals]; goals[idx] = updated;
      await saveState(greatMe, s, { goals });
      fire("goal.update", { id });
      return ok({ ok: true, goal: updated });
    },
  );

  server.tool(
    "goal_delete",
    "Delete a goal. CASCADES: also deletes its descendant goals (any goal whose parentId chain leads to this one) AND every task attached to any of them. Destructive — prefer goal_update to clean up instead.",
    { id: z.string().min(1) },
    async ({ id }) => {
      const s = await loadState(greatMe);
      if (!s.goals.some(g => g.id === id)) return err(`Goal ${id} not found`);
      // Build descendant set via BFS
      const toDelete = new Set<string>([id]);
      let frontier = [id];
      while (frontier.length > 0) {
        const next: string[] = [];
        for (const pid of frontier) {
          for (const g of s.goals) {
            if (g.parentId === pid && !toDelete.has(g.id)) {
              toDelete.add(g.id);
              next.push(g.id);
            }
          }
        }
        frontier = next;
      }
      const goals = s.goals.filter(g => !toDelete.has(g.id));
      const tasks = s.tasks.filter(t => !toDelete.has(t.goalId));
      await saveState(greatMe, s, { goals, tasks });
      fire("goal.delete", { id, removedGoals: toDelete.size, removedTasks: s.tasks.length - tasks.length });
      return ok({ ok: true, removedGoals: toDelete.size, removedTasks: s.tasks.length - tasks.length });
    },
  );

  /* ============================ TASK CRUD ================================= */

  server.tool(
    "task_list",
    "List tasks with optional filters. The most common Hermes use: task_list({ date: 'today' }) to see what 大斌哥 has on his plate today. Other filters: planId scopes to one plan, goalId to one goal's tasks, done=true|false to filter by completion. Returns each task with title/date/goalId/done.",
    {
      date: z.string().optional().describe("ISO YYYY-MM-DD, or 'today' / 'overdue'. 'overdue' = date<today AND done=false. Omit for all dates."),
      planId: z.string().optional(),
      goalId: z.string().optional(),
      done: z.boolean().optional().describe("true=only done, false=only undone, omit=both"),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ date, planId, goalId, done, limit }) => {
      const s = await loadState(greatMe);
      let tasks = s.tasks;

      if (date === "today") {
        tasks = tasks.filter(t => t.date === todayYmd());
      } else if (date === "overdue") {
        const today = todayYmd();
        tasks = tasks.filter(t => !t.done && t.date && t.date < today);
      } else if (date) {
        tasks = tasks.filter(t => t.date === date);
      }

      if (planId) {
        const planGoalIds = new Set(s.goals.filter(g => g.planId === planId).map(g => g.id));
        tasks = tasks.filter(t => planGoalIds.has(t.goalId));
      }
      if (goalId) tasks = tasks.filter(t => t.goalId === goalId);
      if (done !== undefined) tasks = tasks.filter(t => t.done === done);

      tasks = tasks.slice(0, limit);

      // Decorate with goal/plan titles for AI legibility
      const goalById = new Map(s.goals.map(g => [g.id, g]));
      const planById = new Map(s.plans.map(p => [p.id, p]));
      const enriched = tasks.map(t => {
        const g = goalById.get(t.goalId);
        const p = g?.planId ? planById.get(g.planId) : null;
        return { ...t, goalTitle: g?.title ?? null, planTitle: p?.title ?? null };
      });
      return ok({ count: enriched.length, tasks: enriched });
    },
  );

  server.tool(
    "task_create",
    "Create a task. If goalId is given it attaches to that goal (contributes to plan progress). If goalId is omitted the task is 'orphan' and won't move any plan needle — orphan is OK for ad-hoc todos, but for plan execution prefer attaching to a goal.",
    {
      title: z.string().min(1).max(280),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("ISO YYYY-MM-DD. Use today's date for 'do today'."),
      goalId: z.string().optional(),
      badge: z.string().max(20).default("").describe("Optional tag like '每日' / '可选'"),
      note: z.string().max(400).default(""),
    },
    async ({ title, date, goalId, badge, note }) => {
      const s = await loadState(greatMe);
      if (goalId && !s.goals.some(g => g.id === goalId)) return err(`Goal ${goalId} not found`);
      const newTask: Task = {
        id: uid("t"),
        title, done: false, date,
        badge, goalId: goalId ?? "", note,
        source: "ai",
      };
      await saveState(greatMe, s, { tasks: [...s.tasks, newTask] });
      fire("task.create", { id: newTask.id, goalId: newTask.goalId });
      return ok({ ok: true, task: newTask });
    },
  );

  server.tool(
    "task_update",
    "Patch fields on an existing task. Common: change `date` to reschedule, change `goalId` to re-attach to a different goal, change `title` to rename. To mark done/undone, prefer task_complete (clearer).",
    {
      id: z.string().min(1),
      title: z.string().min(1).max(280).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      goalId: z.string().optional(),
      badge: z.string().max(20).optional(),
      note: z.string().max(400).optional(),
      done: z.boolean().optional(),
    },
    async ({ id, ...patch }) => {
      const s = await loadState(greatMe);
      const idx = s.tasks.findIndex(t => t.id === id);
      if (idx < 0) return err(`Task ${id} not found`);
      if (patch.goalId !== undefined && patch.goalId !== "" && !s.goals.some(g => g.id === patch.goalId)) {
        return err(`Goal ${patch.goalId} not found`);
      }
      const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const updated = { ...s.tasks[idx], ...cleaned };
      const tasks = [...s.tasks]; tasks[idx] = updated;
      await saveState(greatMe, s, { tasks });
      fire("task.update", { id });
      return ok({ ok: true, task: updated });
    },
  );

  server.tool(
    "task_complete",
    "Mark a task done or undone. Equivalent to task_update with `done`, but clearer intent. Pass done=true to mark complete, done=false to un-complete. This is the single most common Hermes action — when 大斌哥 says '我做完了 X' you call this.",
    {
      id: z.string().min(1),
      done: z.boolean().default(true),
    },
    async ({ id, done }) => {
      const s = await loadState(greatMe);
      const idx = s.tasks.findIndex(t => t.id === id);
      if (idx < 0) return err(`Task ${id} not found`);
      const updated = { ...s.tasks[idx], done };
      const tasks = [...s.tasks]; tasks[idx] = updated;
      await saveState(greatMe, s, { tasks });
      fire("task.complete", { id, done });
      return ok({ ok: true, task: updated });
    },
  );

  server.tool(
    "task_delete",
    "Permanently delete a task. Use sparingly — if 大斌哥 just doesn't want to do it today, prefer task_update to move it to a later date.",
    { id: z.string().min(1) },
    async ({ id }) => {
      const s = await loadState(greatMe);
      if (!s.tasks.some(t => t.id === id)) return err(`Task ${id} not found`);
      const tasks = s.tasks.filter(t => t.id !== id);
      await saveState(greatMe, s, { tasks });
      fire("task.delete", { id });
      return ok({ ok: true });
    },
  );

  /* ========================= ANALYTICS / AI ============================== */

  server.tool(
    "analytics_summary",
    "One-shot read-only snapshot of 大斌哥's推进状况 — equivalent to what the 数据分析 page shows: KPIs (activePlans, weekDone/Total, overallProgress, streak), per-plan health, and 4 blocker buckets (overdue tasks, stuck goals, goals with no tasks, orphan tasks). Use this BEFORE making strategic recommendations.",
    {},
    async () => {
      const s = await loadState(greatMe);
      const today = todayYmd();
      const now = new Date();
      const dayOfWeek = (now.getDay() + 6) % 7;
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
      const ws = ymd(weekStart), we = ymd(weekEnd);
      const weekTasks = s.tasks.filter(t => t.date >= ws && t.date <= we);

      const activePlans = s.plans.filter(p => p.status === "active");
      const overallProgress = activePlans.length === 0
        ? 0
        : Math.round(activePlans.reduce((acc, p) => acc + computePlanProgress(p.id, s.goals, s.tasks), 0) / activePlans.length);

      const doneDates = new Set(s.tasks.filter(t => t.done).map(t => t.date));
      let streak = 0;
      const cursor = new Date();
      for (let i = 0; i < 365; i++) {
        if (doneDates.has(ymd(cursor))) streak++;
        else if (i > 0) break;
        cursor.setDate(cursor.getDate() - 1);
      }

      const overdue = s.tasks.filter(t => !t.done && t.date && t.date < today);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
      const cutoffYmd = ymd(cutoff);
      const stuckGoals = s.goals.filter(g => {
        const ts = s.tasks.filter(t => t.goalId === g.id);
        if (ts.length === 0) return false;
        if (ts.every(t => t.done)) return false;
        return !ts.some(t => t.done && t.date >= cutoffYmd);
      });
      const goalsWithoutTasks = s.goals.filter(g => {
        const hasChildren = s.goals.some(x => x.parentId === g.id);
        if (hasChildren) return false;
        return !s.tasks.some(t => t.goalId === g.id);
      });
      const goalIds = new Set(s.goals.map(g => g.id));
      const orphans = s.tasks.filter(t => !t.done && (!t.goalId || !goalIds.has(t.goalId)));

      return ok({
        kpis: {
          activePlans: activePlans.length,
          weekDone: weekTasks.filter(t => t.done).length,
          weekTotal: weekTasks.length,
          overallProgress,
          streak,
        },
        planHealths: activePlans.map(p => ({
          id: p.id,
          title: p.title,
          ...planHealthOf(p, s.goals, s.tasks),
        })).sort((a, b) => {
          const order = { critical: 0, behind: 1, healthy: 2, "no-time": 3, completed: 4 };
          return order[a.status] - order[b.status];
        }),
        blockers: {
          overdueTasks: overdue.slice(0, 20).map(t => ({ id: t.id, title: t.title, date: t.date, goalId: t.goalId })),
          overdueCount: overdue.length,
          stuckGoals: stuckGoals.slice(0, 20).map(g => ({ id: g.id, title: g.title, planId: g.planId })),
          stuckCount: stuckGoals.length,
          goalsWithoutTasks: goalsWithoutTasks.slice(0, 20).map(g => ({ id: g.id, title: g.title, planId: g.planId })),
          emptyGoalCount: goalsWithoutTasks.length,
          orphanTasks: orphans.slice(0, 20).map(t => ({ id: t.id, title: t.title, date: t.date })),
          orphanTaskCount: orphans.length,
        },
      });
    },
  );

  server.tool(
    "plan_decompose",
    "🪄 Take 大斌哥's natural-language intent ('我想 3 个月减 10 斤') and ask Hermes/Codex to decompose it into a full plan tree (plan + year/month/week goals + day tasks). Writes the result directly into state — returns the new plan id. Granularity is AI-decided (short windows skip year/month). Takes 30-90 seconds. Use this when 大斌哥 says '帮我做一个 X 的计划' instead of `plan_create` (which makes empty).",
    {
      intent: z.string().min(2).max(500).describe("用户的自然语言意图，例如 '我想 3 个月减 10 斤'"),
      targetEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional target completion date. If omitted, AI picks one based on the intent."),
      model: z.enum(["claude-code", "codex", "hermes", "bailian"]).optional().describe("Defaults to hermes."),
    },
    async ({ intent, targetEnd, model }) => {
      const adapter = pickScenarioAdapter(adapters, "planning", model);
      if (!(await adapter.available())) return err(`${adapter.name} unavailable`);
      const today = todayYmd();

      // Run the AI
      let result: import("../ai/operations.js").DecomposePlanResult | null = null;
      let lastError = "";
      for await (const ev of runDecomposePlan(adapter, { intent, today, targetEnd })) {
        if (ev.type === "error") { lastError = ev.message; break; }
        if (ev.type === "done") { result = ev.result; break; }
      }
      if (!result) return err(lastError || "decompose failed");

      // Persist result (mirrors the client-side persistDecompose)
      const s = await loadState(greatMe);
      const now = Date.now();
      const newPlanId = `plan-${now.toString(36)}`;
      const goalIdMap = new Map<string, string>();
      result.goals.forEach((g, i) => goalIdMap.set(g.tempId, `g-${now.toString(36)}-${i}`));

      const newGoals: Goal[] = result.goals.map(g => ({
        id: goalIdMap.get(g.tempId)!,
        scope: g.scope,
        title: g.title,
        detail: g.detail ?? "",
        phase: "execute",
        due: g.due,
        progress: 0,
        createdAt: now,
        planId: newPlanId,
        parentId: g.parentTempId ? goalIdMap.get(g.parentTempId) : undefined,
        source: "ai",
        metric: g.metric,
      }));

      const newTasks: Task[] = result.tasks
        .filter(t => !t.goalTempId || goalIdMap.has(t.goalTempId))
        .map((t, i) => ({
          id: `t-${now.toString(36)}-${i}`,
          title: t.title,
          done: false,
          date: t.date,
          badge: t.badge ?? "",
          goalId: t.goalTempId ? (goalIdMap.get(t.goalTempId) ?? "") : "",
          note: t.note ?? "",
          source: "ai",
        }));

      const newPlan: Plan = {
        id: newPlanId,
        title: result.plan.title,
        detail: result.plan.detail,
        start: result.plan.start,
        end: result.plan.end,
        scopes: result.plan.scopes,
        status: "active",
        source: "ai-decompose",
        createdAt: now,
      };

      await saveState(greatMe, s, {
        plans: [...s.plans, newPlan],
        goals: [...s.goals, ...newGoals],
        tasks: [...s.tasks, ...newTasks],
      });
      fire("plan.decompose", { id: newPlanId, goalCount: newGoals.length, taskCount: newTasks.length });

      return ok({
        ok: true,
        planId: newPlanId,
        goalCount: newGoals.length,
        taskCount: newTasks.length,
        reasoning: result.reasoning,
      });
    },
  );

  server.tool(
    "analyze_progress",
    "🪄 Ask Hermes to analyze 大斌哥's overall推进 and return strategic advice. Returns { keyInsight, blockers, pushActions, priorityTasks }. Internally pulls a snapshot via analytics_summary then prompts the AI. Use this when 大斌哥 says 'I feel stuck' or 'what should I do next' — gives a structured response. Takes 30-60 seconds.",
    {
      model: z.enum(["claude-code", "codex", "hermes", "bailian"]).optional(),
    },
    async ({ model }) => {
      const adapter = pickScenarioAdapter(adapters, "analysis", model);
      if (!(await adapter.available())) return err(`${adapter.name} unavailable`);
      const s = await loadState(greatMe);

      // Pre-compute metrics (same shape the UI client passes)
      const activePlans = s.plans.filter(p => p.status === "active");
      const planHealthList = activePlans.map(p => {
        const h = planHealthOf(p, s.goals, s.tasks);
        return {
          title: p.title,
          progress: h.progress,
          timeProgress: h.timeProgress,
          delta: h.delta,
          status: h.status,
          weekDone: h.weekDone,
          weekTotal: h.weekTotal,
        };
      });
      const today = todayYmd();
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
      const cutoffYmd = ymd(cutoff);
      const overdue = s.tasks.filter(t => !t.done && t.date && t.date < today);
      const stuck = s.goals.filter(g => {
        const ts = s.tasks.filter(t => t.goalId === g.id);
        if (ts.length === 0) return false;
        if (ts.every(t => t.done)) return false;
        return !ts.some(t => t.done && t.date >= cutoffYmd);
      });
      const empties = s.goals.filter(g => {
        const hasChildren = s.goals.some(x => x.parentId === g.id);
        if (hasChildren) return false;
        return !s.tasks.some(t => t.goalId === g.id);
      });
      const goalIds = new Set(s.goals.map(g => g.id));
      const orphans = s.tasks.filter(t => !t.done && (!t.goalId || !goalIds.has(t.goalId)));

      const metrics = {
        planHealthList,
        overdueCount: overdue.length,
        stuckCount: stuck.length,
        emptyGoalCount: empties.length,
        orphanTaskCount: orphans.length,
      };
      const stateForPrompt = {
        plans: s.plans, goals: s.goals, tasks: s.tasks,
      };

      let result: import("../ai/operations.js").AnalyzeProgressResult | null = null;
      let lastError = "";
      for await (const ev of runAnalyzeProgress(adapter, { state: stateForPrompt, metrics })) {
        if (ev.type === "error") { lastError = ev.message; break; }
        if (ev.type === "done") { result = ev.result; break; }
      }
      if (!result) return err(lastError || "analyze failed");
      return ok({ ok: true, ...result });
    },
  );
}
