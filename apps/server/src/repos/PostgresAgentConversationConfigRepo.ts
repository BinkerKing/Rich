import type { PgPool } from "../db/postgres.js";
import type { AgentConversationConfig, AgentConversationConfigRepo, AgentConversationStatus } from "./AgentConversationConfigRepo.js";

interface ConfigRow {
  conversation_id: string;
  executor: string;
  permission_profile: string;
  workspace_root: string | null;
  allowed_mcp_servers: string[] | null;
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
    allowedMcpServers: row.allowed_mcp_servers ?? [],
    status: row.status as AgentConversationStatus,
    modelSessionId: row.model_session_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresAgentConversationConfigRepo implements AgentConversationConfigRepo {
  constructor(private readonly pool: PgPool) {}

  async get(conversationId: string): Promise<AgentConversationConfig | null> {
    const { rows } = await this.pool.query<ConfigRow>(`
      SELECT conversation_id, executor, permission_profile, workspace_root,
             allowed_mcp_servers, status, model_session_id, created_at, updated_at
        FROM agent_conversation_configs
       WHERE conversation_id = $1
    `, [conversationId]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async save(config: AgentConversationConfig): Promise<void> {
    await this.pool.query(`
      INSERT INTO agent_conversation_configs
        (conversation_id, executor, permission_profile, workspace_root, allowed_mcp_servers,
         status, model_session_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
      ON CONFLICT(conversation_id) DO UPDATE SET
        executor = EXCLUDED.executor,
        permission_profile = EXCLUDED.permission_profile,
        workspace_root = EXCLUDED.workspace_root,
        allowed_mcp_servers = EXCLUDED.allowed_mcp_servers,
        status = EXCLUDED.status,
        model_session_id = EXCLUDED.model_session_id,
        updated_at = EXCLUDED.updated_at
    `, [
      config.conversationId,
      config.executor,
      config.permissionProfile,
      config.workspaceRoot ?? null,
      JSON.stringify(config.allowedMcpServers),
      config.status,
      config.modelSessionId ?? null,
      config.createdAt,
      config.updatedAt,
    ]);
  }

  async setStatus(conversationId: string, status: AgentConversationStatus, updatedAt: string): Promise<void> {
    await this.pool.query(`UPDATE agent_conversation_configs SET status = $1, updated_at = $2 WHERE conversation_id = $3`, [status, updatedAt, conversationId]);
  }

  async setModelSessionId(conversationId: string, modelSessionId: string | undefined, updatedAt: string): Promise<void> {
    await this.pool.query(`UPDATE agent_conversation_configs SET model_session_id = $1, updated_at = $2 WHERE conversation_id = $3`, [modelSessionId ?? null, updatedAt, conversationId]);
  }
}
