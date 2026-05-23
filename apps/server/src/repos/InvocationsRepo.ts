import type Database from "better-sqlite3";
import type { ToolInvocation, InvocationStatus } from "../tools/types.js";

type MaybePromise<T> = T | Promise<T>;

export interface InvocationsStore {
  create(input: {
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    status: InvocationStatus;
    createdBy: "hermes" | "user";
    scheduledFor?: string;
  }): MaybePromise<ToolInvocation>;
  get(id: string): MaybePromise<ToolInvocation | null>;
  list(filter?: { toolName?: string; status?: InvocationStatus; limit?: number }): MaybePromise<ToolInvocation[]>;
  listScheduled(): MaybePromise<ToolInvocation[]>;
  markRunning(id: string): MaybePromise<void>;
  markCompleted(id: string, result: string): MaybePromise<void>;
  markFailed(id: string, error: string): MaybePromise<void>;
  markCancelled(id: string): MaybePromise<boolean>;
  countByStatus(): MaybePromise<Record<string, number>>;
}

/**
 * Storage for Toolbox tool invocations. One row per invocation; status
 * transitions are updates on the same row (not append-only events) — we
 * don't need a full event log here, just the current state + final result.
 */
export class InvocationsRepo implements InvocationsStore {
  constructor(private db: Database.Database) {}

  private hydrate(row: {
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
  }): ToolInvocation {
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

  create(input: {
    id: string;
    toolName: string;
    args: Record<string, unknown>;
    status: InvocationStatus;
    createdBy: "hermes" | "user";
    scheduledFor?: string;
  }): ToolInvocation {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO tool_invocations
        (id, tool_name, args_json, status, created_by, scheduled_for, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.toolName, JSON.stringify(input.args),
      input.status, input.createdBy, input.scheduledFor ?? null, now,
    );
    return this.get(input.id)!;
  }

  get(id: string): ToolInvocation | null {
    const row = this.db.prepare("SELECT * FROM tool_invocations WHERE id = ?").get(id) as
      | Parameters<InvocationsRepo["hydrate"]>[0] | undefined;
    return row ? this.hydrate(row) : null;
  }

  list(filter?: { toolName?: string; status?: InvocationStatus; limit?: number }): ToolInvocation[] {
    const limit = filter?.limit ?? 200;
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.toolName) { where.push("tool_name = ?"); params.push(filter.toolName); }
    if (filter?.status)   { where.push("status = ?");    params.push(filter.status); }
    const sql = `
      SELECT * FROM tool_invocations
      ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC LIMIT ?
    `;
    params.push(limit);
    const rows = this.db.prepare(sql).all(...params) as Array<Parameters<InvocationsRepo["hydrate"]>[0]>;
    return rows.map(r => this.hydrate(r));
  }

  /** Pending-only query — used at server boot to re-schedule deferred runs. */
  listScheduled(): ToolInvocation[] {
    const rows = this.db.prepare(
      "SELECT * FROM tool_invocations WHERE status = 'scheduled' ORDER BY scheduled_for ASC",
    ).all() as Array<Parameters<InvocationsRepo["hydrate"]>[0]>;
    return rows.map(r => this.hydrate(r));
  }

  markRunning(id: string): void {
    this.db.prepare("UPDATE tool_invocations SET status='running', started_at=? WHERE id=?")
      .run(new Date().toISOString(), id);
  }

  markCompleted(id: string, result: string): void {
    this.db.prepare(
      "UPDATE tool_invocations SET status='completed', finished_at=?, result=? WHERE id=?",
    ).run(new Date().toISOString(), result, id);
  }

  markFailed(id: string, error: string): void {
    this.db.prepare(
      "UPDATE tool_invocations SET status='failed', finished_at=?, error=? WHERE id=?",
    ).run(new Date().toISOString(), error, id);
  }

  markCancelled(id: string): boolean {
    const r = this.db.prepare(
      "UPDATE tool_invocations SET status='cancelled', finished_at=? WHERE id=? AND status='scheduled'",
    ).run(new Date().toISOString(), id);
    return r.changes > 0;
  }

  countByStatus(): Record<string, number> {
    const rows = this.db.prepare(
      "SELECT status, COUNT(*) AS n FROM tool_invocations GROUP BY status",
    ).all() as Array<{ status: string; n: number }>;
    const out: Record<string, number> = {
      scheduled: 0, running: 0, completed: 0, failed: 0, cancelled: 0,
    };
    for (const r of rows) out[r.status] = r.n;
    return out;
  }
}
