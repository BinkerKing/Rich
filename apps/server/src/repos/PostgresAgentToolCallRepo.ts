import type { PgPool } from "../db/postgres.js";
import type { AgentToolCall, AgentToolCallRepo, AgentToolCallStatus, CreateAgentToolCallInput } from "./AgentToolCallRepo.js";

interface ToolCallRow {
  id: string;
  turn_id: string;
  runtime_call_id: string;
  name: string;
  arguments_json: Record<string, unknown>;
  arguments_digest: string;
  idempotency_key: string;
  status: string;
  result_json: unknown | null;
  error: string | null;
  approval_id: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = `id, turn_id, runtime_call_id, name, arguments_json, arguments_digest,
  idempotency_key, status, result_json, error, approval_id, created_at, updated_at`;

function fromRow(row: ToolCallRow): AgentToolCall {
  return {
    id: row.id,
    turnId: row.turn_id,
    runtimeCallId: row.runtime_call_id,
    name: row.name,
    arguments: row.arguments_json,
    argumentsDigest: row.arguments_digest,
    idempotencyKey: row.idempotency_key,
    status: row.status as AgentToolCallStatus,
    result: row.result_json ?? undefined,
    error: row.error ?? undefined,
    approvalId: row.approval_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresAgentToolCallRepo implements AgentToolCallRepo {
  constructor(private readonly pool: PgPool) {}

  async get(id: string): Promise<AgentToolCall | null> {
    const { rows } = await this.pool.query<ToolCallRow>(`SELECT ${COLUMNS} FROM agent_tool_calls WHERE id = $1`, [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async createOrGet(input: CreateAgentToolCallInput): Promise<{ call: AgentToolCall; created: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.turnId]);
      const existing = await client.query<ToolCallRow>(`SELECT ${COLUMNS} FROM agent_tool_calls
        WHERE turn_id = $1 AND (runtime_call_id = $2 OR idempotency_key = $3) LIMIT 1`, [input.turnId, input.runtimeCallId, input.idempotencyKey]);
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (row.name !== input.name || row.arguments_digest !== input.argumentsDigest) {
          throw new Error("Tool call arguments do not match the stored runtime call");
        }
        await client.query("COMMIT");
        return { call: fromRow(row), created: false };
      }
      const inserted = await client.query<ToolCallRow>(`INSERT INTO agent_tool_calls
        (id, turn_id, runtime_call_id, name, arguments_json, arguments_digest, idempotency_key, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 'requested', $8, $8)
        RETURNING ${COLUMNS}`, [input.id, input.turnId, input.runtimeCallId, input.name, JSON.stringify(input.arguments), input.argumentsDigest, input.idempotencyKey, input.now]);
      await client.query("COMMIT");
      return { call: fromRow(inserted.rows[0]), created: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, input: { status: AgentToolCallStatus; now: string; result?: unknown; error?: string; approvalId?: string }): Promise<AgentToolCall> {
    const { rows } = await this.pool.query<ToolCallRow>(`UPDATE agent_tool_calls
      SET status = $1, result_json = $2::jsonb, error = $3, approval_id = $4, updated_at = $5
      WHERE id = $6 RETURNING ${COLUMNS}`, [
      input.status,
      input.result === undefined ? null : JSON.stringify(input.result),
      input.error ?? null,
      input.approvalId ?? null,
      input.now,
      id,
    ]);
    if (!rows[0]) throw new Error(`Agent tool call not found: ${id}`);
    return fromRow(rows[0]);
  }
}
