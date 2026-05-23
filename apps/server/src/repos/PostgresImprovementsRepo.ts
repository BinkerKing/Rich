import { randomUUID } from "node:crypto";
import type { PgPool } from "../db/postgres.js";
import type {
  CreateImprovementInput,
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
  status: string;
  priority: string | null;
  category: string | null;
  created_by: string;
  related_files: string | null;
  verifications_json: string;
  requested_at: string;
  updated_at: string;
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
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      reason: row.reason,
      status: row.status as ImprovementStatus,
      priority: row.priority as ImprovementPriority | undefined ?? undefined,
      category: row.category ?? undefined,
      createdBy: row.created_by === "user" ? "user" : "hermes",
      relatedFiles,
      verifications,
      requestedAt: row.requested_at,
      updatedAt: row.updated_at,
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
         created_by, related_files, verifications_json, requested_at, updated_at)
      VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, '[]', $9, $10)
    `, [
      id,
      input.title,
      input.description ?? "",
      input.reason ?? "",
      input.priority ?? null,
      input.category ?? null,
      input.createdBy ?? "hermes",
      input.relatedFiles ? JSON.stringify(input.relatedFiles) : null,
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
          related_files=$7, verifications_json=$8, updated_at=$9
      WHERE id=$10
    `, [
      next.title,
      next.description,
      next.reason,
      next.status,
      next.priority ?? null,
      next.category ?? null,
      next.relatedFiles ? JSON.stringify(next.relatedFiles) : null,
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
    const out: Record<string, number> = { pending: 0, ready_to_verify: 0, verified: 0, rejected: 0 };
    for (const r of rows) out[r.status] = Number(r.n);
    return out;
  }
}
