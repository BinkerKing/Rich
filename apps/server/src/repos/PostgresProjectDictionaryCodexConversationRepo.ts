import type { PgPool } from "../db/postgres.js";
import type { ProjectDictionaryCodexConversation, ProjectDictionaryCodexConversationRepo, ProjectDictionaryCodexConversationStatus } from "./ProjectDictionaryCodexConversationRepo.js";

interface Row {
  id: string;
  conversation_id: string;
  project_id: string;
  title: string;
  executor: "codex";
  codex_thread_id: string | null;
  status: ProjectDictionaryCodexConversationStatus;
  is_bound: boolean;
  context_version: string | null;
  last_context_sync_at: string | null;
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

const columns = "id, conversation_id, project_id, title, executor, codex_thread_id, status, is_bound, context_version, last_context_sync_at, created_at, updated_at, last_active_at";

function fromRow(row: Row): ProjectDictionaryCodexConversation {
  return { id: row.id, conversationId: row.conversation_id, projectId: row.project_id, title: row.title, executor: row.executor, codexThreadId: row.codex_thread_id ?? undefined, status: row.status, isBound: row.is_bound, contextVersion: row.context_version ?? undefined, lastContextSyncAt: row.last_context_sync_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at, lastActiveAt: row.last_active_at };
}

export class PostgresProjectDictionaryCodexConversationRepo implements ProjectDictionaryCodexConversationRepo {
  constructor(private readonly pool: PgPool) {}

  async create(value: ProjectDictionaryCodexConversation): Promise<void> {
    await this.pool.query(`INSERT INTO project_dictionary_codex_conversations (${columns}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [value.id, value.conversationId, value.projectId, value.title, value.executor, value.codexThreadId ?? null, value.status, value.isBound ?? false, value.contextVersion ?? null, value.lastContextSyncAt ?? null, value.createdAt, value.updatedAt, value.lastActiveAt]);
  }

  async get(id: string): Promise<ProjectDictionaryCodexConversation | null> {
    const { rows } = await this.pool.query<Row>(`SELECT ${columns} FROM project_dictionary_codex_conversations WHERE id = $1`, [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async listActive(projectId: string): Promise<ProjectDictionaryCodexConversation[]> {
    const { rows } = await this.pool.query<Row>(`SELECT ${columns} FROM project_dictionary_codex_conversations WHERE project_id = $1 AND status = 'active' ORDER BY last_active_at DESC, created_at DESC`, [projectId]);
    return rows.map(fromRow);
  }

  async getBound(projectId: string): Promise<ProjectDictionaryCodexConversation | null> {
    const { rows } = await this.pool.query<Row>(`SELECT ${columns} FROM project_dictionary_codex_conversations WHERE project_id = $1 AND status = 'active' AND is_bound = true`, [projectId]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async bind(id: string, at: string): Promise<ProjectDictionaryCodexConversation | null> {
    const current = await this.get(id);
    if (!current || current.status !== "active") return null;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE project_dictionary_codex_conversations SET is_bound = false, updated_at = $1 WHERE project_id = $2 AND is_bound = true`, [at, current.projectId]);
      await client.query(`UPDATE project_dictionary_codex_conversations SET is_bound = true, updated_at = $1 WHERE id = $2`, [at, id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
    return this.get(id);
  }

  async touch(id: string, at: string): Promise<ProjectDictionaryCodexConversation | null> {
    await this.pool.query(`UPDATE project_dictionary_codex_conversations SET last_active_at = $1, updated_at = $1 WHERE id = $2`, [at, id]);
    return this.get(id);
  }

  async archive(id: string, at: string): Promise<ProjectDictionaryCodexConversation | null> {
    await this.pool.query(`UPDATE project_dictionary_codex_conversations SET status = 'archived', is_bound = false, updated_at = $1 WHERE id = $2`, [at, id]);
    return this.get(id);
  }

  async setCodexThread(id: string, threadId: string | undefined, contextVersion: string | undefined, at: string): Promise<void> {
    await this.pool.query(`UPDATE project_dictionary_codex_conversations SET codex_thread_id = $1, context_version = $2, updated_at = $3 WHERE id = $4`, [threadId ?? null, contextVersion ?? null, at, id]);
  }

  async markContextSynced(id: string, at: string): Promise<void> {
    await this.pool.query(`UPDATE project_dictionary_codex_conversations SET last_context_sync_at = $1, updated_at = $2 WHERE id = $3`, [at, at, id]);
  }
}
