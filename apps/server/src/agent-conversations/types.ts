import type { AgentPermissionProfile } from "../repos/AgentConversationConfigRepo.js";

export interface AgentRuntimeCapabilities {
  profiles: AgentPermissionProfile[];
  enforcesToolSelection: boolean;
  enforcesWorkspaceRoot: boolean;
  supportsResumableToolCalls: boolean;
}

export type AgentToolFamily = "filesystem" | "shell" | "browser" | "network" | "mcp";

export interface AgentCapabilityAction {
  family: AgentToolFamily;
  action: string;
  turnId?: string;
  path?: string;
  server?: string;
}

export interface AgentCapabilityDecision {
  allowed: boolean;
  requiresApproval?: boolean;
  reason?: string;
}
