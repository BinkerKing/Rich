export interface MulticaAgentBinding {
  agentId: string;
  name: string;
  capabilities: string[];
  role: string;
}

export interface MulticaProjectBinding {
  richProjectId: string;
  richProjectName: string;
  projectId: string;
  projectTitle: string;
  defaultSquadId: string;
  defaultSquadName: string;
  leader?: MulticaAgentBinding;
  executionMode?: "in_place" | "worktree";
  richMcp?: { serverId: string; name: string; url: string; agentId: string };
  agents: MulticaAgentBinding[];
  createdAt: string;
  updatedAt: string;
}

export interface MulticaCapabilityRequest {
  key: string;
  description: string;
  proposedName: string;
  role: string;
  preferredAgentName?: string;
  runtimeProvider?: string;
  model?: string;
  instructions?: string;
}

export interface MulticaTeamPlanRequest {
  richProjectId: string;
  richProjectName: string;
  goal: string;
  projectDescription?: string;
  workingDirectory?: string;
  squadName?: string;
  leaderCapabilityKey?: string;
  executionMode?: "in_place" | "worktree";
  richMcp?: { name: string; url: string };
  capabilities: MulticaCapabilityRequest[];
}

export interface MulticaAgentDecision {
  action: "reuse" | "create";
  id?: string;
  name: string;
  capabilityKey?: string;
  role?: string;
  description?: string;
  instructions?: string;
  runtimeProvider?: string;
  runtimeId?: string;
  model?: string;
}

export interface MulticaTeamPlanDefinition {
  project: {
    action: "reuse" | "create";
    id?: string;
    title: string;
    description: string;
  };
  leader: MulticaAgentDecision;
  members: MulticaAgentDecision[];
  squad: {
    action: "reuse" | "create";
    id?: string;
    name: string;
    description: string;
    instructions: string;
  };
}

export interface MulticaTeamPlan {
  id: string;
  richProjectId: string;
  request: MulticaTeamPlanRequest;
  definition: MulticaTeamPlanDefinition;
  status: "pending" | "applied";
  createdAt: string;
  appliedAt?: string;
  resolvedBinding?: MulticaProjectBinding;
}

type MaybePromise<T> = T | Promise<T>;

export interface MulticaBindingRepo {
  getBinding(richProjectId: string): MaybePromise<MulticaProjectBinding | null>;
  saveBinding(binding: MulticaProjectBinding): MaybePromise<void>;
  createPlan(plan: MulticaTeamPlan): MaybePromise<void>;
  getPlan(planId: string): MaybePromise<MulticaTeamPlan | null>;
  markPlanApplied(planId: string, binding: MulticaProjectBinding, appliedAt: string): MaybePromise<void>;
}
