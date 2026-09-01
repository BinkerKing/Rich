import type Database from "better-sqlite3";
import type { AgentApprovalRepo, ConsumeAgentApprovalInput, CreateAgentApprovalInput } from "./AgentApprovalRepo.js";

export class SqliteAgentApprovalRepo implements AgentApprovalRepo {
  constructor(private readonly db: Database.Database) {}
  async create(input: CreateAgentApprovalInput): Promise<void> {
    this.db.prepare(`INSERT INTO agent_approvals (id, conversation_id, turn_id, tool_call_id, arguments_digest, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(input.id, input.conversationId, input.turnId, input.toolCallId, input.argumentsDigest, input.expiresAt, input.now);
  }
  async consume(id: string, input: ConsumeAgentApprovalInput): Promise<{ consumedAt: string } | null> {
    const result = this.db.prepare(`UPDATE agent_approvals SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND conversation_id = ? AND turn_id = ? AND tool_call_id = ? AND arguments_digest = ?`)
      .run(input.now, id, input.now, input.conversationId, input.turnId, input.toolCallId, input.argumentsDigest);
    return result.changes ? { consumedAt: input.now } : null;
  }
}
