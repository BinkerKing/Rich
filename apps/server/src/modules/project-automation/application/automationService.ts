import { runAutomationItems, type AutomationStepExecutor } from "./runner.js";
import type {
  AutomationItem,
  AutomationPlanDetail,
  AutomationPlanInspection,
  AutomationRun,
  ProjectAutomationRepo,
} from "../contracts.js";

type AutomationRunRepository = Pick<ProjectAutomationRepo, "getPlan" | "createRun" | "saveRun" | "getRun">;

export class ProjectAutomationService {
  private readonly activeRuns = new Set<string>();

  constructor(
    private readonly repo: AutomationRunRepository,
    private readonly executeStep: AutomationStepExecutor,
  ) {}

  async start(projectId: string, planId: string, runtimeParams?: Record<string, unknown>): Promise<AutomationRun> {
    const plan = await this.repo.getPlan(projectId, planId);
    if (!plan) throw new Error("自动化方案不存在");
    ensureRunnablePlan(plan);
    return this.repo.createRun(plan, runtimeParams);
  }

  async execute(runId: string, projectId: string): Promise<AutomationRun> {
    if (this.activeRuns.has(runId)) throw new Error("该自动化任务正在运行");
    const run = await this.repo.getRun(projectId, runId);
    if (!run) throw new Error("自动化运行记录不存在");
    if (run.status === "success") return run;

    this.activeRuns.add(runId);
    try {
      run.status = "running";
      run.error = undefined;
      run.finishedAt = undefined;
      await this.repo.saveRun(run);
      const result = await runAutomationItems(run.items, this.executeStep, async items => {
        run.items = items;
        await this.repo.saveRun(run);
      }, { runtimeParams: run.runtimeParams });
      run.items = result.items;
      run.status = result.status;
      run.error = result.error;
      run.finishedAt = result.status === "success" ? new Date().toISOString() : undefined;
      await this.repo.saveRun(run);
      return run;
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  async resume(projectId: string, runId: string, runtimeParams?: Record<string, unknown>): Promise<AutomationRun> {
    const run = await this.repo.getRun(projectId, runId);
    if (!run) throw new Error("自动化运行记录不存在");
    if (run.status !== "paused") throw new Error("只有已暂停的任务可以断点续跑");
    if (runtimeParams) {
      run.runtimeParams = { ...run.runtimeParams, ...runtimeParams };
      await this.repo.saveRun(run);
    }
    return this.execute(runId, projectId);
  }

  async getRun(projectId: string, runId: string): Promise<AutomationRun | null> {
    return this.repo.getRun(projectId, runId);
  }
}

export interface AutomationItemInspectionResult {
  ready: boolean;
  runtimeParamNames?: string[];
  runtimeParamTypes?: Record<string, string>;
  message?: string;
  error?: string;
}

export type AutomationPlanItemInspector = (item: AutomationItem) => Promise<AutomationItemInspectionResult>;

export async function inspectAutomationPlan(
  plan: AutomationPlanDetail,
  inspectItem: AutomationPlanItemInspector,
): Promise<AutomationPlanInspection> {
  ensureRunnablePlan(plan);
  const parameterMap = new Map<string, AutomationPlanInspection["parameters"][number]>();
  const items = [] as AutomationPlanInspection["items"];
  const orderedGroups = [...plan.groups].sort((left, right) => left.sortOrder - right.sortOrder);

  for (const group of orderedGroups) {
    const orderedItems = [...group.items].sort((left, right) => left.sortOrder - right.sortOrder);
    for (const item of orderedItems) {
      try {
        const result = await inspectItem(item);
        const parameterNames = result.runtimeParamNames ?? [];
        for (const name of parameterNames) {
          const key = name.trim().toLocaleLowerCase();
          const type = parameterType(result.runtimeParamTypes, name);
          const parameter = parameterMap.get(key) ?? { name, types: [], tableIds: [] };
          if (type && !parameter.types.includes(type)) parameter.types.push(type);
          if (!parameter.tableIds.includes(item.tableId)) parameter.tableIds.push(item.tableId);
          parameterMap.set(key, parameter);
        }
        items.push({
          tableId: item.tableId,
          tableName: item.tableName,
          groupId: group.id,
          groupName: group.name,
          ready: result.ready,
          parameterNames,
          message: result.message,
          error: result.error,
        });
      } catch (errorValue) {
        items.push({
          tableId: item.tableId,
          tableName: item.tableName,
          groupId: group.id,
          groupName: group.name,
          ready: false,
          parameterNames: [],
          error: errorValue instanceof Error ? errorValue.message : String(errorValue),
        });
      }
    }
  }

  return {
    planId: plan.id,
    ready: items.every(item => item.ready),
    checkedAt: new Date().toISOString(),
    parameters: [...parameterMap.values()],
    items,
  };
}

function parameterType(types: Record<string, string> | undefined, name: string): string | undefined {
  const key = name.trim().toLocaleLowerCase();
  return Object.entries(types ?? {}).find(([candidate]) => candidate.trim().toLocaleLowerCase() === key)?.[1];
}

function ensureRunnablePlan(plan: AutomationPlanDetail): void {
  if (plan.groups.length === 0) throw new Error("请先创建执行分组");
  if (!plan.groups.some(group => group.items.length > 0)) throw new Error("请先向执行分组添加数据表");
}
