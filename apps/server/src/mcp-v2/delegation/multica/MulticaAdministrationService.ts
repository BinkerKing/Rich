import { randomUUID } from "node:crypto";
import { RichMcpError } from "../../registry/errors.js";
import type {
  MulticaAgentDecision,
  MulticaBindingRepo,
  MulticaProjectBinding,
  MulticaTeamPlan,
  MulticaTeamPlanRequest,
} from "./MulticaBindingRepo.js";
import {
  multicaAgentListSchema,
  multicaAgentSchema,
  multicaProjectListSchema,
  multicaProjectSchema,
  multicaRuntimeListSchema,
  multicaSquadListSchema,
  multicaSquadSchema,
  type MulticaAgent,
  type MulticaCommandPort,
  type MulticaProject,
  type MulticaRuntime,
  type MulticaSquad,
} from "./types.js";

interface ServiceOptions {
  now?: () => string;
  id?: () => string;
}

const LEADER_NAME = "Rich 调度员";

export class MulticaAdministrationService {
  private readonly now: () => string;
  private readonly id: () => string;

  constructor(
    private readonly commands: MulticaCommandPort,
    private readonly bindings: MulticaBindingRepo,
    options: ServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.id = options.id ?? randomUUID;
  }

  async planTeam(request: MulticaTeamPlanRequest): Promise<MulticaTeamPlan> {
    const [projects, agents, runtimes, squads, currentBinding] = await Promise.all([
      this.listProjects(), this.listAgents(), this.listRuntimes(), this.listSquads(),
      Promise.resolve(this.bindings.getBinding(request.richProjectId)),
    ]);
    const project = projects.find(item => item.id === currentBinding?.projectId)
      ?? exact(projects, request.richProjectName, item => item.title);
    const leaderCapability = request.leaderCapabilityKey
      ? request.capabilities.find(capability => capability.key === request.leaderCapabilityKey)
      : undefined;
    if (request.leaderCapabilityKey && !leaderCapability) {
      throw new RichMcpError("VALIDATION_ERROR", `Leader capability ${request.leaderCapabilityKey} was not requested.`);
    }
    const leader = leaderCapability
      ? findAgent(agents, leaderCapability)
      : exact(agents, LEADER_NAME, item => item.name);
    const squadName = request.squadName ?? `${request.richProjectName} 执行小队`;
    const squad = squads.find(item => item.id === currentBinding?.defaultSquadId)
      ?? exact(squads, squadName, item => item.name);
    const defaultRuntime = selectRuntime(runtimes, "codex");

    const plan: MulticaTeamPlan = {
      id: this.id(),
      richProjectId: request.richProjectId,
      request: structuredClone(request),
      definition: {
        project: project
          ? { action: "reuse", id: project.id, title: project.title, description: project.description ?? request.projectDescription ?? request.goal }
          : { action: "create", title: request.richProjectName, description: request.projectDescription ?? `Rich project: ${request.goal}` },
        leader: leader
          ? {
              action: "reuse", id: leader.id, name: leader.name,
              ...(leaderCapability ? { capabilityKey: leaderCapability.key, role: leaderCapability.role } : {}),
            }
          : leaderCapability
            ? createAgentDecision(leaderCapability, selectRuntime(runtimes, leaderCapability.runtimeProvider ?? "codex"))
          : {
              action: "create",
              name: LEADER_NAME,
              description: "负责 Rich 外部任务的拆解、选人、跟踪与复核，不直接执行实现工作。",
              instructions: "你是 Rich 专职调度员。分析 Issue，选择最合适的 Squad 成员并委派；跟踪整体目标与验收标准；不要直接实现任务。",
              runtimeProvider: defaultRuntime.provider,
              runtimeId: defaultRuntime.id,
            },
        members: request.capabilities.filter(capability => capability.key !== request.leaderCapabilityKey).map(capability => {
          const agent = findAgent(agents, capability);
          if (agent) {
            return { action: "reuse", id: agent.id, name: agent.name, capabilityKey: capability.key, role: capability.role };
          }
          const runtime = selectRuntime(runtimes, capability.runtimeProvider ?? "codex");
          return {
            action: "create",
            name: capability.proposedName,
            capabilityKey: capability.key,
            role: capability.role,
            description: capability.description,
            instructions: capability.instructions ?? `负责 ${capability.description}。完成后报告产物、验证结果和剩余风险。`,
            runtimeProvider: runtime.provider,
            runtimeId: runtime.id,
            ...(capability.model ? { model: capability.model } : {}),
          };
        }),
        squad: squad
          ? { action: "reuse", id: squad.id, name: squad.name, description: squad.description ?? `${request.richProjectName} 默认执行团队`, instructions: squad.instructions ?? squadInstructions(request.richProjectName) }
          : { action: "create", name: squadName, description: `${request.richProjectName} 默认执行团队`, instructions: squadInstructions(request.richProjectName) },
      },
      status: "pending",
      createdAt: this.now(),
    };
    await this.bindings.createPlan(plan);
    return plan;
  }

  async applyPlan(planId: string): Promise<MulticaProjectBinding> {
    const plan = await this.bindings.getPlan(planId);
    if (!plan) throw new RichMcpError("NOT_FOUND", `Execution team plan ${planId} was not found.`);
    if (plan.status === "applied" && plan.resolvedBinding) return plan.resolvedBinding;
    if (plan.status !== "pending") throw new RichMcpError("CONFLICT", `Execution team plan ${planId} cannot be applied from ${plan.status}.`);

    const project = await this.resolveProject(plan);
    const leader = await this.resolveAgent(plan.definition.leader);
    const members = [];
    for (const decision of plan.definition.members) members.push(await this.resolveAgent(decision));
    const squad = await this.resolveSquad(plan, leader);

    await this.commands.runJson(["squad", "update", squad.id, "--instructions", plan.definition.squad.instructions, "--output", "json"]);
    const squadDetails = await this.commands.runJson<unknown>(["squad", "get", squad.id, "--output", "json"]);
    const existingMemberIds = collectMemberIds(squadDetails);
    for (let index = 0; index < members.length; index += 1) {
      const member = members[index];
      if (existingMemberIds.has(member.id)) continue;
      await this.commands.runJson(["squad", "member", "add", squad.id, "--member-id", member.id,
        "--type", "agent", "--role", plan.definition.members[index].role ?? "member", "--output", "json"]);
    }
    if (plan.request.workingDirectory) {
      await this.ensureLocalDirectory(project.id, plan.request.workingDirectory, [leader, ...members], plan.request.executionMode ?? "worktree");
    }
    const richMcp = plan.request.richMcp
      ? await this.ensureWorkspaceMcp(plan.request.richMcp, leader.id)
      : undefined;

    const previous = await this.bindings.getBinding(plan.richProjectId);
    const timestamp = this.now();
    const binding: MulticaProjectBinding = {
      richProjectId: plan.richProjectId,
      richProjectName: plan.request.richProjectName,
      projectId: project.id,
      projectTitle: project.title,
      defaultSquadId: squad.id,
      defaultSquadName: squad.name,
      leader: bindingAgent(leader, plan.definition.leader),
      executionMode: plan.request.executionMode ?? "worktree",
      ...(richMcp ? { richMcp } : {}),
      agents: [bindingAgent(leader, plan.definition.leader), ...members.map((member, index) => bindingAgent(member, plan.definition.members[index]))],
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await this.bindings.markPlanApplied(plan.id, binding, timestamp);
    return binding;
  }

  async getBinding(richProjectId: string): Promise<MulticaProjectBinding | null> {
    return this.bindings.getBinding(richProjectId);
  }

  async getPlan(planId: string): Promise<MulticaTeamPlan | null> {
    return this.bindings.getPlan(planId);
  }

  private async resolveProject(plan: MulticaTeamPlan): Promise<MulticaProject> {
    const decision = plan.definition.project;
    if (decision.action === "reuse" && decision.id) {
      const projects = await this.listProjects();
      const project = projects.find(item => item.id === decision.id);
      if (!project) throw new RichMcpError("NOT_FOUND", `Multica Project ${decision.id} no longer exists.`);
      return project;
    }
    const existing = exact(await this.listProjects(), decision.title, item => item.title);
    if (existing) return existing;
    return multicaProjectSchema.parse(await this.commands.runJson(["project", "create", "--title", decision.title,
      "--description", decision.description, "--status", "planned", "--output", "json"]));
  }

  private async resolveAgent(decision: MulticaAgentDecision): Promise<MulticaAgent> {
    const agents = await this.listAgents();
    if (decision.action === "reuse" && decision.id) {
      const agent = agents.find(item => item.id === decision.id);
      if (!agent) throw new RichMcpError("NOT_FOUND", `Multica Agent ${decision.id} no longer exists.`);
      return agent;
    }
    const existing = exact(agents, decision.name, item => item.name);
    if (existing) return existing;
    if (!decision.runtimeId) throw new RichMcpError("VALIDATION_ERROR", `No runtime was resolved for Agent ${decision.name}.`);
    const args = ["agent", "create", "--name", decision.name, "--description", decision.description ?? "",
      "--instructions", decision.instructions ?? "", "--runtime-id", decision.runtimeId, "--permission-mode", "private", "--output", "json"];
    if (decision.model) args.push("--model", decision.model);
    return multicaAgentSchema.parse(await this.commands.runJson(args));
  }

  private async resolveSquad(plan: MulticaTeamPlan, leader: MulticaAgent): Promise<MulticaSquad> {
    const decision = plan.definition.squad;
    const squads = await this.listSquads();
    if (decision.action === "reuse" && decision.id) {
      const squad = squads.find(item => item.id === decision.id);
      if (!squad) throw new RichMcpError("NOT_FOUND", `Multica Squad ${decision.id} no longer exists.`);
      return squad;
    }
    const existing = exact(squads, decision.name, item => item.name);
    if (existing) return existing;
    return multicaSquadSchema.parse(await this.commands.runJson(["squad", "create", "--name", decision.name,
      "--leader", leader.id, "--description", decision.description, "--output", "json"]));
  }

  private async ensureLocalDirectory(projectId: string, path: string, agents: MulticaAgent[], executionMode: "in_place" | "worktree"): Promise<void> {
    const resources = await this.commands.runJson<unknown>(["project", "resource", "list", projectId, "--output", "json"]);
    if (JSON.stringify(resources).includes(JSON.stringify(path))) return;
    const [runtimes, currentAgents] = await Promise.all([this.listRuntimes(), this.listAgents()]);
    const runtimeIds = agents.map(agent => currentAgents.find(candidate => candidate.id === agent.id)?.runtime_id).filter(Boolean);
    const runtime = runtimes.find(candidate => runtimeIds.includes(candidate.id) && candidate.daemon_id)
      ?? runtimes.find(candidate => candidate.status.toLocaleLowerCase() === "online" && candidate.daemon_id);
    if (!runtime?.daemon_id) throw new RichMcpError("DEPENDENCY_UNAVAILABLE", "No online Multica runtime with a daemon is available for the local project directory.", { retryable: true });
    await this.commands.runJson(["project", "resource", "add", projectId, "--type", "local_directory",
      "--local-path", path, "--daemon-id", runtime.daemon_id, "--execution-mode", executionMode, "--label", "Rich project directory", "--output", "json"]);
  }

  private async ensureWorkspaceMcp(request: { name: string; url: string }, agentId: string): Promise<NonNullable<MulticaProjectBinding["richMcp"]>> {
    const listed = await this.commands.runJson<unknown>(["workspace", "mcp", "list", "--output", "json"]);
    const existing = collectObjects(listed).find(item => normalize(String(item.name ?? "")) === normalize(request.name));
    const created = existing ?? await this.commands.runJson<unknown>(
      ["workspace", "mcp", "add", request.name, "--server-config-stdin", "--output", "json"],
      { stdin: JSON.stringify({ url: request.url }) },
    );
    const serverId = firstString(created, "id", "server_id", "mcp_server_id");
    if (!serverId) throw new RichMcpError("DEPENDENCY_UNAVAILABLE", `Multica did not return an id for MCP server ${request.name}.`, { retryable: true });
    await this.commands.runJson(["agent", "mcp", "add", agentId, serverId, "--output", "json"]);
    return { serverId, name: request.name, url: request.url, agentId };
  }

  private async listProjects() { return multicaProjectListSchema.parse(await this.commands.runJson(["project", "list", "--output", "json"])); }
  private async listAgents() { return multicaAgentListSchema.parse(await this.commands.runJson(["agent", "list", "--output", "json"])); }
  private async listRuntimes() { return multicaRuntimeListSchema.parse(await this.commands.runJson(["runtime", "list", "--output", "json"])); }
  private async listSquads() { return multicaSquadListSchema.parse(await this.commands.runJson(["squad", "list", "--output", "json"])); }
}

function createAgentDecision(capability: MulticaTeamPlanRequest["capabilities"][number], runtime: MulticaRuntime): MulticaAgentDecision {
  return {
    action: "create",
    name: capability.proposedName,
    capabilityKey: capability.key,
    role: capability.role,
    description: capability.description,
    instructions: capability.instructions ?? `负责 ${capability.description}。完成后报告产物、验证结果和剩余风险。`,
    runtimeProvider: runtime.provider,
    runtimeId: runtime.id,
    ...(capability.model ? { model: capability.model } : {}),
  };
}

function bindingAgent(agent: MulticaAgent, decision: MulticaAgentDecision): MulticaProjectBinding["agents"][number] {
  return {
    agentId: agent.id,
    name: agent.name,
    capabilities: decision.capabilityKey ? [decision.capabilityKey] : [],
    role: decision.role ?? "leader",
  };
}

function collectObjects(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(collectObjects);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap(collectObjects)];
}

function firstString(value: unknown, ...keys: string[]): string | undefined {
  for (const record of collectObjects(value)) {
    for (const key of keys) if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return undefined;
}

function findAgent(agents: MulticaAgent[], capability: MulticaTeamPlanRequest["capabilities"][number]): MulticaAgent | undefined {
  const active = agents.filter(agent => !agent.archived_at);
  const preferred = capability.preferredAgentName && exact(active, capability.preferredAgentName, item => item.name);
  if (preferred) return preferred;
  const named = exact(active, capability.proposedName, item => item.name);
  if (named) return named;
  const tokens = [capability.key, ...words(capability.description)];
  return active
    .map(agent => ({ agent, score: tokens.reduce((score, token) => score + (agentText(agent).includes(token) ? 1 : 0), 0) }))
    .filter(candidate => candidate.score >= 2)
    .sort((left, right) => right.score - left.score)[0]?.agent;
}

function selectRuntime(runtimes: MulticaRuntime[], provider: string): MulticaRuntime {
  const matching = runtimes.filter(runtime => normalize(runtime.provider) === normalize(provider));
  const selected = matching.find(runtime => normalize(runtime.status) === "online") ?? matching[0];
  if (!selected) throw new RichMcpError("DEPENDENCY_UNAVAILABLE", `No Multica runtime is available for provider ${provider}.`, { retryable: true });
  return selected;
}

function collectMemberIds(value: unknown): Set<string> {
  const ids = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.member_id === "string") ids.add(record.member_id);
    if (record.member && typeof record.member === "object" && typeof (record.member as Record<string, unknown>).id === "string") {
      ids.add((record.member as Record<string, string>).id);
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return ids;
}

function exact<T>(items: T[], expected: string, read: (item: T) => string): T | undefined {
  const normalized = normalize(expected);
  return items.find(item => normalize(read(item)) === normalized);
}

function squadInstructions(projectName: string): string {
  return `你是 ${projectName} 的执行小队。Leader 负责理解目标、选择成员、委派和汇总；成员按角色完成工作并回报证据；只有整体目标与验收标准满足后才进入复核。`;
}

function agentText(agent: MulticaAgent): string {
  return normalize([agent.name, agent.description, agent.instructions].filter(Boolean).join(" "));
}

function words(value: string): string[] {
  return normalize(value).split(/[^\p{L}\p{N}_-]+/u).filter(token => token.length >= 2);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}
