import { describe, expect, it } from "vitest";
import type {
  MulticaBindingRepo,
  MulticaProjectBinding,
  MulticaTeamPlan,
  MulticaTeamPlanRequest,
} from "../src/mcp-v2/delegation/multica/MulticaBindingRepo.js";
import { MulticaAdministrationService } from "../src/mcp-v2/delegation/multica/MulticaAdministrationService.js";
import type { MulticaCommandPort } from "../src/mcp-v2/delegation/multica/types.js";

class MemoryBindingRepo implements MulticaBindingRepo {
  bindings = new Map<string, MulticaProjectBinding>();
  plans = new Map<string, MulticaTeamPlan>();
  getBinding(id: string) { return structuredClone(this.bindings.get(id) ?? null); }
  saveBinding(binding: MulticaProjectBinding) { this.bindings.set(binding.richProjectId, structuredClone(binding)); }
  createPlan(plan: MulticaTeamPlan) {
    if (this.plans.has(plan.id)) throw new Error("duplicate plan");
    this.plans.set(plan.id, structuredClone(plan));
  }
  getPlan(id: string) { return structuredClone(this.plans.get(id) ?? null); }
  markPlanApplied(id: string, binding: MulticaProjectBinding, appliedAt: string) {
    const plan = this.plans.get(id);
    if (!plan) throw new Error(`missing ${id}`);
    this.saveBinding(binding);
    this.plans.set(id, { ...plan, status: "applied", appliedAt, resolvedBinding: structuredClone(binding) });
  }
}

class FakeMultica implements MulticaCommandPort {
  projects: any[] = [{ id: "project-1", title: "Rich", description: "Rich context", status: "planned" }];
  agents: any[] = [{ id: "agent-dev", name: "Rich 开发", description: "TypeScript development", instructions: "Implement and test", runtime_id: "runtime-codex", status: "idle" }];
  runtimes: any[] = [{ id: "runtime-codex", name: "Codex (Mac)", provider: "codex", status: "online", daemon_id: "daemon-1" }];
  squads: any[] = [];
  resources: any[] = [];
  calls: Array<{ args: string[]; stdin?: string }> = [];

  async runJson<T>(args: string[], options?: { stdin?: string }): Promise<T> {
    this.calls.push({ args: [...args], stdin: options?.stdin });
    const key = args.slice(0, 2).join(" ");
    if (key === "project list") return structuredClone(this.projects) as T;
    if (key === "agent list") return structuredClone(this.agents) as T;
    if (key === "runtime list") return structuredClone(this.runtimes) as T;
    if (key === "squad list") return structuredClone(this.squads) as T;
    if (args[0] === "project" && args[1] === "resource" && args[2] === "list") return structuredClone(this.resources) as T;
    if (key === "project create") {
      const project = { id: `project-${this.projects.length + 1}`, title: value(args, "--title"), description: value(args, "--description"), status: "planned" };
      this.projects.push(project);
      return structuredClone(project) as T;
    }
    if (key === "agent create") {
      const agent = { id: `agent-${this.agents.length + 1}`, name: value(args, "--name"), description: value(args, "--description"), instructions: value(args, "--instructions"), runtime_id: value(args, "--runtime-id"), status: "idle" };
      this.agents.push(agent);
      return structuredClone(agent) as T;
    }
    if (key === "squad create") {
      const squad = { id: `squad-${this.squads.length + 1}`, name: value(args, "--name"), description: value(args, "--description"), leader_id: value(args, "--leader") };
      this.squads.push(squad);
      return structuredClone(squad) as T;
    }
    if (key === "squad update") return structuredClone(this.squads.find(item => item.id === args[2])) as T;
    if (args[0] === "squad" && args[1] === "member") return { ok: true } as T;
    if (args[0] === "project" && args[1] === "resource" && args[2] === "add") {
      const resource = { id: "resource-1", resource_ref: { type: "local_directory", local_path: value(args, "--local-path") } };
      this.resources.push(resource);
      return resource as T;
    }
    if ((args[1] === "get" || key === "squad get") && args[2]) {
      const source = args[0] === "project" ? this.projects : args[0] === "agent" ? this.agents : this.squads;
      return structuredClone(source.find(item => item.id === args[2])) as T;
    }
    throw new Error(`Unexpected command: ${args.join(" ")}`);
  }
}

const request: MulticaTeamPlanRequest = {
  richProjectId: "rich",
  richProjectName: "Rich",
  goal: "实现 Multica Adapter",
  projectDescription: "Rich 项目执行上下文",
  workingDirectory: "/workspace/Rich",
  capabilities: [{
    key: "development",
    description: "TypeScript development",
    proposedName: "Rich 开发",
    preferredAgentName: "Rich 开发",
    role: "负责实现和验证",
    runtimeProvider: "codex",
  }],
};

describe("MulticaAdministrationService", () => {
  it("plans exact Project and Agent reuse while proposing a dedicated Leader and Squad", async () => {
    const commands = new FakeMultica();
    const repo = new MemoryBindingRepo();
    const service = new MulticaAdministrationService(commands, repo, { now: () => "2026-08-28T01:00:00.000Z", id: () => "plan-1" });

    const plan = await service.planTeam(request);

    expect(plan).toMatchObject({
      id: "plan-1",
      status: "pending",
      definition: {
        project: { action: "reuse", id: "project-1" },
        leader: { action: "create", name: "Rich 调度员", runtimeId: "runtime-codex" },
        members: [{ action: "reuse", id: "agent-dev", capabilityKey: "development" }],
        squad: { action: "create", name: "Rich 执行小队" },
      },
    });
    expect(repo.plans.get("plan-1")).toEqual(plan);
    expect(commands.calls.every(call => call.args[1] === "list")).toBe(true);
  });

  it("applies a confirmed plan in dependency order and reuses the applied result", async () => {
    const commands = new FakeMultica();
    const repo = new MemoryBindingRepo();
    const service = new MulticaAdministrationService(commands, repo, { now: () => "2026-08-28T01:00:00.000Z", id: () => "plan-1" });
    await service.planTeam(request);
    commands.calls.length = 0;

    const binding = await service.applyPlan("plan-1");

    expect(binding).toMatchObject({
      richProjectId: "rich",
      projectId: "project-1",
      defaultSquadName: "Rich 执行小队",
      agents: [{ agentId: "agent-dev", capabilities: ["development"], role: "负责实现和验证" }],
    });
    const mutating = commands.calls.filter(call => ["create", "update", "member"].includes(call.args[1] ?? "")
      || (call.args[0] === "project" && call.args[1] === "resource" && call.args[2] === "add"));
    expect(mutating.map(call => call.args.slice(0, 2).join(" "))).toEqual([
      "agent create",
      "squad create",
      "squad update",
      "squad member",
      "project resource",
    ]);
    commands.calls.length = 0;
    await expect(service.applyPlan("plan-1")).resolves.toEqual(binding);
    expect(commands.calls).toEqual([]);
  });

  it("reconciles an externally created named resource instead of duplicating it", async () => {
    const commands = new FakeMultica();
    const repo = new MemoryBindingRepo();
    const service = new MulticaAdministrationService(commands, repo, { now: () => "2026-08-28T01:00:00.000Z", id: () => "plan-1" });
    await service.planTeam(request);
    commands.agents.push({ id: "agent-leader-existing", name: "Rich 调度员", description: "created after planning", status: "idle" });
    commands.calls.length = 0;

    await service.applyPlan("plan-1");

    expect(commands.calls.some(call => call.args[0] === "agent" && call.args[1] === "create" && value(call.args, "--name") === "Rich 调度员")).toBe(false);
    expect(repo.bindings.get("rich")?.defaultSquadId).toBeTruthy();
  });
});

function value(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : "";
}
