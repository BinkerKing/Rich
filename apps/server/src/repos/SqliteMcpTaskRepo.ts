import type Database from "better-sqlite3";
import type { McpTask, McpTaskListOptions, McpTaskRepo, McpTaskStatus } from "./McpTaskRepo.js";

interface TaskRow {
  id: string; type: string; title: string; request_json: string; status: McpTaskStatus;
  backend: string | null; external_task_id: string | null; progress_summary: string | null;
  result_refs_json: string; error: string | null; conversation_id: string | null; request_id: string | null;
  review_status: McpTask["reviewStatus"] | null; review_notes: string | null;
  created_at: string; started_at: string | null; updated_at: string; finished_at: string | null; last_synced_at: string | null;
}

const COLUMNS = `id, type, title, request_json, status, backend, external_task_id, progress_summary,
  result_refs_json, error, conversation_id, request_id, review_status, review_notes,
  created_at, started_at, updated_at, finished_at, last_synced_at`;

export class SqliteMcpTaskRepo implements McpTaskRepo {
  constructor(private readonly db: Database.Database) {}

  create(task: McpTask): void {
    this.db.prepare(`INSERT INTO mcp_tasks (${COLUMNS}) VALUES (${Array(19).fill("?").join(", ")})`).run(...values(task));
  }

  get(id: string): McpTask | null {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM mcp_tasks WHERE id = ?`).get(id) as TaskRow | undefined;
    return row ? hydrate(row) : null;
  }

  list(options: McpTaskListOptions = {}): McpTask[] {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const rows = options.status
      ? this.db.prepare(`SELECT ${COLUMNS} FROM mcp_tasks WHERE status = ? ORDER BY updated_at DESC LIMIT ?`).all(options.status, limit)
      : this.db.prepare(`SELECT ${COLUMNS} FROM mcp_tasks ORDER BY updated_at DESC LIMIT ?`).all(limit);
    return (rows as TaskRow[]).map(hydrate);
  }

  count(options: Pick<McpTaskListOptions, "status"> = {}): number {
    const row = options.status
      ? this.db.prepare("SELECT COUNT(*) AS count FROM mcp_tasks WHERE status = ?").get(options.status)
      : this.db.prepare("SELECT COUNT(*) AS count FROM mcp_tasks").get();
    return Number((row as { count: number }).count);
  }

  save(task: McpTask): void {
    const result = this.db.prepare(`UPDATE mcp_tasks SET
      type = ?, title = ?, request_json = ?, status = ?, backend = ?, external_task_id = ?, progress_summary = ?,
      result_refs_json = ?, error = ?, conversation_id = ?, request_id = ?, review_status = ?, review_notes = ?,
      created_at = ?, started_at = ?, updated_at = ?, finished_at = ?, last_synced_at = ? WHERE id = ?`
    ).run(...values(task).slice(1), task.id);
    if (result.changes !== 1) throw new Error(`MCP task ${task.id} was not found.`);
  }
}

function values(task: McpTask): unknown[] {
  return [task.id, task.type, task.title, JSON.stringify(task.request), task.status, task.backend ?? null,
    task.externalTaskId ?? null, task.progressSummary ?? null, JSON.stringify(task.resultRefs), task.error ?? null,
    task.conversationId ?? null, task.requestId ?? null, task.reviewStatus ?? null, task.reviewNotes ?? null,
    task.createdAt, task.startedAt ?? null, task.updatedAt, task.finishedAt ?? null, task.lastSyncedAt ?? null];
}

function hydrate(row: TaskRow): McpTask {
  return {
    id: row.id, type: row.type, title: row.title, request: JSON.parse(row.request_json), status: row.status,
    ...(row.backend ? { backend: row.backend } : {}),
    ...(row.external_task_id ? { externalTaskId: row.external_task_id } : {}),
    ...(row.progress_summary ? { progressSummary: row.progress_summary } : {}),
    resultRefs: JSON.parse(row.result_refs_json),
    ...(row.error ? { error: row.error } : {}),
    ...(row.conversation_id ? { conversationId: row.conversation_id } : {}),
    ...(row.request_id ? { requestId: row.request_id } : {}),
    ...(row.review_status ? { reviewStatus: row.review_status } : {}),
    ...(row.review_notes ? { reviewNotes: row.review_notes } : {}),
    createdAt: row.created_at,
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    updatedAt: row.updated_at,
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
    ...(row.last_synced_at ? { lastSyncedAt: row.last_synced_at } : {}),
  };
}
