export type AgentConversationStatus = "active" | "inactive";
export type AgentPermissionProfile = "chat_only" | "workspace_agent" | "extended_agent";

export interface AgentConversationConfig {
  conversationId: string;
  executor: "hermes";
  permissionProfile: AgentPermissionProfile;
  workspaceRoot?: string;
  allowedMcpServers: string[];
  status: AgentConversationStatus;
  modelSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConversationConfigRepo {
  get(conversationId: string): Promise<AgentConversationConfig | null>;
  save(config: AgentConversationConfig): Promise<void>;
  setStatus(conversationId: string, status: AgentConversationStatus, updatedAt: string): Promise<void>;
  setModelSessionId(conversationId: string, modelSessionId: string | undefined, updatedAt: string): Promise<void>;
}
