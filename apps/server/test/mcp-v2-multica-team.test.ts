import { describe, expect, it } from "vitest";
import type { MulticaProjectBinding, MulticaTeamPlan, MulticaTeamPlanRequest } from "../src/mcp-v2/delegation/multica/MulticaBindingRepo.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import { registerExecutionTeamTools, type ExecutionTeamAdministrationPort } from "../src/mcp-v2/scenarios/manageExecutionTeam.js";
import type { McpOperationClaim, McpOperationRecord, McpOperationRepo } from "../src/repos/McpOperationRepo.js";

class MemoryOperationRepo implements McpOperationRepo {
  records = new Map<string, McpOperationRecord>();
  claim(toolName: string, requestId: string, inputHash: string): McpOperationClaim {
    const key = `${toolName}:${requestId}`;
    const record = this.records.get(key);
    if (record) return { claimed: false, record };
    this.records.set(key, { toolName, requestId, inputHash, status: "pending", createdAt: new Date().toISOString() });
    return { claimed: true };
  }
  complete(toolName: string, requestId: string, inputHash: string, response: Parameters<McpOperationRepo["complete"]>[3]) {
    this.records.set(`${toolName}:${requestId}`, { toolName, requestId, inputHash, status: "completed", response, createdAt: new Date().toISOString() });
  }
  abandon(toolName: string, requestId: string) { this.records.delete(`${toolName}:${requestId}`); }
}

class FakeTeams implements ExecutionTeamAdministrationPort {
  plans = new Map<string, MulticaTeamPlan>();
  binding: MulticaProjectBinding | null = null;
  planCalls = 0;
  applyCalls = 0;
  async planTeam(request: MulticaTeamPlanRequest): Promise<MulticaTeamPlan> {
    this.planCalls += 1;
    const plan: MulticaTeamPlan = {
      id: "plan-1", richProjectId: request.richProjectId, request,
      definition: {
        project: { action: "reuse", id: "project-1", title: request.richProjectName, description: request.projectDescription ?? request.goal },
        leader: { action: "create", name: "Rich 调度员", runtimeProvider: "codex", runtimeId: "runtime-1" },
        members: request.capabilities.map(item => ({ action: "reuse", id: "agent-dev", name: item.proposedName, capabilityKey: item.key, role: item.role })),
        squad: { action: "create", name: `${request.richProjectName} 执行小队`, description: "default", instructions: "delegate" },
      },
      status: "pending", createdAt: "2026-08-28T01:00:00.000Z",
    };
    this.plans.set(plan.id, structuredClone(plan));
    return plan;
  }
  async applyPlan(planId: string): Promise<MulticaProjectBinding> {
    this.applyCalls += 1;
    if (!this.plans.has(planId)) throw new Error("missing plan");
    this.binding = {
      richProjectId: "rich", richProjectName: "Rich", projectId: "project-1", projectTitle: "Rich",
      defaultSquadId: "squad-1", defaultSquadName: "Rich 执行小队",
      agents: [{ agentId: "agent-dev", name: "Rich 开发", capabilities: ["development"], role: "负责实现" }],
      createdAt: "2026-08-28T01:00:00.000Z", updatedAt: "2026-08-28T01:00:00.000Z",
    };
    return this.binding;
  }
  async getPlan(id: string) { return structuredClone(this.plans.get(id) ?? null); }
  async getBinding() { return structuredClone(this.binding); }
}

function harness() {
  const registry = new RichToolRegistry();
  const service = new FakeTeams();
  registerExecutionTeamTools(registry, service, new MemoryOperationRepo());
  return { registry, service };
}

describe("MCP execution team scenarios", () => {
  it("plans an execution team without exposing Multica CLI commands", async () => {
    const { registry, service } = harness();
    const response = await registry.invoke("rich_execution_team_plan", {
      projectId: "rich",
      projectName: "Rich",
      goal: "实现 Multica Adapter",
      projectDescription: "Rich execution context",
      workingDirectory: "/workspace/Rich",
      requiredCapabilities: [{ key: "development", description: "TypeScript development", proposedName: "Rich 开发", role: "负责实现", preferredAgentName: "Rich 开发", runtimeProvider: "codex" }],
      context: { requestId: "team-plan-1" },
    });

    expect(response).toMatchObject({
      ok: true,
      data: { plan: { id: "plan-1", definition: { project: { action: "reuse" }, leader: { action: "create" }, members: [{ action: "reuse" }], squad: { action: "create" } } } },
      refs: [{ type: "execution_team_plan", id: "plan-1", label: "Rich 执行团队计划" }],
    });
    expect(JSON.stringify(registry.listDefinitions().find(tool => tool.name === "rich_execution_team_plan")?.inputSchema)).not.toContain("multica");
    expect(service.planCalls).toBe(1);
  });

  it("requires explicit confirmation before applying the persisted plan", async () => {
    const { registry, service } = harness();
    await registry.invoke("rich_execution_team_plan", {
      projectId: "rich", projectName: "Rich", goal: "开发", requiredCapabilities: [{ key: "development", description: "开发", proposedName: "Rich 开发", role: "实现" }],
      context: { requestId: "plan-first" },
    });
    await expect(registry.invoke("rich_execution_team_apply", {
      planId: "plan-1", context: { requestId: "apply-without-confirmation" },
    })).resolves.toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });

    await expect(registry.invoke("rich_execution_team_apply", {
      planId: "plan-1", confirmed: true, context: { requestId: "apply-1" },
    })).resolves.toMatchObject({
      ok: true,
      data: { binding: { projectId: "project-1", defaultSquadId: "squad-1" } },
      verification: { status: "verified" },
    });
    expect(service.applyCalls).toBe(1);
  });

  it("reuses idempotent plan and apply responses for the same request IDs", async () => {
    const { registry, service } = harness();
    const input = {
      projectId: "rich", projectName: "Rich", goal: "开发", requiredCapabilities: [{ key: "development", description: "开发", proposedName: "Rich 开发", role: "实现" }],
      context: { requestId: "stable-plan" },
    };
    const first = await registry.invoke("rich_execution_team_plan", input);
    const second = await registry.invoke("rich_execution_team_plan", input);
    expect(second).toEqual(first);
    expect(service.planCalls).toBe(1);
  });
});
