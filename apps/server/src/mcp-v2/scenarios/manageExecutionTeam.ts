import { z } from "zod";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type {
  MulticaProjectBinding,
  MulticaTeamPlan,
  MulticaTeamPlanRequest,
} from "../delegation/multica/MulticaBindingRepo.js";
import { executeIdempotently } from "../registry/idempotency.js";
import { richFailure, richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { richContextSchema } from "../resources/schemas.js";

export interface ExecutionTeamAdministrationPort {
  planTeam(request: MulticaTeamPlanRequest): Promise<MulticaTeamPlan>;
  applyPlan(planId: string): Promise<MulticaProjectBinding>;
  getPlan(planId: string): Promise<MulticaTeamPlan | null>;
  getBinding(richProjectId: string): Promise<MulticaProjectBinding | null>;
}

const capabilitySchema = z.object({
  key: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  proposedName: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(500),
  preferredAgentName: z.string().trim().min(1).max(120).optional(),
  runtimeProvider: z.string().trim().min(1).max(80).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  instructions: z.string().trim().min(1).max(5_000).optional(),
});

export function registerExecutionTeamTools(
  registry: RichToolRegistry,
  teams: ExecutionTeamAdministrationPort,
  operationRepo?: McpOperationRepo,
): void {
  registry.register({
    name: "rich_execution_team_plan",
    title: "规划项目执行团队",
    category: "plan",
    description: "分析 Rich 项目的执行需求，优先复用现有成员，并提出需要创建或调整的项目执行团队计划；不会创建外部资源。",
    inputSchema: z.object({
      projectId: z.string().trim().min(1),
      projectName: z.string().trim().min(1).max(200),
      goal: z.string().trim().min(1).max(2_000),
      projectDescription: z.string().trim().min(1).max(5_000).optional(),
      workingDirectory: z.string().trim().min(1).max(2_000).optional(),
      requiredCapabilities: z.array(capabilitySchema).min(1).max(20),
      context: richContextSchema,
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{
      description: "为 Rich 项目规划可复用的开发执行团队",
      input: {
        projectId: "rich", projectName: "Rich", goal: "实现任务委派能力", workingDirectory: "/workspace/Rich",
        requiredCapabilities: [{ key: "development", description: "TypeScript 开发和验证", proposedName: "Rich 开发", role: "负责实现与测试", preferredAgentName: "Rich 开发", runtimeProvider: "codex" }],
        context: { requestId: "team-plan-1" },
      },
    }],
    verification: "Persists the proposed plan and returns its stable plan ID; no external resource is created.",
    handler: async input => {
      if (!operationRepo) return dependencyFailure("rich_execution_team_plan");
      return executeIdempotently(operationRepo, {
        toolName: "rich_execution_team_plan", requestId: input.context?.requestId ?? "", input,
      }, async () => {
        const plan = await teams.planTeam({
          richProjectId: input.projectId,
          richProjectName: input.projectName,
          goal: input.goal,
          projectDescription: input.projectDescription,
          workingDirectory: input.workingDirectory,
          capabilities: input.requiredCapabilities,
        });
        return richSuccess("rich_execution_team_plan", { plan }, {
          refs: [{ type: "execution_team_plan", id: plan.id, label: `${input.projectName} 执行团队计划` }],
          changes: [{ operation: "create", resource: "execution_team_plan", id: plan.id }],
          verification: { status: "verified", details: "The proposed team plan was persisted; no external resource was created." },
        });
      });
    },
  });

  registry.register({
    name: "rich_execution_team_apply",
    title: "应用已确认的执行团队计划",
    category: "manage",
    description: "在用户确认后应用已持久化的执行团队计划，复用或创建项目、成员和小队，并保存稳定映射。",
    inputSchema: z.object({
      planId: z.string().trim().min(1),
      confirmed: z.literal(true),
      context: richContextSchema,
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [{
      description: "应用用户已经确认的团队计划",
      input: { planId: "team-plan-1", confirmed: true, context: { requestId: "team-apply-1" } },
    }],
    verification: "Reads the saved binding after apply and verifies its project and default squad IDs.",
    handler: async input => {
      if (!operationRepo) return dependencyFailure("rich_execution_team_apply");
      return executeIdempotently(operationRepo, {
        toolName: "rich_execution_team_apply", requestId: input.context?.requestId ?? "", input,
      }, async () => {
        const binding = await teams.applyPlan(input.planId);
        const saved = await teams.getBinding(binding.richProjectId);
        const verified = saved?.projectId === binding.projectId && saved.defaultSquadId === binding.defaultSquadId;
        return richSuccess("rich_execution_team_apply", { binding }, {
          refs: [
            { type: "project", id: binding.richProjectId, label: binding.richProjectName },
            { type: "execution_team", id: binding.defaultSquadId, label: binding.defaultSquadName },
          ],
          changes: [{ operation: "update", resource: "execution_team", id: binding.defaultSquadId }],
          verification: { status: verified ? "verified" : "failed", details: "The project and default team binding was read back after apply." },
        });
      });
    },
  });
}

function dependencyFailure(action: string) {
  return richFailure(action, {
    code: "DEPENDENCY_UNAVAILABLE",
    message: "Execution-team persistence is not configured.",
    retryable: true,
  });
}
