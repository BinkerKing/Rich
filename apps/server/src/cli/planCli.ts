import { join } from "node:path";
import type { GreatMeRepo } from "../repos/GreatMeRepo.js";
import { JsonGreatMeRepo } from "../repos/JsonGreatMeRepo.js";
import { SqliteGreatMeRepo } from "../repos/SqliteGreatMeRepo.js";
import { PostgresGreatMeRepo } from "../repos/PostgresGreatMeRepo.js";
import { openDb } from "../db/sqlite.js";
import { openPostgresPool } from "../db/postgres.js";

type Scope = "year" | "month" | "week";
type PlanScope = Scope | "day";
type PlanStatus = "active" | "archived" | "completed";

interface Plan {
  id: string;
  title: string;
  detail?: string;
  start: string;
  end: string;
  scopes: PlanScope[];
  status: PlanStatus;
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

export interface CliResult { exitCode: number; stdout: string; stderr: string }

type Flags = Record<string, string | boolean | undefined>;

const DEFAULT_STATE: GreatMeState = {
  profile: { codename: "大斌哥", city: "", mbti: "", background: "", hqPersonality: "nova", weekStart: 1 },
  plans: [], goals: [], tasks: [], events: [], daily: [], reviews: [],
  ability: { execution: 0, focus: 0, rhythm: 0, review: 0, recovery: 0, evidence: 0 },
  compounding: { score: 0, trend: [], topAssets: [], topBlockers: [] },
  conversations: [], activeSection: "home", activeRange: "week", soundOn: true, version: 0,
};

const ymd = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayYmd = (): string => ymd(new Date());
const uid = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const scopes = new Set(["year", "month", "week"]);

async function loadState(repo: GreatMeRepo): Promise<GreatMeState> {
  const raw = await repo.get();
  if (raw == null) return { ...DEFAULT_STATE };
  const partial = raw as Partial<GreatMeState>;
  return {
    ...DEFAULT_STATE,
    ...partial,
    plans: partial.plans ?? [],
    goals: partial.goals ?? [],
    tasks: partial.tasks ?? [],
  };
}

async function saveState(repo: GreatMeRepo, prev: GreatMeState, next: Partial<GreatMeState>): Promise<GreatMeState> {
  const merged = { ...prev, ...next, version: (prev.version ?? 0) + 1 };
  await repo.put(merged);
  return merged;
}

function parseArgs(args: string[]): { command: string; resource: string; flags: Flags } {
  const [command = "help", resource = "", ...rest] = args;
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else { flags[key] = next; i += 1; }
  }
  return { command, resource, flags };
}

function str(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}
function required(flags: Flags, key: string): string {
  const v = str(flags, key);
  if (!v) throw new Error(`Missing --${key}`);
  return v;
}
function bool(flags: Flags, key: string): boolean | undefined {
  const v = flags[key];
  if (v === undefined) return undefined;
  if (v === true) return true;
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  throw new Error(`Invalid boolean --${key}: ${v}`);
}
function jsonResult(obj: unknown): CliResult {
  return { exitCode: 0, stdout: `${JSON.stringify(obj)}\n`, stderr: "" };
}
function textResult(obj: unknown): CliResult {
  return { exitCode: 0, stdout: `${JSON.stringify(obj, null, 2)}\n`, stderr: "" };
}
function out(flags: Flags, obj: unknown): CliResult {
  return flags.json ? jsonResult(obj) : textResult(obj);
}
function assertYes(flags: Flags, action: string): void {
  if (!flags.yes) throw new Error(`${action} is destructive. Pass --yes to confirm.`);
}
function resourceKind(resource: string): "plan" | "goal" | "task" | "all" {
  if (resource === "plans" || resource === "plan") return "plan";
  if (resource === "goals" || resource === "goal" || scopes.has(resource)) return "goal";
  if (resource === "tasks" || resource === "task" || resource === "day") return "task";
  if (resource === "all") return "all";
  throw new Error(`Unknown resource: ${resource}`);
}
function scopeFromResource(resource: string, flags: Flags): Scope | undefined {
  if (scopes.has(resource)) return resource as Scope;
  const scope = str(flags, "scope");
  if (!scope) return undefined;
  if (!scopes.has(scope)) throw new Error(`Invalid --scope: ${scope}`);
  return scope as Scope;
}
function parseScopes(value: string | undefined): PlanScope[] {
  if (!value) return ["month", "week", "day"];
  const parsed = value.split(",").map(s => s.trim()).filter(Boolean);
  for (const s of parsed) {
    if (!["year", "month", "week", "day"].includes(s)) throw new Error(`Invalid plan scope: ${s}`);
  }
  return parsed as PlanScope[];
}

function computeGoalProgress(goalId: string, goals: Goal[], tasks: Task[]): number {
  const children = goals.filter(g => g.parentId === goalId);
  if (children.length > 0) return Math.round(children.reduce((acc, c) => acc + computeGoalProgress(c.id, goals, tasks), 0) / children.length);
  const mine = tasks.filter(t => t.goalId === goalId);
  if (mine.length > 0) return Math.round((mine.filter(t => t.done).length / mine.length) * 100);
  return goals.find(g => g.id === goalId)?.progress ?? 0;
}

async function list(repo: GreatMeRepo, resource: string, flags: Flags): Promise<CliResult> {
  const s = await loadState(repo);
  const kind = resourceKind(resource);
  if (kind === "plan") {
    const status = (str(flags, "status") ?? "active") as PlanStatus | "all";
    let plans = s.plans;
    if (status !== "all") plans = plans.filter(p => p.status === status);
    return out(flags, { count: plans.length, plans });
  }
  if (kind === "goal") {
    let goals = s.goals;
    const planId = str(flags, "plan-id") ?? str(flags, "planId");
    const parentId = str(flags, "parent-id") ?? str(flags, "parentId");
    const scope = scopeFromResource(resource, flags);
    if (planId) goals = goals.filter(g => g.planId === planId);
    if (scope) goals = goals.filter(g => g.scope === scope);
    if (parentId !== undefined) goals = goals.filter(g => g.parentId === parentId);
    const enriched = goals.map(g => ({ ...g, dynamicProgress: computeGoalProgress(g.id, s.goals, s.tasks), taskCount: s.tasks.filter(t => t.goalId === g.id).length }));
    return out(flags, { count: enriched.length, goals: enriched });
  }
  if (kind === "task") {
    let tasks = s.tasks;
    const date = str(flags, "date");
    const planId = str(flags, "plan-id") ?? str(flags, "planId");
    const goalId = str(flags, "goal-id") ?? str(flags, "goalId");
    const done = bool(flags, "done");
    if (date === "today") tasks = tasks.filter(t => t.date === todayYmd());
    else if (date === "overdue") tasks = tasks.filter(t => !t.done && t.date < todayYmd());
    else if (date) tasks = tasks.filter(t => t.date === date);
    if (planId) {
      const goalIds = new Set(s.goals.filter(g => g.planId === planId).map(g => g.id));
      tasks = tasks.filter(t => goalIds.has(t.goalId));
    }
    if (goalId) tasks = tasks.filter(t => t.goalId === goalId);
    if (done !== undefined) tasks = tasks.filter(t => t.done === done);
    return out(flags, { count: tasks.length, tasks });
  }
  throw new Error("Use list plans/goals/tasks/year/month/week/day");
}

async function get(repo: GreatMeRepo, resource: string, flags: Flags): Promise<CliResult> {
  const s = await loadState(repo);
  const id = required(flags, "id");
  const kind = resourceKind(resource);
  if (kind === "plan") {
    const plan = s.plans.find(p => p.id === id);
    if (!plan) throw new Error(`Plan ${id} not found`);
    const goals = s.goals.filter(g => g.planId === id);
    const goalIds = new Set(goals.map(g => g.id));
    return out(flags, { plan, goals, tasks: s.tasks.filter(t => goalIds.has(t.goalId)) });
  }
  if (kind === "goal") {
    const goal = s.goals.find(g => g.id === id);
    if (!goal) throw new Error(`Goal ${id} not found`);
    return out(flags, { goal, tasks: s.tasks.filter(t => t.goalId === id) });
  }
  if (kind === "task") {
    const task = s.tasks.find(t => t.id === id);
    if (!task) throw new Error(`Task ${id} not found`);
    return out(flags, { task });
  }
  throw new Error("Use get plan/goal/task --id <id>");
}

async function create(repo: GreatMeRepo, resource: string, flags: Flags): Promise<CliResult> {
  const s = await loadState(repo);
  const kind = resourceKind(resource);
  if (kind === "plan") {
    const plan: Plan = { id: uid("plan"), title: required(flags, "title"), detail: str(flags, "detail") ?? "", start: str(flags, "start") ?? todayYmd(), end: str(flags, "end") ?? "", scopes: parseScopes(str(flags, "scopes")), status: "active", source: "user", createdAt: Date.now() };
    await saveState(repo, s, { plans: [...s.plans, plan] });
    return out(flags, { ok: true, plan });
  }
  if (kind === "goal") {
    const planId = required(flags, "plan-id");
    if (!s.plans.some(p => p.id === planId)) throw new Error(`Plan ${planId} not found`);
    const parentId = str(flags, "parent-id");
    if (parentId && !s.goals.some(g => g.id === parentId)) throw new Error(`Parent goal ${parentId} not found`);
    const scope = scopeFromResource(resource, flags);
    if (!scope) throw new Error("Missing --scope, or use create year/month/week");
    const goal: Goal = { id: uid("g"), planId, parentId, scope, title: required(flags, "title"), detail: str(flags, "detail") ?? "", phase: "execute", due: required(flags, "due"), progress: 0, createdAt: Date.now(), source: "user" };
    await saveState(repo, s, { goals: [...s.goals, goal] });
    return out(flags, { ok: true, goal });
  }
  if (kind === "task") {
    const goalId = str(flags, "goal-id") ?? "";
    if (goalId && !s.goals.some(g => g.id === goalId)) throw new Error(`Goal ${goalId} not found`);
    const task: Task = { id: uid("t"), goalId, title: required(flags, "title"), date: str(flags, "date") ?? todayYmd(), done: false, badge: str(flags, "badge") ?? "", note: str(flags, "note") ?? "", source: "user" };
    await saveState(repo, s, { tasks: [...s.tasks, task] });
    return out(flags, { ok: true, task });
  }
  throw new Error("Use create plan/year/month/week/day");
}

async function update(repo: GreatMeRepo, resource: string, flags: Flags): Promise<CliResult> {
  const s = await loadState(repo);
  const id = required(flags, "id");
  const kind = resourceKind(resource);
  if (kind === "plan") {
    const idx = s.plans.findIndex(p => p.id === id);
    if (idx < 0) throw new Error(`Plan ${id} not found`);
    const patch: Partial<Plan> = {};
    for (const key of ["title", "detail", "start", "end", "status"] as const) if (str(flags, key) !== undefined) (patch as Record<string, unknown>)[key] = str(flags, key);
    const updated = { ...s.plans[idx], ...patch };
    const plans = [...s.plans]; plans[idx] = updated;
    await saveState(repo, s, { plans });
    return out(flags, { ok: true, plan: updated });
  }
  if (kind === "goal") {
    const idx = s.goals.findIndex(g => g.id === id);
    if (idx < 0) throw new Error(`Goal ${id} not found`);
    const parentId = str(flags, "parent-id");
    if (parentId && !s.goals.some(g => g.id === parentId)) throw new Error(`Parent goal ${parentId} not found`);
    const patch: Partial<Goal> = {};
    for (const key of ["title", "detail", "due", "phase"] as const) if (str(flags, key) !== undefined) (patch as Record<string, unknown>)[key] = str(flags, key);
    if (parentId !== undefined) patch.parentId = parentId;
    if (str(flags, "progress") !== undefined) patch.progress = Number(str(flags, "progress"));
    const updated = { ...s.goals[idx], ...patch };
    const goals = [...s.goals]; goals[idx] = updated;
    await saveState(repo, s, { goals });
    return out(flags, { ok: true, goal: updated });
  }
  if (kind === "task") {
    const idx = s.tasks.findIndex(t => t.id === id);
    if (idx < 0) throw new Error(`Task ${id} not found`);
    const goalId = str(flags, "goal-id");
    if (goalId && !s.goals.some(g => g.id === goalId)) throw new Error(`Goal ${goalId} not found`);
    const patch: Partial<Task> = {};
    for (const key of ["title", "date", "badge", "note"] as const) if (str(flags, key) !== undefined) (patch as Record<string, unknown>)[key] = str(flags, key);
    if (goalId !== undefined) patch.goalId = goalId;
    if (bool(flags, "done") !== undefined) patch.done = bool(flags, "done")!;
    const updated = { ...s.tasks[idx], ...patch };
    const tasks = [...s.tasks]; tasks[idx] = updated;
    await saveState(repo, s, { tasks });
    return out(flags, { ok: true, task: updated });
  }
  throw new Error("Use update plan/goal/day");
}

async function del(repo: GreatMeRepo, resource: string, flags: Flags): Promise<CliResult> {
  assertYes(flags, "delete");
  const s = await loadState(repo);
  const id = required(flags, "id");
  const kind = resourceKind(resource);
  if (kind === "plan") {
    if (!s.plans.some(p => p.id === id)) throw new Error(`Plan ${id} not found`);
    const goalIds = new Set(s.goals.filter(g => g.planId === id).map(g => g.id));
    const plans = s.plans.filter(p => p.id !== id);
    const goals = s.goals.filter(g => g.planId !== id);
    const tasks = s.tasks.filter(t => !goalIds.has(t.goalId));
    await saveState(repo, s, { plans, goals, tasks });
    return out(flags, { ok: true, removedGoals: goalIds.size, removedTasks: s.tasks.length - tasks.length });
  }
  if (kind === "goal") {
    const toDelete = new Set<string>([id]);
    if (!s.goals.some(g => g.id === id)) throw new Error(`Goal ${id} not found`);
    let frontier = [id];
    while (frontier.length) {
      const next: string[] = [];
      for (const pid of frontier) for (const g of s.goals) if (g.parentId === pid && !toDelete.has(g.id)) { toDelete.add(g.id); next.push(g.id); }
      frontier = next;
    }
    const goals = s.goals.filter(g => !toDelete.has(g.id));
    const tasks = s.tasks.filter(t => !toDelete.has(t.goalId));
    await saveState(repo, s, { goals, tasks });
    return out(flags, { ok: true, removedGoals: toDelete.size, removedTasks: s.tasks.length - tasks.length });
  }
  if (kind === "task") {
    if (!s.tasks.some(t => t.id === id)) throw new Error(`Task ${id} not found`);
    await saveState(repo, s, { tasks: s.tasks.filter(t => t.id !== id) });
    return out(flags, { ok: true });
  }
  throw new Error("Use delete plan/goal/day");
}

async function clear(repo: GreatMeRepo, resource: string, flags: Flags): Promise<CliResult> {
  if (resource !== "all") throw new Error("Use clear all --yes to remove all plans/goals/tasks");
  assertYes(flags, "clear all");
  const s = await loadState(repo);
  const backup = { plans: s.plans, goals: s.goals, tasks: s.tasks, version: s.version };
  await saveState(repo, s, { plans: [], goals: [], tasks: [] });
  return out(flags, { ok: true, removedPlans: s.plans.length, removedGoals: s.goals.length, removedTasks: s.tasks.length, backup });
}

export async function runPlanCli(repo: GreatMeRepo, args: string[]): Promise<CliResult> {
  try {
    const { command, resource, flags } = parseArgs(args);
    if (command === "list") return await list(repo, resource, flags);
    if (command === "get") return await get(repo, resource, flags);
    if (command === "create") return await create(repo, resource, flags);
    if (command === "update") return await update(repo, resource, flags);
    if (command === "delete") return await del(repo, resource, flags);
    if (command === "clear") return await clear(repo, resource, flags);
    return { exitCode: 0, stdout: helpText(), stderr: "" };
  } catch (err) {
    return { exitCode: 1, stdout: "", stderr: `${err instanceof Error ? err.message : String(err)}\n` };
  }
}

export function helpText(): string {
  return `Rich plan CLI\n\nCommands:\n  list plans|goals|tasks|year|month|week|day [--json]\n  get plan|goal|day --id <id> [--json]\n  create plan --title <title> [--start YYYY-MM-DD] [--end YYYY-MM-DD]\n  create year|month|week --plan-id <id> --title <title> --due YYYY-MM-DD\n  create day --title <title> [--goal-id <id>] [--date YYYY-MM-DD]\n  update plan|goal|day --id <id> [fields...]\n  delete plan|goal|day --id <id> --yes\n  clear all --yes [--json]\n`;
}

export async function openGreatMeRepoFromEnv(root = join(process.cwd(), "data")): Promise<{ repo: GreatMeRepo; close: () => Promise<void> }> {
  const storage = process.env.KE_STORAGE ?? "sqlite";
  if (storage === "json") return { repo: new JsonGreatMeRepo(root), close: async () => {} };
  if (storage === "postgres") {
    const connectionString = process.env.DATABASE_URL ?? process.env.KE_DATABASE_URL;
    if (!connectionString) throw new Error("KE_STORAGE=postgres requires DATABASE_URL or KE_DATABASE_URL");
    const pg = openPostgresPool(connectionString);
    await pg.ready;
    return { repo: new PostgresGreatMeRepo(pg), close: async () => { await pg.pool.end(); } };
  }
  const db = openDb(process.env.KE_SQLITE_PATH ?? join(root, "ke.db"));
  return { repo: new SqliteGreatMeRepo(db), close: async () => { db.close(); } };
}
