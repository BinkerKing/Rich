import type { PgPool } from "../db/postgres.js";
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

export class PostgresAgentConversationTurnRepo implements AgentConversationTurnRepo {
  constructor(private readonly pool: PgPool) {}

  async get(id: string): Promise<AgentConversationTurn | null> {
    const { rows } = await this.pool.query<TurnRow>(`SELECT ${SELECT_COLUMNS} FROM agent_conversation_turns WHERE id = $1`, [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async getByClientRequest(conversationId: string, clientRequestId: string): Promise<AgentConversationTurn | null> {
    const { rows } = await this.pool.query<TurnRow>(`SELECT ${SELECT_COLUMNS} FROM agent_conversation_turns WHERE conversation_id = $1 AND client_request_id = $2`, [conversationId, clientRequestId]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async createOrGet(input: CreateAgentConversationTurnInput): Promise<{ turn: AgentConversationTurn; created: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.conversationId]);
      const retry = await client.query<TurnRow>(`SELECT ${SELECT_COLUMNS} FROM agent_conversation_turns WHERE conversation_id = $1 AND client_request_id = $2`, [input.conversationId, input.clientRequestId]);
      if (retry.rows[0]) {
        await client.query("COMMIT");
        return { turn: fromRow(retry.rows[0]), created: false };
      }
      const active = await client.query<TurnRow>(`SELECT ${SELECT_COLUMNS} FROM agent_conversation_turns WHERE conversation_id = $1 AND status IN ('queued', 'running', 'waiting_approval') LIMIT 1 FOR UPDATE`, [input.conversationId]);
      if (active.rows[0]) {
        const row = active.rows[0];
        const expired = row.status === "running" && row.lease_expires_at !== null && row.lease_expires_at <= input.now;
        if (!expired) throw new Error("Agent conversation turn already running");
        await client.query(`UPDATE agent_conversation_turns SET status = 'failed', error = 'turn lease expired', lease_owner = NULL, lease_expires_at = NULL, updated_at = $1 WHERE id = $2`, [input.now, row.id]);
      }
      const inserted = await client.query<TurnRow>(`INSERT INTO agent_conversation_turns
        (id, conversation_id, client_request_id, user_message_id, sequence, status, created_at, updated_at)
        SELECT $1, $2, $3, $4, COALESCE(MAX(sequence), 0) + 1, 'queued', $5, $5
          FROM agent_conversation_turns WHERE conversation_id = $2
        RETURNING ${SELECT_COLUMNS}`,
      [input.id, input.conversationId, input.clientRequestId, input.userMessageId, input.now]);
      await client.query("COMMIT");
      return { turn: fromRow(inserted.rows[0]), created: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async claim(id: string, input: ClaimAgentConversationTurnInput): Promise<AgentConversationTurn | null> {
    const expiresAt = new Date(new Date(input.now).getTime() + input.leaseMs).toISOString();
    const { rows } = await this.pool.query<TurnRow>(`UPDATE agent_conversation_turns
      SET status = 'running', lease_owner = $1, lease_expires_at = $2, updated_at = $3
      WHERE id = $4 AND (status = 'queued' OR (status = 'running' AND lease_expires_at <= $3))
      RETURNING ${SELECT_COLUMNS}`, [input.ownerId, expiresAt, input.now, id]);
    return rows[0] ? fromRow(rows[0]) : this.get(id);
  }

  async finish(id: string, input: { status: "succeeded" | "failed" | "cancelled"; now: string; runtimeSessionId?: string; error?: string }): Promise<AgentConversationTurn | null> {
    const { rows } = await this.pool.query<TurnRow>(`UPDATE agent_conversation_turns
      SET status = $1, runtime_session_id = $2, error = $3, lease_owner = NULL, lease_expires_at = NULL, updated_at = $4
      WHERE id = $5 AND status IN ('queued', 'running', 'waiting_approval')
      RETURNING ${SELECT_COLUMNS}`, [input.status, input.runtimeSessionId ?? null, input.error ?? null, input.now, id]);
    return rows[0] ? fromRow(rows[0]) : this.get(id);
  }
}
