import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * System-improvement task board — captures capability gaps that Hermes
 * hits while trying to fulfill the user's requests, tracks the dev cycle,
 * and lets Hermes verify the fix when it's announced as ready.
 *
 * Status machine:
 *   pending          — Hermes (or the user) filed a gap; no fix yet
 *   ready_to_develop — PRD/tasks reviewed; an agent may claim and implement it
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
  | "ready_to_develop"
  | "ready_to_verify"
  | "verified"
  | "rejected";

export type ImprovementPriority = "low" | "medium" | "high";

export interface VerificationEntry {
  ts: string;
  result: "pass" | "fail";
  notes?: string;
}

export interface ImprovementDevTask {
  id: string;
  title: string;
  detail?: string;
  status?: "todo" | "doing" | "done" | "blocked";
  priority?: ImprovementPriority;
}

export interface ImprovementTask {
  id: string;
  title: string;
  description: string;
  reason: string;
  prdContent: string;
  tasks: ImprovementDevTask[];
  status: ImprovementStatus;
  priority?: ImprovementPriority;
  category?: string;
  createdBy: "hermes" | "user";
  relatedFiles?: string[];
  verifications: VerificationEntry[];
  requestedAt: string;
  updatedAt: string;
  /** 哪个 agent 抢到了这条任务（null/undefined = 未认领，谁先 claim 谁拿走）。 */
  assignedAgentId?: string;
  /** ISO 时间戳，认领发生的时刻；释放时清空。 */
  assignedAt?: string;
}

/** 认领结果。ok=true 时给出新版 task；ok=false 时返回当前占用者，供客户端报错文案使用。 */
export type ClaimResult =
  | { ok: true; task: ImprovementTask }
  | { ok: false; conflict: { currentAgentId: string; assignedAt: string } };

export interface CreateImprovementInput {
  title: string;
  description?: string;
  reason?: string;
  priority?: ImprovementPriority;
  category?: string;
  createdBy?: "hermes" | "user";
  relatedFiles?: string[];
  prdContent?: string;
  tasks?: ImprovementDevTask[];
}

export interface UpdateImprovementInput {
  title?: string;
  description?: string;
  reason?: string;
  status?: ImprovementStatus;
  priority?: ImprovementPriority | null;
  category?: string | null;
  relatedFiles?: string[] | null;
  prdContent?: string;
  tasks?: ImprovementDevTask[] | null;
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
  /**
   * 原子地把任务认领给指定 agent。当前未认领（或被同一个 agent 重复认领）→ 成功。
   * 已被别人认领 → 返回 conflict，调用方应跳过。
   */
  claim(id: string, agentId: string): MaybePromise<ClaimResult>;
  /**
   * 释放认领。agentId 为 null = 强制释放（admin UI 用，不校验归属）。
   * 任务不存在返 null。
   */
  release(id: string, agentId: string | null): MaybePromise<ImprovementTask | null>;
}

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
      createdBy: (row.created_by === "user" ? "user" : "hermes"),
      relatedFiles,
      verifications,
      requestedAt: row.requested_at,
      updatedAt: row.updated_at,
      assignedAgentId: row.assigned_agent_id ?? undefined,
      assignedAt: row.assigned_at ?? undefined,
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
         created_by, related_files, prd_content, tasks_json, verifications_json, requested_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, '[]', ?, ?)
    `).run(
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
    if (patch.prdContent !== undefined) next.prdContent = patch.prdContent;
    if (patch.tasks !== undefined) next.tasks = patch.tasks ?? [];
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
          related_files=?, prd_content=?, tasks_json=?, verifications_json=?, updated_at=?
      WHERE id=?
    `).run(
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
    const out: Record<string, number> = { pending: 0, ready_to_develop: 0, ready_to_verify: 0, verified: 0, rejected: 0 };
    for (const r of rows) out[r.status] = r.n;
    return out;
  }

  claim(id: string, agentId: string): ClaimResult {
    // 原子写：仅在 assigned_agent_id 为空（未认领）或已是同一 agent（重入幂等）时 UPDATE。
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE improvement_tasks
      SET assigned_agent_id = ?, assigned_at = ?, updated_at = ?
      WHERE id = ?
        AND (assigned_agent_id IS NULL OR assigned_agent_id = ?)
    `).run(agentId, now, now, id, agentId);
    if (result.changes > 0) {
      const task = this.get(id);
      if (task) return { ok: true, task };
    }
    // 没抢到。查一下当前是谁占着，返回 conflict 信息。
    const row = this.db.prepare(
      "SELECT assigned_agent_id, assigned_at FROM improvement_tasks WHERE id = ?",
    ).get(id) as { assigned_agent_id: string | null; assigned_at: string | null } | undefined;
    return {
      ok: false,
      conflict: {
        currentAgentId: row?.assigned_agent_id ?? "(unknown)",
        assignedAt: row?.assigned_at ?? "",
      },
    };
  }

  release(id: string, agentId: string | null): ImprovementTask | null {
    const now = new Date().toISOString();
    // agentId == null = 强制释放（admin UI 用，不校验归属）；否则只释放自己持有的。
    if (agentId === null) {
      this.db.prepare(`
        UPDATE improvement_tasks
        SET assigned_agent_id = NULL, assigned_at = NULL, updated_at = ?
        WHERE id = ?
      `).run(now, id);
    } else {
      this.db.prepare(`
        UPDATE improvement_tasks
        SET assigned_agent_id = NULL, assigned_at = NULL, updated_at = ?
        WHERE id = ? AND assigned_agent_id = ?
      `).run(now, id, agentId);
    }
    return this.get(id);
  }
}
