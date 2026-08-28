import { z } from "zod";
import type { ProjectAutomationRepo } from "../../modules/project-automation/contracts.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

export function registerAutomationTools(registry: RichToolRegistry, automation: ProjectAutomationRepo, operationRepo?: McpOperationRepo): void {
  registry.register({
    name: "rich_automation_manage",
    title: "Manage project automation",
    description: "List, get, create, update, or delete project automation plans. Execution is handled by a separate scenario/task flow.",
    category: "manage",
    inputSchema: z.object({
      action: z.enum(["list_plans", "get_plan", "create_plan", "update_plan", "delete_plan"]),
      projectId: z.string().min(1),
      id: z.string().min(1).optional(),
      input: z.object({
        name: z.string().min(1).max(280).optional(),
        description: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
      }).optional(),
      context: richContextSchema,
      options: richOptionsSchema,
    }).superRefine((input, issues) => {
      if (["get_plan", "update_plan", "delete_plan"].includes(input.action) && !input.id) issues.addIssue({ code: "custom", path: ["id"], message: "id is required." });
      if ((input.action === "create_plan" || input.action === "update_plan") && !input.input) issues.addIssue({ code: "custom", path: ["input"], message: "input is required." });
      if (input.action === "create_plan" && !input.input?.name) issues.addIssue({ code: "custom", path: ["input", "name"], message: "name is required." });
    }),
    annotations: { readOnly: false, destructive: true, idempotent: true },
    examples: [
      { description: "List project automation plans.", input: { action: "list_plans", projectId: "project-rich" } },
      { description: "Create an automation plan.", input: { action: "create_plan", projectId: "project-rich", input: { name: "每日同步" }, context: { requestId: "create-automation-1" } } },
    ],
    verification: "Plan writes are verified through getPlan or listPlans.",
    handler: async ({ action, projectId, id, input, context, options }) => {
      if (action === "list_plans") {
        const plans = await automation.listPlans(projectId);
        return richSuccess("rich_automation_manage", { plans }, { refs: plans.map(plan => ({ type: "automationPlan", id: plan.id, label: plan.name })) });
      }
      if (action === "get_plan") {
        const plan = await automation.getPlan(projectId, id!);
        if (!plan) throw new RichMcpError("NOT_FOUND", `Automation plan ${id} was not found.`);
        return richSuccess("rich_automation_manage", { plan }, { refs: [{ type: "automationPlan", id: plan.id, label: plan.name }] });
      }
      return executeSafeWrite({
        toolName: "rich_automation_manage",
        operationRepo,
        context,
        options,
        destructive: action === "delete_plan",
        inputForHash: { action, projectId, id, input },
        changes: [{ operation: action.replace("_plan", ""), resource: "automationPlan", ...(id ? { id } : {}) }],
        execute: async () => {
          if (action === "create_plan") return { plan: await automation.createPlan(projectId, { name: input!.name!, description: input!.description, sortOrder: input!.sortOrder }) };
          if (action === "update_plan") {
            const plan = await automation.updatePlan(projectId, id!, input!);
            if (!plan) throw new RichMcpError("NOT_FOUND", `Automation plan ${id} was not found.`);
            return { plan };
          }
          const deleted = await automation.deletePlan(projectId, id!);
          if (!deleted) throw new RichMcpError("NOT_FOUND", `Automation plan ${id} was not found.`);
          return { deleted, id: id! };
        },
        verify: async result => {
          const targetId = "plan" in result && result.plan ? result.plan.id : result.id;
          const found = await automation.getPlan(projectId, targetId);
          const verified = action === "delete_plan" ? !found : Boolean(found);
          return { status: verified ? "verified" : "failed", details: "Automation plan was checked after write." };
        },
        refs: result => "plan" in result && result.plan ? [{ type: "automationPlan", id: result.plan.id, label: result.plan.name }] : [],
      });
    },
  });
}
