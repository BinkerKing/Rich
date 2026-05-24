import { describe, expect, it } from "vitest";
import type { GreatMeRepo } from "../src/repos/GreatMeRepo.js";
import { runPlanCli } from "../src/cli/planCli.js";

class MemoryGreatMeRepo implements GreatMeRepo {
  constructor(private value: unknown) {}
  async get(): Promise<unknown | null> { return this.value; }
  async put(value: unknown): Promise<void> { this.value = value; }
}

const seedState = () => ({
  profile: { codename: "大斌哥" },
  plans: [
    { id: "plan-1", title: "年度主线", detail: "", start: "2026-01-01", end: "2026-12-31", scopes: ["year", "month", "week", "day"], status: "active", source: "user", createdAt: 1 },
  ],
  goals: [
    { id: "g-year", planId: "plan-1", scope: "year", title: "年目标", detail: "", phase: "execute", due: "2026-12-31", progress: 0, createdAt: 2 },
    { id: "g-week", planId: "plan-1", scope: "week", title: "周目标", detail: "", phase: "execute", due: "2026-05-31", progress: 0, createdAt: 3, parentId: "g-year" },
  ],
  tasks: [
    { id: "t-day", goalId: "g-week", title: "今天行动", done: false, date: "2026-05-25", badge: "", note: "" },
  ],
  events: [], daily: [], reviews: [], ability: {}, compounding: { score: 0, trend: [], topAssets: [], topBlockers: [] }, conversations: [],
  activeSection: "home", activeRange: "week", soundOn: true, version: 7,
});

describe("plan CLI core", () => {
  it("queries plans, year/week goals, and day tasks as JSON", async () => {
    const repo = new MemoryGreatMeRepo(seedState());

    const plans = await runPlanCli(repo, ["list", "plans", "--json"]);
    expect(plans.exitCode).toBe(0);
    expect(JSON.parse(plans.stdout).plans[0].title).toBe("年度主线");

    const years = await runPlanCli(repo, ["list", "year", "--plan-id", "plan-1", "--json"]);
    expect(JSON.parse(years.stdout).goals.map((g: { id: string }) => g.id)).toEqual(["g-year"]);

    const weeks = await runPlanCli(repo, ["list", "week", "--plan-id", "plan-1", "--json"]);
    expect(JSON.parse(weeks.stdout).goals.map((g: { id: string }) => g.id)).toEqual(["g-week"]);

    const days = await runPlanCli(repo, ["list", "day", "--date", "2026-05-25", "--json"]);
    expect(JSON.parse(days.stdout).tasks.map((t: { id: string }) => t.id)).toEqual(["t-day"]);
  });

  it("creates, updates, and deletes plans/goals/day tasks", async () => {
    const repo = new MemoryGreatMeRepo({ ...seedState(), plans: [], goals: [], tasks: [], version: 0 });

    const createdPlan = await runPlanCli(repo, ["create", "plan", "--title", "减重计划", "--start", "2026-05-01", "--end", "2026-08-01", "--json"]);
    const planId = JSON.parse(createdPlan.stdout).plan.id;
    expect(planId).toMatch(/^plan-/);

    const createdGoal = await runPlanCli(repo, ["create", "month", "--plan-id", planId, "--title", "五月目标", "--due", "2026-05-31", "--json"]);
    const goalId = JSON.parse(createdGoal.stdout).goal.id;
    expect(JSON.parse(createdGoal.stdout).goal.scope).toBe("month");

    const createdTask = await runPlanCli(repo, ["create", "day", "--goal-id", goalId, "--title", "跑步", "--date", "2026-05-25", "--json"]);
    const taskId = JSON.parse(createdTask.stdout).task.id;

    const updatedTask = await runPlanCli(repo, ["update", "day", "--id", taskId, "--done", "true", "--json"]);
    expect(JSON.parse(updatedTask.stdout).task.done).toBe(true);

    const deletedPlan = await runPlanCli(repo, ["delete", "plan", "--id", planId, "--yes", "--json"]);
    expect(JSON.parse(deletedPlan.stdout)).toMatchObject({ ok: true, removedGoals: 1, removedTasks: 1 });

    const after = JSON.parse((await runPlanCli(repo, ["list", "plans", "--status", "all", "--json"])).stdout);
    expect(after.count).toBe(0);
  });

  it("can clear all plan-management data with a backup payload", async () => {
    const repo = new MemoryGreatMeRepo(seedState());
    const result = await runPlanCli(repo, ["clear", "all", "--yes", "--json"]);
    const body = JSON.parse(result.stdout);
    expect(body).toMatchObject({ ok: true, removedPlans: 1, removedGoals: 2, removedTasks: 1 });
    expect(body.backup.plans).toHaveLength(1);

    const after = JSON.parse((await runPlanCli(repo, ["list", "plans", "--status", "all", "--json"])).stdout);
    expect(after.count).toBe(0);
  });
});
