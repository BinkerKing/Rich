import { randomUUID } from "node:crypto";
import type { PgPool } from "../db/postgres.js";
import type {
  ClaimResult,
  CreateImprovementInput,
  ImprovementDevTask,
  ImprovementPriority,
  ImprovementStatus,
  ImprovementTask,
  ImprovementsStore,
  UpdateImprovementInput,
  VerificationEntry,
} from "./ImprovementsRepo.js";

interface Row {
  id: string;
  title: string;
  description: string;
  reason: string;
  prd_content: string;
  tasks_json: string;
  status: string;
  priority: string | null;
  category: string | null;
  created_by: string;
  related_files: string | null;
  verifications_json: string;
  requested_at: string;
  updated_at: string;
  assigned_agent_id: string | null;
  assigned_at: string | null;
}

export class PostgresImprovementsRepo implements ImprovementsStore {
  constructor(private pg: PgPool) {}

  private hydrate(row: Row): ImprovementTask {
    let verifications: VerificationEntry[] = [];
    try { verifications = JSON.parse(row.verifications_json) as VerificationEntry[]; }
    catch { verifications = []; }
    let relatedFiles: string[] | undefined;
    if (row.related_files) {
      try {
        const parsed = JSON.parse(row.related_files);
        if (Array.isArray(parsed)) relatedFiles = parsed.filter((x: unknown) => typeof x === "string");
      } catch { /* ignore */ }
    }
    let tasks: ImprovementDevTask[] = [];
    try {
      const parsed = JSON.parse(row.tasks_json || "[]");
      if (Array.isArray(parsed)) {
        tasks = parsed
          .filter((x: unknown): x is ImprovementDevTask => Boolean(x) && typeof x === "object" && typeof (x as ImprovementDevTask).title === "string")
          .map((x, index) => ({
            id: typeof x.id === "string" && x.id ? x.id : `task-${index + 1}`,
            title: x.title,
            detail: typeof x.detail === "string" ? x.detail : undefined,
            status: x.status,
            priority: x.priority,
          }));
      }
    } catch { tasks = []; }
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      reason: row.reason,
      prdContent: row.prd_content ?? "",
      tasks,
      status: row.status as ImprovementStatus,
      priority: row.priority as ImprovementPriority | undefined ?? undefined,
      category: row.category ?? undefined,
      createdBy: row.created_by === "user" ? "user" : "hermes",
      relatedFiles,
      verifications,
      requestedAt: row.requested_at,
      updatedAt: row.updated_at,
      assignedAgentId: row.assigned_agent_id ?? undefined,
      assignedAt: row.assigned_at ?? undefined,
    };
  }

  async list(filter?: { status?: ImprovementStatus; limit?: number }): Promise<ImprovementTask[]> {
    await this.pg.ready;
    const limit = filter?.limit ?? 200;
    if (filter?.status) {
      const { rows } = await this.pg.query<Row>(
        "SELECT * FROM improvement_tasks WHERE status = $1 ORDER BY updated_at DESC LIMIT $2",
        [filter.status, limit],
      );
      return rows.map(r => this.hydrate(r));
    }
    const { rows } = await this.pg.query<Row>(
      "SELECT * FROM improvement_tasks ORDER BY updated_at DESC LIMIT $1",
      [limit],
    );
    return rows.map(r => this.hydrate(r));
  }

  async get(id: string): Promise<ImprovementTask | null> {
    await this.pg.ready;
    const { rows } = await this.pg.query<Row>("SELECT * FROM improvement_tasks WHERE id = $1", [id]);
    return rows[0] ? this.hydrate(rows[0]) : null;
  }

  async create(input: CreateImprovementInput): Promise<ImprovementTask> {
    await this.pg.ready;
    const id = `imp-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    await this.pg.query(`
      INSERT INTO improvement_tasks
        (id, title, description, reason, status, priority, category,
         created_by, related_files, prd_content, tasks_json, verifications_json, requested_at, updated_at)
      VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10, '[]', $11, $12)
    `, [
      id,
      input.title,
      input.description ?? "",
      input.reason ?? "",
      input.priority ?? null,
      input.category ?? null,
      input.createdBy ?? "hermes",
      input.relatedFiles ? JSON.stringify(input.relatedFiles) : null,
      input.prdContent ?? "",
      JSON.stringify(input.tasks ?? []),
      now,
      now,
    ]);
    return (await this.get(id))!;
  }

  async update(id: string, patch: UpdateImprovementInput): Promise<ImprovementTask | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const next: ImprovementTask = { ...existing };
    if (patch.title !== undefined) next.title = patch.title;
    if (patch.description !== undefined) next.description = patch.description;
    if (patch.reason !== undefined) next.reason = patch.reason;
    if (patch.status !== undefined) next.status = patch.status;
    if (patch.prdContent !== undefined) next.prdContent = patch.prdContent;
    if (patch.tasks !== undefined) next.tasks = patch.tasks ?? [];
    if (patch.priority !== undefined) next.priority = patch.priority ?? undefined;
    if (patch.category !== undefined) next.category = patch.category ?? undefined;
    if (patch.relatedFiles !== undefined) next.relatedFiles = patch.relatedFiles ?? undefined;
    if ((patch.status === "verified" || patch.status === "rejected") && existing.status !== patch.status) {
      next.verifications = [
        ...next.verifications,
        {
          ts: now,
          result: patch.status === "verified" ? "pass" : "fail",
          notes: patch.verificationNotes,
        },
      ];
    }
    next.updatedAt = now;
    await this.pg.query(`
      UPDATE improvement_tasks
      SET title=$1, description=$2, reason=$3, status=$4, priority=$5, category=$6,
          related_files=$7, prd_content=$8, tasks_json=$9, verifications_json=$10, updated_at=$11
      WHERE id=$12
    `, [
      next.title,
      next.description,
      next.reason,
      next.status,
      next.priority ?? null,
      next.category ?? null,
      next.relatedFiles ? JSON.stringify(next.relatedFiles) : null,
      next.prdContent,
      JSON.stringify(next.tasks),
      JSON.stringify(next.verifications),
      next.updatedAt,
      id,
    ]);
    return next;
  }

  async remove(id: string): Promise<boolean> {
    await this.pg.ready;
    const result = await this.pg.query("DELETE FROM improvement_tasks WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async countByStatus(): Promise<Record<string, number>> {
    await this.pg.ready;
    const { rows } = await this.pg.query<{ status: string; n: string }>(
      "SELECT status, COUNT(*)::text AS n FROM improvement_tasks GROUP BY status",
    );
    const out: Record<string, number> = { pending: 0, ready_to_develop: 0, ready_to_verify: 0, verified: 0, rejected: 0 };
    for (const r of rows) out[r.status] = Number(r.n);
    return out;
  }

  async claim(id: string, agentId: string): Promise<ClaimResult> {
    await this.pg.ready;
    // 原子 UPDATE：仅在未认领或已是同一 agent（重入幂等）时改。RETURNING 让我们一次回拿数据。
    const now = new Date().toISOString();
    const { rows } = await this.pg.query<Row>(`
      UPDATE improvement_tasks
      SET assigned_agent_id = $1, assigned_at = $2, updated_at = $3
      WHERE id = $4
        AND (assigned_agent_id IS NULL OR assigned_agent_id = $1)
      RETURNING *
    `, [agentId, now, now, id]);
    if (rows.length > 0) {
      return { ok: true, task: this.hydrate(rows[0]) };
    }
    // 没改到行 = 任务被别人占着。查一下是谁。
    const { rows: peek } = await this.pg.query<{ assigned_agent_id: string | null; assigned_at: string | null }>(
      "SELECT assigned_agent_id, assigned_at FROM improvement_tasks WHERE id = $1",
      [id],
    );
    return {
      ok: false,
      conflict: {
        currentAgentId: peek[0]?.assigned_agent_id ?? "(unknown)",
        assignedAt: peek[0]?.assigned_at ?? "",
      },
    };
  }

  async release(id: string, agentId: string | null): Promise<ImprovementTask | null> {
    await this.pg.ready;
    const now = new Date().toISOString();
    if (agentId === null) {
      // 强制释放（admin UI 用）
      await this.pg.query(`
        UPDATE improvement_tasks
        SET assigned_agent_id = NULL, assigned_at = NULL, updated_at = $1
        WHERE id = $2
      `, [now, id]);
    } else {
      // 校验归属：只释放自己持有的
      await this.pg.query(`
        UPDATE improvement_tasks
        SET assigned_agent_id = NULL, assigned_at = NULL, updated_at = $1
        WHERE id = $2 AND assigned_agent_id = $3
      `, [now, id, agentId]);
    }
    return this.get(id);
  }
}
