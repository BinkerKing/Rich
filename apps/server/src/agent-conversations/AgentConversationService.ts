import type { AgentConversationConfig, AgentConversationConfigRepo } from "../repos/AgentConversationConfigRepo.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";

export class AgentConversationService {
  constructor(
    private readonly configs: AgentConversationConfigRepo,
    private readonly conversations: ChatConversationsRepo,
  ) {}

  async get(conversationId: string): Promise<AgentConversationConfig | null> {
    return this.configs.get(conversationId);
  }

  async getActive(conversationId: string): Promise<AgentConversationConfig | null> {
    const config = await this.configs.get(conversationId);
    return config?.status === "active" ? config : null;
  }

  async start(conversationId: string, options: { fresh?: boolean } = {}): Promise<{ config: AgentConversationConfig; resumed: boolean }> {
    const now = new Date().toISOString();
    await this.conversations.ensureConversation({ id: conversationId, surface: "agent", now });
    const existing = await this.configs.get(conversationId);
    const modelSessionId = options.fresh ? undefined : existing?.modelSessionId;
    const config: AgentConversationConfig = {
      conversationId,
      executor: "hermes",
      permissionProfile: existing?.permissionProfile ?? "chat_only",
      workspaceRoot: existing?.workspaceRoot,
      allowedMcpServers: existing?.allowedMcpServers ?? [],
      status: "active",
      modelSessionId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.configs.save(config);
    return { config, resumed: Boolean(modelSessionId) };
  }

  async exit(conversationId: string): Promise<AgentConversationConfig | null> {
    const existing = await this.configs.get(conversationId);
    if (!existing) return null;
    const updatedAt = new Date().toISOString();
    await this.configs.setStatus(conversationId, "inactive", updatedAt);
    return { ...existing, status: "inactive", updatedAt };
  }

  async recordModelSession(conversationId: string, modelSessionId: string): Promise<void> {
    await this.configs.setModelSessionId(conversationId, modelSessionId, new Date().toISOString());
  }
}
