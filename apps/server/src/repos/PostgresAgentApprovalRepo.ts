import type { PgPool } from "../db/postgres.js";
import type { AgentApprovalRepo, ConsumeAgentApprovalInput, CreateAgentApprovalInput } from "./AgentApprovalRepo.js";

export class PostgresAgentApprovalRepo implements AgentApprovalRepo {
  constructor(private readonly pool: PgPool) {}
  async create(input: CreateAgentApprovalInput): Promise<void> {
    await this.pool.query(`INSERT INTO agent_approvals (id, conversation_id, turn_id, tool_call_id, arguments_digest, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [input.id, input.conversationId, input.turnId, input.toolCallId, input.argumentsDigest, input.expiresAt, input.now]);
  }
  async consume(id: string, input: ConsumeAgentApprovalInput): Promise<{ consumedAt: string } | null> {
    const { rows } = await this.pool.query<{ consumed_at: string }>(`UPDATE agent_approvals SET consumed_at = $1, decision = 'approved' WHERE id = $2 AND consumed_at IS NULL AND expires_at > $1 AND conversation_id = $3 AND turn_id = $4 AND tool_call_id = $5 AND arguments_digest = $6 RETURNING consumed_at`, [input.now, id, input.conversationId, input.turnId, input.toolCallId, input.argumentsDigest]);
    return rows[0] ? { consumedAt: rows[0].consumed_at } : null;
  }
  async deny(id: string, input: ConsumeAgentApprovalInput): Promise<{ consumedAt: string } | null> {
    const { rows } = await this.pool.query<{ consumed_at: string }>(`UPDATE agent_approvals SET consumed_at = $1, decision = 'denied' WHERE id = $2 AND consumed_at IS NULL AND expires_at > $1 AND conversation_id = $3 AND turn_id = $4 AND tool_call_id = $5 AND arguments_digest = $6 RETURNING consumed_at`, [input.now, id, input.conversationId, input.turnId, input.toolCallId, input.argumentsDigest]);
    return rows[0] ? { consumedAt: rows[0].consumed_at } : null;
  }
}
