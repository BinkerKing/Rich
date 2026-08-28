import type { PgPool } from "../db/postgres.js";
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

export class PostgresMcpTaskRepo implements McpTaskRepo {
  constructor(private readonly pg: PgPool) {}

  async create(task: McpTask): Promise<void> {
    await this.pg.ready;
    await this.pg.query(`INSERT INTO mcp_tasks (${COLUMNS}) VALUES (${Array.from({ length: 19 }, (_, i) => `$${i + 1}`).join(", ")})`, values(task));
  }

  async get(id: string): Promise<McpTask | null> {
    await this.pg.ready;
    const { rows } = await this.pg.query<TaskRow>(`SELECT ${COLUMNS} FROM mcp_tasks WHERE id = $1`, [id]);
    return rows[0] ? hydrate(rows[0]) : null;
  }

  async list(options: McpTaskListOptions = {}): Promise<McpTask[]> {
    await this.pg.ready;
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const result = options.status
      ? await this.pg.query<TaskRow>(`SELECT ${COLUMNS} FROM mcp_tasks WHERE status = $1 ORDER BY updated_at DESC LIMIT $2`, [options.status, limit])
      : await this.pg.query<TaskRow>(`SELECT ${COLUMNS} FROM mcp_tasks ORDER BY updated_at DESC LIMIT $1`, [limit]);
    return result.rows.map(hydrate);
  }

  async save(task: McpTask): Promise<void> {
    await this.pg.ready;
    const result = await this.pg.query(`UPDATE mcp_tasks SET
      type = $1, title = $2, request_json = $3, status = $4, backend = $5, external_task_id = $6, progress_summary = $7,
      result_refs_json = $8, error = $9, conversation_id = $10, request_id = $11, review_status = $12, review_notes = $13,
      created_at = $14, started_at = $15, updated_at = $16, finished_at = $17, last_synced_at = $18 WHERE id = $19`,
      [...values(task).slice(1), task.id]);
    if ((result.rowCount ?? 0) !== 1) throw new Error(`MCP task ${task.id} was not found.`);
  }
}

function values(task: McpTask): unknown[] {
  return [task.id, task.type, task.title, JSON.stringify(task.request), task.status, task.backend ?? null,
    task.externalTaskId ?? null, task.progressSummary ?? null, JSON.stringify(task.resultRefs), task.error ?? null,
    task.conversationId ?? null, task.requestId ?? null, task.reviewStatus ?? null, task.reviewNotes ?? null,
    task.createdAt, task.startedAt ?? null, task.updatedAt, task.finishedAt ?? null, task.lastSyncedAt ?? null];
}

function parseJson(value: unknown): any {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function hydrate(row: TaskRow): McpTask {
  return {
    id: row.id, type: row.type, title: row.title, request: parseJson(row.request_json), status: row.status,
    ...(row.backend ? { backend: row.backend } : {}), ...(row.external_task_id ? { externalTaskId: row.external_task_id } : {}),
    ...(row.progress_summary ? { progressSummary: row.progress_summary } : {}), resultRefs: parseJson(row.result_refs_json),
    ...(row.error ? { error: row.error } : {}), ...(row.conversation_id ? { conversationId: row.conversation_id } : {}),
    ...(row.request_id ? { requestId: row.request_id } : {}), ...(row.review_status ? { reviewStatus: row.review_status } : {}),
    ...(row.review_notes ? { reviewNotes: row.review_notes } : {}), createdAt: row.created_at,
    ...(row.started_at ? { startedAt: row.started_at } : {}), updatedAt: row.updated_at,
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}), ...(row.last_synced_at ? { lastSyncedAt: row.last_synced_at } : {}),
  };
}
