import { describe, expect, it } from "vitest";
import { ProjectAutomationService } from "../src/modules/project-automation/application/automationService.js";
import { AUTOMATION_STEPS, type AutomationStep } from "../src/modules/project-automation/application/runner.js";
import type { AutomationPlanDetail, AutomationRun } from "../src/modules/project-automation/contracts.js";

describe("project automation service", () => {
  it("creates an immutable run snapshot and executes it", async () => {
    const repo = new MemoryAutomationRepo(plan());
    const calls: string[] = [];
    const service = new ProjectAutomationService(repo, async (item, step) => {
      calls.push(`${item.tableId}:${step}`);
      return step === "extract" ? { affectedRows: 18 } : {};
    });

    const run = await service.start("project-a", "plan-a");
    await service.execute(run.id, "project-a");

    const saved = await service.getRun("project-a", run.id);
    expect(saved).toMatchObject({ status: "success", items: [{ affectedRows: 18 }] });
    expect(calls).toEqual(AUTOMATION_STEPS.map(step => `table-a:${step}`));
  });

  it("resumes the paused run instead of creating a new run", async () => {
    const repo = new MemoryAutomationRepo(plan());
    let fail = true;
    const calls: AutomationStep[] = [];
    const service = new ProjectAutomationService(repo, async (_item, step) => {
      calls.push(step);
      if (step === "sync_table" && fail) throw new Error("表结构错误");
      return {};
    });
    const run = await service.start("project-a", "plan-a");
    await service.execute(run.id, "project-a");
    expect((await service.getRun("project-a", run.id))?.status).toBe("paused");

    fail = false;
    await service.resume("project-a", run.id);

    expect((await service.getRun("project-a", run.id))?.status).toBe("success");
    expect(calls).toEqual(["validate_sql", "sync_table", "sync_table", "prepare_extraction", "extract"]);
    expect(repo.createdRunCount).toBe(1);
  });

  it("stores plan-level runtime parameters and passes them to every execution step", async () => {
    const repo = new MemoryAutomationRepo(plan());
    const received: Array<Record<string, unknown> | undefined> = [];
    const service = new ProjectAutomationService(repo, (async (_item, _step, context: { runtimeParams?: Record<string, unknown> }) => {
      received.push(context.runtimeParams);
      return {};
    }) as never);
    const start = service.start.bind(service) as unknown as (
      projectId: string,
      planId: string,
      runtimeParams: Record<string, unknown>,
    ) => Promise<AutomationRun>;

    const run = await start("project-a", "plan-a", { businessDate: "2026-08-25" });
    await service.execute(run.id, "project-a");

    expect((await service.getRun("project-a", run.id))?.runtimeParams).toEqual({ businessDate: "2026-08-25" });
    expect(received).toHaveLength(AUTOMATION_STEPS.length);
    expect(received.every(params => params?.businessDate === "2026-08-25")).toBe(true);
  });
});

class MemoryAutomationRepo {
  private runs = new Map<string, AutomationRun>();
  createdRunCount = 0;

  constructor(private readonly detail: AutomationPlanDetail) {}
  async getPlan(projectId: string, planId: string) {
    return projectId === this.detail.projectId && planId === this.detail.id ? structuredClone(this.detail) : null;
  }
  async createRun(detail: AutomationPlanDetail, runtimeParams: Record<string, unknown> = {}) {
    this.createdRunCount += 1;
    const now = new Date().toISOString();
    const run: AutomationRun = {
      id: `run-${this.createdRunCount}`,
      projectId: detail.projectId,
      planId: detail.id,
      planName: detail.name,
      status: "running",
      startedAt: now,
      updatedAt: now,
      runtimeParams,
      items: detail.groups.flatMap(group => group.items.map(item => ({
        id: `run-item-${item.id}`,
        tableId: item.tableId,
        tableName: item.tableName,
        groupId: group.id,
        groupName: group.name,
        groupOrder: group.sortOrder,
        itemOrder: item.sortOrder,
        status: "pending" as const,
        steps: AUTOMATION_STEPS.map(step => ({ step, status: "pending" as const })),
      }))),
    };
    this.runs.set(run.id, structuredClone(run));
    return run;
  }
  async saveRun(run: AutomationRun) { this.runs.set(run.id, structuredClone(run)); }
  async getRun(projectId: string, runId: string) {
    const run = this.runs.get(runId);
    return run?.projectId === projectId ? structuredClone(run) : null;
  }
}

function plan(): AutomationPlanDetail {
  return {
    id: "plan-a", projectId: "project-a", name: "每日取数", sortOrder: 0,
    createdAt: "2026-08-25T00:00:00.000Z", updatedAt: "2026-08-25T00:00:00.000Z",
    groups: [{
      id: "group-a", projectId: "project-a", planId: "plan-a", name: "贴源层", sortOrder: 1,
      createdAt: "2026-08-25T00:00:00.000Z", updatedAt: "2026-08-25T00:00:00.000Z",
      items: [{ id: "item-a", projectId: "project-a", planId: "plan-a", groupId: "group-a", tableId: "table-a", tableName: "ods_customer", sortOrder: 1 }],
    }],
  };
}
