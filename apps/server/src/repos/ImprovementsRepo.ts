import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * System-improvement task board — captures capability gaps that Hermes
 * hits while trying to fulfill the user's requests, tracks the dev cycle,
 * and lets Hermes verify the fix when it's announced as ready.
 *
 * Status machine:
 *   pending          — Hermes (or the user) filed a gap; no fix yet
 *   ready_to_verify  — Developer says "I shipped the fix"; Hermes should test
 *   verified         — Hermes confirmed the fix works
 *   rejected         — Hermes tested but it still doesn't work; back to dev
 *
 * Transitions are not strictly enforced server-side — both Hermes and the
 * UI may flip status freely. The audit trail in verifications_json captures
 * what actually happened.
 */

export type ImprovementStatus =
  | "pending"
  | "ready_to_verify"
  | "verified"
  | "rejected";

export type ImprovementPriority = "low" | "medium" | "high";

export interface VerificationEntry {
  ts: string;
  result: "pass" | "fail";
  notes?: string;
}

export interface ImprovementTask {
  id: string;
  title: string;
  description: string;
  reason: string;
  status: ImprovementStatus;
  priority?: ImprovementPriority;
  category?: string;
  createdBy: "hermes" | "user";
  relatedFiles?: string[];
  verifications: VerificationEntry[];
  requestedAt: string;
  updatedAt: string;
}

export interface CreateImprovementInput {
  title: string;
  description?: string;
  reason?: string;
  priority?: ImprovementPriority;
  category?: string;
  createdBy?: "hermes" | "user";
  relatedFiles?: string[];
}

export interface UpdateImprovementInput {
  title?: string;
  description?: string;
  reason?: string;
  status?: ImprovementStatus;
  priority?: ImprovementPriority | null;
  category?: string | null;
  relatedFiles?: string[] | null;
  /** If provided AND status is being set to "verified" or "rejected",
   *  appends an audit entry to verifications. */
  verificationNotes?: string;
}

type MaybePromise<T> = T | Promise<T>;

export interface ImprovementsStore {
  list(filter?: { status?: ImprovementStatus; limit?: number }): MaybePromise<ImprovementTask[]>;
  get(id: string): MaybePromise<ImprovementTask | null>;
  create(input: CreateImprovementInput): MaybePromise<ImprovementTask>;
  update(id: string, patch: UpdateImprovementInput): MaybePromise<ImprovementTask | null>;
  remove(id: string): MaybePromise<boolean>;
  countByStatus(): MaybePromise<Record<string, number>>;
}

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

export class ImprovementsRepo implements ImprovementsStore {
  constructor(private db: Database.Database) {}

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
      createdBy: (row.created_by === "user" ? "user" : "hermes"),
      relatedFiles,
      verifications,
      requestedAt: row.requested_at,
      updatedAt: row.updated_at,
    };
  }

  list(filter?: { status?: ImprovementStatus; limit?: number }): ImprovementTask[] {
    const limit = filter?.limit ?? 200;
    const status = filter?.status;
    const rows = status
      ? this.db.prepare(
          "SELECT * FROM improvement_tasks WHERE status = ? ORDER BY updated_at DESC LIMIT ?",
        ).all(status, limit) as Row[]
      : this.db.prepare(
          "SELECT * FROM improvement_tasks ORDER BY updated_at DESC LIMIT ?",
        ).all(limit) as Row[];
    return rows.map(r => this.hydrate(r));
  }

  get(id: string): ImprovementTask | null {
    const row = this.db.prepare("SELECT * FROM improvement_tasks WHERE id = ?").get(id) as Row | undefined;
    return row ? this.hydrate(row) : null;
  }

  create(input: CreateImprovementInput): ImprovementTask {
    const id = `imp-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO improvement_tasks
        (id, title, description, reason, status, priority, category,
         created_by, related_files, verifications_json, requested_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, '[]', ?, ?)
    `).run(
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
    );
    return this.get(id)!;
  }

  update(id: string, patch: UpdateImprovementInput): ImprovementTask | null {
    const existing = this.get(id);
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
    // Audit: any status transition to verified / rejected captures a verification line.
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
    this.db.prepare(`
      UPDATE improvement_tasks
      SET title=?, description=?, reason=?, status=?, priority=?, category=?,
          related_files=?, verifications_json=?, updated_at=?
      WHERE id=?
    `).run(
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
    );
    return next;
  }

  remove(id: string): boolean {
    const result = this.db.prepare("DELETE FROM improvement_tasks WHERE id = ?").run(id);
    return result.changes > 0;
  }

  countByStatus(): Record<string, number> {
    const rows = this.db.prepare(
      "SELECT status, COUNT(*) AS n FROM improvement_tasks GROUP BY status",
    ).all() as Array<{ status: string; n: number }>;
    const out: Record<string, number> = { pending: 0, ready_to_verify: 0, verified: 0, rejected: 0 };
    for (const r of rows) out[r.status] = r.n;
    return out;
  }
}
