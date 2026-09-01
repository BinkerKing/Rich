import type Database from "better-sqlite3";
import type {
  AgentConversationTurn,
  AgentConversationTurnRepo,
  AgentConversationTurnStatus,
  ClaimAgentConversationTurnInput,
  CreateAgentConversationTurnInput,
} from "./AgentConversationTurnRepo.js";

interface TurnRow {
  id: string;
  conversation_id: string;
  client_request_id: string;
  user_message_id: string;
  sequence: number;
  status: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  runtime_session_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: TurnRow): AgentConversationTurn {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    clientRequestId: row.client_request_id,
    userMessageId: row.user_message_id,
    sequence: row.sequence,
    status: row.status as AgentConversationTurnStatus,
    leaseOwner: row.lease_owner ?? undefined,
    leaseExpiresAt: row.lease_expires_at ?? undefined,
    runtimeSessionId: row.runtime_session_id ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `id, conversation_id, client_request_id, user_message_id, sequence,
  status, lease_owner, lease_expires_at, runtime_session_id, error, created_at, updated_at`;

export class SqliteAgentConversationTurnRepo implements AgentConversationTurnRepo {
  constructor(private readonly db: Database.Database) {}

  async get(id: string): Promise<AgentConversationTurn | null> {
    const row = this.db.prepare(`SELECT ${SELECT_COLUMNS} FROM agent_conversation_turns WHERE id = ?`).get(id) as TurnRow | undefined;
    return row ? fromRow(row) : null;
  }

  async getByClientRequest(conversationId: string, clientRequestId: string): Promise<AgentConversationTurn | null> {
    const row = this.db.prepare(`SELECT ${SELECT_COLUMNS} FROM agent_conversation_turns WHERE conversation_id = ? AND client_request_id = ?`)
      .get(conversationId, clientRequestId) as TurnRow | undefined;
    return row ? fromRow(row) : null;
  }

  async hasActiveLease(id: string, now: string): Promise<boolean> {
    const row = this.db.prepare(`SELECT 1 AS active FROM agent_conversation_turns
      WHERE id = ? AND status = 'running' AND lease_expires_at > ?`).get(id, now) as { active: number } | undefined;
    return Boolean(row?.active);
  }

  async createOrGet(input: CreateAgentConversationTurnInput): Promise<{ turn: AgentConversationTurn; created: boolean }> {
    return this.db.transaction(() => {
      const retry = this.db.prepare(`SELECT ${SELECT_COLUMNS} FROM agent_conversation_turns WHERE conversation_id = ? AND client_request_id = ?`)
        .get(input.conversationId, input.clientRequestId) as TurnRow | undefined;
      if (retry) return { turn: fromRow(retry), created: false };

      const active = this.db.prepare(`SELECT ${SELECT_COLUMNS} FROM agent_conversation_turns WHERE conversation_id = ? AND status IN ('queued', 'running', 'waiting_approval') LIMIT 1`)
        .get(input.conversationId) as TurnRow | undefined;
      if (active) {
        const expired = active.status === "running" && active.lease_expires_at !== null && active.lease_expires_at <= input.now;
        if (!expired) throw new Error("Agent conversation turn already running");
        this.db.prepare(`UPDATE agent_conversation_turns SET status = 'failed', error = 'turn lease expired', lease_owner = NULL, lease_expires_at = NULL, updated_at = ? WHERE id = ?`)
          .run(input.now, active.id);
      }

      const sequence = (this.db.prepare(`SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM agent_conversation_turns WHERE conversation_id = ?`)
        .get(input.conversationId) as { value: number }).value;
      this.db.prepare(`INSERT INTO chat_messages
        (id, conversation_id, role, content, adapter, model_session_id, metadata, created_at)
        VALUES (?, ?, 'user', ?, NULL, NULL, ?, ?)`)
        .run(input.userMessageId, input.conversationId, input.content, input.metadata ? JSON.stringify(input.metadata) : null, input.now);
      this.db.prepare(`INSERT INTO agent_conversation_turns
        (id, conversation_id, client_request_id, user_message_id, sequence, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`)
        .run(input.id, input.conversationId, input.clientRequestId, input.userMessageId, sequence, input.now, input.now);
      this.db.prepare(`UPDATE chat_conversations SET updated_at = ?, last_message_at = ? WHERE id = ?`)
        .run(input.now, input.now, input.conversationId);
      const row = this.db.prepare(`SELECT ${SELECT_COLUMNS} FROM agent_conversation_turns WHERE id = ?`).get(input.id) as TurnRow;
      return { turn: fromRow(row), created: true };
    }).immediate();
  }

  async claim(id: string, input: ClaimAgentConversationTurnInput): Promise<AgentConversationTurn | null> {
    const expiresAt = new Date(new Date(input.now).getTime() + input.leaseMs).toISOString();
    this.db.prepare(`UPDATE agent_conversation_turns
      SET status = 'running', lease_owner = ?, lease_expires_at = ?, updated_at = ?
      WHERE id = ? AND (status = 'queued' OR (status = 'running' AND lease_expires_at <= ?))`)
      .run(input.ownerId, expiresAt, input.now, id, input.now);
    return this.get(id);
  }

  async finish(id: string, input: { status: "succeeded" | "failed" | "cancelled"; now: string; runtimeSessionId?: string; error?: string }): Promise<AgentConversationTurn | null> {
    this.db.prepare(`UPDATE agent_conversation_turns
      SET status = ?, runtime_session_id = ?, error = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE id = ? AND status IN ('queued', 'running', 'waiting_approval')`)
      .run(input.status, input.runtimeSessionId ?? null, input.error ?? null, input.now, id);
    return this.get(id);
  }
}
