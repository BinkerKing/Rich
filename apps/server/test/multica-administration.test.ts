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
  workspaceMcps: any[] = [];
  calls: Array<{ args: string[]; stdin?: string }> = [];

  async runJson<T>(args: string[], options?: { stdin?: string }): Promise<T> {
    this.calls.push({ args: [...args], stdin: options?.stdin });
    const key = args.slice(0, 2).join(" ");
    if (key === "project list") return structuredClone(this.projects) as T;
    if (key === "agent list") return structuredClone(this.agents) as T;
    if (key === "runtime list") return structuredClone(this.runtimes) as T;
    if (key === "squad list") return structuredClone(this.squads) as T;
    if (args[0] === "workspace" && args[1] === "mcp" && args[2] === "list") return structuredClone(this.workspaceMcps) as T;
    if (args[0] === "workspace" && args[1] === "mcp" && args[2] === "add") {
      const mcp = { id: "mcp-rich", name: args[3], server_config: JSON.parse(options?.stdin ?? "{}") };
      this.workspaceMcps.push(mcp);
      return structuredClone(mcp) as T;
    }
    if (args[0] === "agent" && args[1] === "mcp" && args[2] === "add") return { ok: true } as T;
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
  it("uses the requested PM as Squad leader and assigns Rich MCP only to that Agent", async () => {
    const commands = new FakeMultica();
    commands.projects = [];
    commands.agents = [];
    const repo = new MemoryBindingRepo();
    const service = new MulticaAdministrationService(commands, repo, { now: () => "2026-08-28T01:00:00.000Z", id: () => "plan-vtb" });
    const vtbRequest: MulticaTeamPlanRequest = {
      richProjectId: "vtb-二代safe",
      richProjectName: "【VTB】二代SAFE",
      goal: "建立项目认知基线",
      workingDirectory: "/Users/binkerking/Documents/Ai-WorkSpace/Projects/【VTB】二代SAFE",
      executionMode: "in_place",
      leaderCapabilityKey: "project-management",
      richMcp: { name: "rich", url: "http://127.0.0.1:31515/mcp" },
      squadName: "VTB SAFE 研析小队",
      capabilities: [
        { key: "project-management", proposedName: "沈砚", role: "project-manager", description: "项目经理", runtimeProvider: "codex", model: "gpt-5.6-terra" },
        { key: "business-analysis", proposedName: "苏澄", role: "business-analyst", description: "BA", runtimeProvider: "codex", model: "gpt-5.6-terra" },
        { key: "development-analysis", proposedName: "陆骁", role: "developer", description: "开发", runtimeProvider: "codex", model: "gpt-5.6-terra" },
        { key: "test-analysis", proposedName: "林检", role: "tester", description: "测试", runtimeProvider: "codex", model: "gpt-5.6-terra" },
      ],
    };

    const plan = await service.planTeam(vtbRequest);
    expect(plan.definition.leader).toMatchObject({ name: "沈砚", capabilityKey: "project-management", role: "project-manager", model: "gpt-5.6-terra" });
    expect(plan.definition.members.map(member => member.name)).toEqual(["苏澄", "陆骁", "林检"]);
    expect(plan.definition.squad.name).toBe("VTB SAFE 研析小队");

    const binding = await service.applyPlan(plan.id);

    expect(binding).toMatchObject({
      leader: { name: "沈砚", role: "project-manager", capabilities: ["project-management"] },
      executionMode: "in_place",
      richMcp: { serverId: "mcp-rich", name: "rich", url: "http://127.0.0.1:31515/mcp" },
    });
    expect(binding.agents.map(agent => agent.name)).toEqual(["沈砚", "苏澄", "陆骁", "林检"]);
    expect(commands.calls.filter(call => call.args[0] === "agent" && call.args[1] === "create")
      .every(call => value(call.args, "--model") === "gpt-5.6-terra")).toBe(true);
    expect(commands.calls.find(call => call.args.slice(0, 3).join(" ") === "project resource add")?.args)
      .toContain("in_place");
    expect(commands.calls.filter(call => call.args.slice(0, 3).join(" ") === "agent mcp add"))
      .toEqual([expect.objectContaining({ args: ["agent", "mcp", "add", binding.leader.agentId, "mcp-rich", "--output", "json"] })]);
    expect(commands.calls.find(call => call.args.slice(0, 3).join(" ") === "workspace mcp add")?.stdin)
      .toBe(JSON.stringify({ url: "http://127.0.0.1:31515/mcp" }));
  });

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
      leader: { agentId: "agent-2", name: "Rich 调度员", role: "leader" },
      executionMode: "worktree",
      agents: [
        { agentId: "agent-2", capabilities: [], role: "leader" },
        { agentId: "agent-dev", capabilities: ["development"], role: "负责实现和验证" },
      ],
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
