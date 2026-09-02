import type Database from "better-sqlite3";
import type { AgentConversationConfig, AgentConversationConfigRepo, AgentConversationStatus } from "./AgentConversationConfigRepo.js";

interface ConfigRow {
  conversation_id: string;
  executor: string;
  permission_profile: string;
  workspace_root: string | null;
  allowed_mcp_servers: string;
  status: string;
  model_session_id: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: ConfigRow): AgentConversationConfig {
  return {
    conversationId: row.conversation_id,
    executor: row.executor as AgentConversationConfig["executor"],
    permissionProfile: row.permission_profile as AgentConversationConfig["permissionProfile"],
    workspaceRoot: row.workspace_root ?? undefined,
    allowedMcpServers: JSON.parse(row.allowed_mcp_servers) as string[],
    status: row.status as AgentConversationStatus,
    modelSessionId: row.model_session_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteAgentConversationConfigRepo implements AgentConversationConfigRepo {
  constructor(private readonly db: Database.Database) {}

  async get(conversationId: string): Promise<AgentConversationConfig | null> {
    const row = this.db.prepare(`
      SELECT conversation_id, executor, permission_profile, workspace_root,
             allowed_mcp_servers, status, model_session_id, created_at, updated_at
        FROM agent_conversation_configs
       WHERE conversation_id = ?
    `).get(conversationId) as ConfigRow | undefined;
    return row ? fromRow(row) : null;
  }

  async save(config: AgentConversationConfig): Promise<void> {
    this.db.prepare(`
      INSERT INTO agent_conversation_configs
        (conversation_id, executor, permission_profile, workspace_root, allowed_mcp_servers,
         status, model_session_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        executor = excluded.executor,
        permission_profile = excluded.permission_profile,
        workspace_root = excluded.workspace_root,
        allowed_mcp_servers = excluded.allowed_mcp_servers,
        status = excluded.status,
        model_session_id = excluded.model_session_id,
        updated_at = excluded.updated_at
    `).run(
      config.conversationId,
      config.executor,
      config.permissionProfile,
      config.workspaceRoot ?? null,
      JSON.stringify(config.allowedMcpServers),
      config.status,
      config.modelSessionId ?? null,
      config.createdAt,
      config.updatedAt,
    );
  }

  async setStatus(conversationId: string, status: AgentConversationStatus, updatedAt: string): Promise<void> {
    this.db.prepare(`UPDATE agent_conversation_configs SET status = ?, updated_at = ? WHERE conversation_id = ?`)
      .run(status, updatedAt, conversationId);
  }

  async setModelSessionId(conversationId: string, modelSessionId: string | undefined, updatedAt: string): Promise<void> {
    this.db.prepare(`UPDATE agent_conversation_configs SET model_session_id = ?, updated_at = ? WHERE conversation_id = ?`)
      .run(modelSessionId ?? null, updatedAt, conversationId);
  }
}
