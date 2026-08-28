import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ProjectAutomationRepo } from "../modules/project-automation/contracts.js";
import type { ProjectManagementRepo } from "../repos/ProjectManagementRepo.js";
import { ProjectAutomationService } from "../modules/project-automation/application/automationService.js";
import { createDictionaryAutomationStepExecutor } from "../modules/project-automation/application/dictionaryStepExecutor.js";

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

/** Registers CRUD tools for the records displayed in 数据自动化. */
export function registerProjectAutomationTools(server: McpServer, repo: ProjectAutomationRepo, projectRepo: ProjectManagementRepo): void {
  const services = new Map<string, ProjectAutomationService>();
  const serviceFor = (projectId: string) => {
    let service = services.get(projectId);
    if (!service) {
      service = new ProjectAutomationService(repo, createDictionaryAutomationStepExecutor(projectId, projectRepo));
      services.set(projectId, service);
    }
    return service;
  };
  server.tool("project_automation_list_plans", "List all automation plans for a project.", {
    project_id: z.string().min(1),
  }, async ({ project_id }) => jsonResult(await repo.listPlans(project_id)));

  server.tool("project_automation_get_plan", "Get one automation plan, including its ordered groups and table items.", {
    project_id: z.string().min(1), plan_id: z.string().min(1),
  }, async ({ project_id, plan_id }) => {
    const plan = await repo.getPlan(project_id, plan_id);
    return plan ? jsonResult(plan) : errorResult(`Automation plan ${plan_id} not found`);
  });

  server.tool("project_automation_create_plan", "Create an automation plan record.", {
    project_id: z.string().min(1), name: z.string().min(1).max(240),
    description: z.string().max(8_000).nullable().optional(), sort_order: z.number().int().optional(),
  }, async ({ project_id, name, description, sort_order }) => jsonResult({ ok: true, plan: await repo.createPlan(project_id, { name, description, sortOrder: sort_order }) }));

  server.tool("project_automation_update_plan", "Patch an automation plan's name, description, or order.", {
    project_id: z.string().min(1), plan_id: z.string().min(1), name: z.string().min(1).max(240).optional(),
    description: z.string().max(8_000).nullable().optional(), sort_order: z.number().int().optional(),
  }, async ({ project_id, plan_id, name, description, sort_order }) => {
    const plan = await repo.updatePlan(project_id, plan_id, { name, description, sortOrder: sort_order });
    return plan ? jsonResult({ ok: true, plan }) : errorResult(`Automation plan ${plan_id} not found`);
  });

  server.tool("project_automation_delete_plan", "Delete an automation plan and its contained records. Call only after the user explicitly asks to delete it.", {
    project_id: z.string().min(1), plan_id: z.string().min(1),
  }, async ({ project_id, plan_id }) => {
    const ok = await repo.deletePlan(project_id, plan_id);
    return ok ? jsonResult({ ok: true, plan_id }) : errorResult(`Automation plan ${plan_id} not found`);
  });

  server.tool("project_automation_create_group", "Create an ordered execution group in an automation plan.", {
    project_id: z.string().min(1), plan_id: z.string().min(1), name: z.string().min(1).max(240), sort_order: z.number().int().optional(),
  }, async ({ project_id, plan_id, name, sort_order }) => jsonResult({ ok: true, group: await repo.createGroup(project_id, plan_id, { name, sortOrder: sort_order }) }));

  server.tool("project_automation_update_group", "Patch an automation execution group's name or order.", {
    project_id: z.string().min(1), group_id: z.string().min(1), name: z.string().min(1).max(240).optional(), sort_order: z.number().int().optional(),
  }, async ({ project_id, group_id, name, sort_order }) => {
    const group = await repo.updateGroup(project_id, group_id, { name, sortOrder: sort_order });
    return group ? jsonResult({ ok: true, group }) : errorResult(`Automation group ${group_id} not found`);
  });

  server.tool("project_automation_delete_group", "Delete an automation execution group. Call only after the user explicitly asks to delete it.", {
    project_id: z.string().min(1), group_id: z.string().min(1),
  }, async ({ project_id, group_id }) => {
    const ok = await repo.deleteGroup(project_id, group_id);
    return ok ? jsonResult({ ok: true, group_id }) : errorResult(`Automation group ${group_id} not found`);
  });

  server.tool("project_automation_reorder_groups", "Set the complete order of groups in one automation plan.", {
    project_id: z.string().min(1), plan_id: z.string().min(1), group_ids: z.array(z.string().min(1)).min(1),
  }, async ({ project_id, plan_id, group_ids }) => {
    await repo.reorderGroups(project_id, plan_id, group_ids);
    return jsonResult({ ok: true, plan_id, count: group_ids.length });
  });

  server.tool("project_automation_add_item", "Add a data-dictionary table item to an automation execution group.", {
    project_id: z.string().min(1), plan_id: z.string().min(1), group_id: z.string().min(1), table_id: z.string().min(1), sort_order: z.number().int().optional(),
  }, async ({ project_id, plan_id, group_id, table_id, sort_order }) => jsonResult({ ok: true, item: await repo.addItem(project_id, plan_id, group_id, { tableId: table_id, sortOrder: sort_order }) }));

  server.tool("project_automation_remove_item", "Remove a table item from an automation group. Call only after the user explicitly asks to remove it.", {
    project_id: z.string().min(1), item_id: z.string().min(1),
  }, async ({ project_id, item_id }) => {
    const ok = await repo.removeItem(project_id, item_id);
    return ok ? jsonResult({ ok: true, item_id }) : errorResult(`Automation item ${item_id} not found`);
  });

  server.tool("project_automation_reorder_items", "Set the complete order of table items in one automation group.", {
    project_id: z.string().min(1), group_id: z.string().min(1), item_ids: z.array(z.string().min(1)).min(1),
  }, async ({ project_id, group_id, item_ids }) => {
    await repo.reorderItems(project_id, group_id, item_ids);
    return jsonResult({ ok: true, group_id, count: item_ids.length });
  });

  server.tool("project_automation_list_runs", "List automation-run records for one plan.", {
    project_id: z.string().min(1), plan_id: z.string().min(1), limit: z.number().int().min(1).max(100).optional(),
  }, async ({ project_id, plan_id, limit }) => jsonResult(await repo.listRuns(project_id, plan_id, limit)));

  server.tool("project_automation_get_run", "Get one automation-run record and its item-level execution state.", {
    project_id: z.string().min(1), run_id: z.string().min(1),
  }, async ({ project_id, run_id }) => {
    const run = await repo.getRun(project_id, run_id);
    return run ? jsonResult(run) : errorResult(`Automation run ${run_id} not found`);
  });

  server.tool("project_automation_start_run", "Create and start an automation-run record for a plan. Poll project_automation_get_run for progress; this returns immediately.", {
    project_id: z.string().min(1), plan_id: z.string().min(1), runtime_params: z.record(z.string(), z.unknown()).optional(),
  }, async ({ project_id, plan_id, runtime_params }) => {
    try {
      const service = serviceFor(project_id);
      const run = await service.start(project_id, plan_id, runtime_params);
      void service.execute(run.id, project_id).catch(() => undefined);
      return jsonResult({ ok: true, run });
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error));
    }
  });

  server.tool("project_automation_resume_run", "Resume a paused automation-run record. Poll project_automation_get_run for progress; this returns immediately.", {
    project_id: z.string().min(1), run_id: z.string().min(1), runtime_params: z.record(z.string(), z.unknown()).optional(),
  }, async ({ project_id, run_id, runtime_params }) => {
    const run = await repo.getRun(project_id, run_id);
    if (!run) return errorResult(`Automation run ${run_id} not found`);
    if (run.status !== "paused") return errorResult("Only paused automation runs can be resumed");
    void serviceFor(project_id).resume(project_id, run.id, runtime_params).catch(() => undefined);
    return jsonResult({ ok: true, run: { ...run, runtimeParams: { ...run.runtimeParams, ...runtime_params }, status: "running" } });
  });
}
