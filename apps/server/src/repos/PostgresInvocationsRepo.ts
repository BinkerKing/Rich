import type { PgPool } from "../db/postgres.js";
import type { ToolInvocation, InvocationStatus } from "../tools/types.js";
import type { InvocationsStore } from "./InvocationsRepo.js";

type InvocationRow = {
  id: string;
  tool_name: string;
  args_json: string;
  status: string;
  created_by: string;
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
};

export class PostgresInvocationsRepo implements InvocationsStore {
  constructor(private pg: PgPool) {}

  private hydrate(row: InvocationRow): ToolInvocation {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(row.args_json); } catch { /* ignore */ }
    return {
      id: row.id,
      toolName: row.tool_name,
      args,
      status: row.status as InvocationStatus,
      createdBy: row.created_by === "user" ? "user" : "hermes",
      scheduledFor: row.scheduled_for ?? undefined,
      startedAt: row.started_at ?? undefined,
      finishedAt: row.finished_at ?? undefined,
      result: row.result ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at,
    };
  }

  async create(input: {
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    status: InvocationStatus;
    createdBy: "hermes" | "user";
    scheduledFor?: string;
  }): Promise<ToolInvocation> {
    await this.pg.ready;
    const now = new Date().toISOString();
    await this.pg.query(`
      INSERT INTO tool_invocations
        (id, tool_name, args_json, status, created_by, scheduled_for, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      input.id, input.toolName, JSON.stringify(input.args),
      input.status, input.createdBy, input.scheduledFor ?? null, now,
    ]);
    return (await this.get(input.id))!;
  }

  async get(id: string): Promise<ToolInvocation | null> {
    await this.pg.ready;
    const { rows } = await this.pg.query<InvocationRow>(
      "SELECT * FROM tool_invocations WHERE id = $1",
      [id],
    );
    return rows[0] ? this.hydrate(rows[0]) : null;
  }

  async list(filter?: { toolName?: string; status?: InvocationStatus; limit?: number }): Promise<ToolInvocation[]> {
    await this.pg.ready;
    const limit = filter?.limit ?? 200;
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.toolName) { params.push(filter.toolName); where.push(`tool_name = $${params.length}`); }
    if (filter?.status) { params.push(filter.status); where.push(`status = $${params.length}`); }
    params.push(limit);
    const { rows } = await this.pg.query<InvocationRow>(`
      SELECT * FROM tool_invocations
      ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC LIMIT $${params.length}
    `, params);
    return rows.map(r => this.hydrate(r));
  }

  async listScheduled(): Promise<ToolInvocation[]> {
    await this.pg.ready;
    const { rows } = await this.pg.query<InvocationRow>(
      "SELECT * FROM tool_invocations WHERE status = 'scheduled' ORDER BY scheduled_for ASC",
    );
    return rows.map(r => this.hydrate(r));
  }

  async markRunning(id: string): Promise<void> {
    await this.pg.ready;
    await this.pg.query("UPDATE tool_invocations SET status='running', started_at=$1 WHERE id=$2", [
      new Date().toISOString(), id,
    ]);
  }

  async markCompleted(id: string, result: string): Promise<void> {
    await this.pg.ready;
    await this.pg.query("UPDATE tool_invocations SET status='completed', finished_at=$1, result=$2 WHERE id=$3", [
      new Date().toISOString(), result, id,
    ]);
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.pg.ready;
    await this.pg.query("UPDATE tool_invocations SET status='failed', finished_at=$1, error=$2 WHERE id=$3", [
      new Date().toISOString(), error, id,
    ]);
  }

  async markCancelled(id: string): Promise<boolean> {
    await this.pg.ready;
    const { rows } = await this.pg.query<{ n: string }>(
      "WITH updated AS (UPDATE tool_invocations SET status='cancelled', finished_at=$1 WHERE id=$2 AND status='scheduled' RETURNING 1) SELECT COUNT(*)::text AS n FROM updated",
      [new Date().toISOString(), id],
    );
    return Number(rows[0]?.n ?? 0) > 0;
  }

  async countByStatus(): Promise<Record<string, number>> {
    await this.pg.ready;
    const { rows } = await this.pg.query<{ status: string; n: string }>(
      "SELECT status, COUNT(*)::text AS n FROM tool_invocations GROUP BY status",
    );
    const out: Record<string, number> = {
      scheduled: 0, running: 0, completed: 0, failed: 0, cancelled: 0,
    };
    for (const r of rows) out[r.status] = Number(r.n);
    return out;
  }
}
