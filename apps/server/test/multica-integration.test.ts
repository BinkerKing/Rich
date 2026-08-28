import { describe, expect, it } from "vitest";
import type { MulticaBindingRepo, MulticaProjectBinding, MulticaTeamPlan, MulticaTeamPlanRequest } from "../src/mcp-v2/delegation/multica/MulticaBindingRepo.js";
import { createMulticaIntegration } from "../src/mcp-v2/delegation/multica/createMulticaIntegration.js";
import type { MulticaCommandPort } from "../src/mcp-v2/delegation/multica/types.js";

class MemoryRepo implements MulticaBindingRepo {
  bindings = new Map<string, MulticaProjectBinding>();
  plans = new Map<string, MulticaTeamPlan>();
  getBinding(id: string) { return structuredClone(this.bindings.get(id) ?? null); }
  saveBinding(value: MulticaProjectBinding) { this.bindings.set(value.richProjectId, structuredClone(value)); }
  createPlan(value: MulticaTeamPlan) { this.plans.set(value.id, structuredClone(value)); }
  getPlan(id: string) { return structuredClone(this.plans.get(id) ?? null); }
  markPlanApplied(id: string, binding: MulticaProjectBinding, appliedAt: string) {
    const plan = this.plans.get(id)!;
    this.saveBinding(binding);
    this.plans.set(id, { ...plan, status: "applied", appliedAt, resolvedBinding: binding });
  }
}

const request: MulticaTeamPlanRequest = {
  richProjectId: "rich", richProjectName: "Rich", goal: "prepare team",
  capabilities: [{ key: "development", description: "development", proposedName: "Rich 开发", role: "implement" }],
};

describe("Multica production integration", () => {
  it("constructs administration and delegation services around one command port", () => {
    const commands: MulticaCommandPort = { runJson: async () => [] };
    const integration = createMulticaIntegration(new MemoryRepo(), { commands });
    expect(integration.executionTeams).toBeTruthy();
    expect(integration.delegationAdapter.backend).toBe("multica-cli");
    expect(integration.workbench).toBeTruthy();
  });

  it("does not discover or execute the CLI during construction", () => {
    let discoveries = 0;
    createMulticaIntegration(new MemoryRepo(), {
      discoverExecutable: () => { discoveries += 1; return "/missing/multica"; },
    });
    expect(discoveries).toBe(0);
  });

  it("turns a missing CLI into a retryable dependency error on first use", async () => {
    const integration = createMulticaIntegration(new MemoryRepo(), {
      discoverExecutable: () => { throw new Error("Multica CLI missing"); },
    });
    await expect(integration.executionTeams.planTeam(request)).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      retryable: true,
    });
  });
});
