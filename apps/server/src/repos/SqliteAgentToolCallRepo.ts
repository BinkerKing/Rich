import type Database from "better-sqlite3";
import type { AgentToolCall, AgentToolCallRepo, AgentToolCallStatus, CreateAgentToolCallInput } from "./AgentToolCallRepo.js";

interface ToolCallRow {
  id: string;
  turn_id: string;
  runtime_call_id: string;
  name: string;
  arguments_json: string;
  arguments_digest: string;
  idempotency_key: string;
  status: string;
  result_json: string | null;
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
    arguments: JSON.parse(row.arguments_json) as Record<string, unknown>,
    argumentsDigest: row.arguments_digest,
    idempotencyKey: row.idempotency_key,
    status: row.status as AgentToolCallStatus,
    result: row.result_json === null ? undefined : JSON.parse(row.result_json) as unknown,
    error: row.error ?? undefined,
    approvalId: row.approval_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteAgentToolCallRepo implements AgentToolCallRepo {
  constructor(private readonly db: Database.Database) {}

  async get(id: string): Promise<AgentToolCall | null> {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM agent_tool_calls WHERE id = ?`).get(id) as ToolCallRow | undefined;
    return row ? fromRow(row) : null;
  }

  async listByTurn(turnId: string): Promise<AgentToolCall[]> {
    const rows = this.db.prepare(`SELECT ${COLUMNS} FROM agent_tool_calls WHERE turn_id = ? ORDER BY created_at, id`)
      .all(turnId) as ToolCallRow[];
    return rows.map(fromRow);
  }

  async createOrGet(input: CreateAgentToolCallInput): Promise<{ call: AgentToolCall; created: boolean }> {
    return this.db.transaction(() => {
      const existing = this.db.prepare(`SELECT ${COLUMNS} FROM agent_tool_calls
        WHERE turn_id = ? AND (runtime_call_id = ? OR idempotency_key = ?) LIMIT 1`)
        .get(input.turnId, input.runtimeCallId, input.idempotencyKey) as ToolCallRow | undefined;
      if (existing) {
        if (existing.name !== input.name || existing.arguments_digest !== input.argumentsDigest) {
          throw new Error("Tool call arguments do not match the stored runtime call");
        }
        return { call: fromRow(existing), created: false };
      }
      this.db.prepare(`INSERT INTO agent_tool_calls
        (id, turn_id, runtime_call_id, name, arguments_json, arguments_digest, idempotency_key, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)`)
        .run(input.id, input.turnId, input.runtimeCallId, input.name, JSON.stringify(input.arguments), input.argumentsDigest, input.idempotencyKey, input.now, input.now);
      const row = this.db.prepare(`SELECT ${COLUMNS} FROM agent_tool_calls WHERE id = ?`).get(input.id) as ToolCallRow;
      return { call: fromRow(row), created: true };
    }).immediate();
  }

  async update(id: string, input: { status: AgentToolCallStatus; now: string; result?: unknown; error?: string; approvalId?: string }): Promise<AgentToolCall> {
    this.db.prepare(`UPDATE agent_tool_calls SET status = ?, result_json = ?, error = ?, approval_id = ?, updated_at = ? WHERE id = ?`)
      .run(input.status, input.result === undefined ? null : JSON.stringify(input.result), input.error ?? null, input.approvalId ?? null, input.now, id);
    const call = await this.get(id);
    if (!call) throw new Error(`Agent tool call not found: ${id}`);
    return call;
  }
}
