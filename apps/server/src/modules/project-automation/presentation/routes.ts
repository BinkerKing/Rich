import { Hono } from "hono";
import type { ProjectManagementRepo } from "../../../repos/ProjectManagementRepo.js";
import { inspectAutomationPlan, ProjectAutomationService, type AutomationPlanItemInspector } from "../application/automationService.js";
import { createDictionaryAutomationPlanInspector, createDictionaryAutomationStepExecutor } from "../application/dictionaryStepExecutor.js";
import type { AutomationStepExecutor } from "../application/runner.js";
import type { ProjectAutomationRepo } from "../contracts.js";

interface ProjectAutomationRouteOptions {
  stepExecutorFactory?: (projectId: string, projectRepo: ProjectManagementRepo) => AutomationStepExecutor;
  planInspectorFactory?: (projectId: string, projectRepo: ProjectManagementRepo) => AutomationPlanItemInspector;
}

export function projectAutomationRoutes(
  projectRepo: ProjectManagementRepo,
  automationRepo: ProjectAutomationRepo,
  options: ProjectAutomationRouteOptions = {},
): Hono {
  const routes = new Hono();
  const services = new Map<string, ProjectAutomationService>();
  const serviceFor = (projectId: string) => {
    let service = services.get(projectId);
    if (!service) {
      const executor = options.stepExecutorFactory?.(projectId, projectRepo)
        ?? createDictionaryAutomationStepExecutor(projectId, projectRepo);
      service = new ProjectAutomationService(automationRepo, executor);
      services.set(projectId, service);
    }
    return service;
  };

  routes.use("/:projectId/automation/*", async (context, next) => {
    context.header("cache-control", "no-store");
    await next();
  });

  routes.get("/:projectId/automation/plans", async context => {
    return context.json(await automationRepo.listPlans(context.req.param("projectId")));
  });

  routes.post("/:projectId/automation/plans", async context => {
    const body = await jsonBody(context);
    const name = stringValue(body.name);
    if (!name) return context.json({ error: "方案名称不能为空" }, 400);
    const plan = await automationRepo.createPlan(context.req.param("projectId"), {
      name,
      description: nullableString(body.description),
      sortOrder: numberValue(body.sortOrder),
    });
    return context.json(plan, 201);
  });

  routes.get("/:projectId/automation/plans/:planId", async context => {
    const plan = await automationRepo.getPlan(context.req.param("projectId"), context.req.param("planId"));
    return plan ? context.json(plan) : context.json({ error: "自动化方案不存在" }, 404);
  });

  routes.post("/:projectId/automation/plans/:planId/check", async context => {
    const projectId = context.req.param("projectId");
    const plan = await automationRepo.getPlan(projectId, context.req.param("planId"));
    if (!plan) return context.json({ error: "自动化方案不存在" }, 404);
    try {
      const inspector = options.planInspectorFactory?.(projectId, projectRepo)
        ?? createDictionaryAutomationPlanInspector(projectId, projectRepo);
      return context.json(await inspectAutomationPlan(plan, inspector));
    } catch (errorValue) {
      return badRequest(context, errorValue);
    }
  });

  routes.patch("/:projectId/automation/plans/:planId", async context => {
    const body = await jsonBody(context);
    const plan = await automationRepo.updatePlan(context.req.param("projectId"), context.req.param("planId"), {
      ...(body.name !== undefined ? { name: stringValue(body.name) } : {}),
      ...(body.description !== undefined ? { description: nullableString(body.description) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: numberValue(body.sortOrder) } : {}),
    });
    return plan ? context.json(plan) : context.json({ error: "自动化方案不存在" }, 404);
  });

  routes.delete("/:projectId/automation/plans/:planId", async context => {
    const removed = await automationRepo.deletePlan(context.req.param("projectId"), context.req.param("planId"));
    return removed ? context.body(null, 204) : context.json({ error: "自动化方案不存在" }, 404);
  });

  routes.post("/:projectId/automation/plans/:planId/groups", async context => {
    const body = await jsonBody(context);
    const name = stringValue(body.name);
    if (!name) return context.json({ error: "分组名称不能为空" }, 400);
    try {
      const group = await automationRepo.createGroup(context.req.param("projectId"), context.req.param("planId"), { name, sortOrder: numberValue(body.sortOrder) });
      return context.json(group, 201);
    } catch (errorValue) {
      return badRequest(context, errorValue);
    }
  });

  routes.patch("/:projectId/automation/groups/:groupId", async context => {
    const body = await jsonBody(context);
    const group = await automationRepo.updateGroup(context.req.param("projectId"), context.req.param("groupId"), {
      ...(body.name !== undefined ? { name: stringValue(body.name) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: numberValue(body.sortOrder) } : {}),
    });
    return group ? context.json(group) : context.json({ error: "执行分组不存在" }, 404);
  });

  routes.delete("/:projectId/automation/groups/:groupId", async context => {
    const removed = await automationRepo.deleteGroup(context.req.param("projectId"), context.req.param("groupId"));
    return removed ? context.body(null, 204) : context.json({ error: "执行分组不存在" }, 404);
  });

  routes.post("/:projectId/automation/plans/:planId/groups/reorder", async context => {
    const body = await jsonBody(context);
    await automationRepo.reorderGroups(context.req.param("projectId"), context.req.param("planId"), stringArray(body.groupIds));
    return context.json({ ok: true });
  });

  routes.post("/:projectId/automation/plans/:planId/groups/:groupId/items", async context => {
    const body = await jsonBody(context);
    const tableId = stringValue(body.tableId);
    if (!tableId) return context.json({ error: "请选择数据字典表" }, 400);
    try {
      const item = await automationRepo.addItem(context.req.param("projectId"), context.req.param("planId"), context.req.param("groupId"), { tableId, sortOrder: numberValue(body.sortOrder) });
      return context.json(item, 201);
    } catch (errorValue) {
      return badRequest(context, errorValue);
    }
  });

  routes.delete("/:projectId/automation/items/:itemId", async context => {
    const removed = await automationRepo.removeItem(context.req.param("projectId"), context.req.param("itemId"));
    return removed ? context.body(null, 204) : context.json({ error: "自动化表项不存在" }, 404);
  });

  routes.post("/:projectId/automation/groups/:groupId/items/reorder", async context => {
    const body = await jsonBody(context);
    await automationRepo.reorderItems(context.req.param("projectId"), context.req.param("groupId"), stringArray(body.itemIds));
    return context.json({ ok: true });
  });

  routes.get("/:projectId/automation/plans/:planId/runs", async context => {
    return context.json(await automationRepo.listRuns(context.req.param("projectId"), context.req.param("planId"), numberValue(context.req.query("limit"))));
  });

  routes.post("/:projectId/automation/plans/:planId/runs", async context => {
    const projectId = context.req.param("projectId");
    try {
      const body = await jsonBody(context);
      const service = serviceFor(projectId);
      const run = await service.start(projectId, context.req.param("planId"), objectValue(body.runtimeParams));
      void service.execute(run.id, projectId).catch(() => undefined);
      return context.json(run, 202);
    } catch (errorValue) {
      return badRequest(context, errorValue);
    }
  });

  routes.get("/:projectId/automation/runs/:runId", async context => {
    const run = await serviceFor(context.req.param("projectId")).getRun(context.req.param("projectId"), context.req.param("runId"));
    return run ? context.json(run) : context.json({ error: "自动化运行记录不存在" }, 404);
  });

  routes.post("/:projectId/automation/runs/:runId/resume", async context => {
    const projectId = context.req.param("projectId");
    const body = await jsonBody(context);
    const runtimeParams = objectValue(body.runtimeParams);
    const run = await automationRepo.getRun(projectId, context.req.param("runId"));
    if (!run) return context.json({ error: "自动化运行记录不存在" }, 404);
    if (run.status !== "paused") return context.json({ error: "只有已暂停的任务可以断点续跑" }, 400);
    void serviceFor(projectId).resume(projectId, run.id, runtimeParams).catch(() => undefined);
    return context.json({ ...run, runtimeParams: { ...run.runtimeParams, ...runtimeParams }, status: "running", error: undefined }, 202);
  });

  return routes;
}

async function jsonBody(context: { req: { json(): Promise<unknown> } }): Promise<Record<string, unknown>> {
  const value = await context.req.json().catch(() => ({}));
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === "string" ? value.trim() || null : undefined;
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" && value ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function badRequest(context: { json(body: { error: string }, status: 400): Response }, errorValue: unknown): Response {
  return context.json({ error: errorValue instanceof Error ? errorValue.message : String(errorValue) }, 400);
}
