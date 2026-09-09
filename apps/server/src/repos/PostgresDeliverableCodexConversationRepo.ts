import type { PgPool } from "../db/postgres.js";
import type { DeliverableCodexConversation, DeliverableCodexConversationRepo, DeliverableCodexConversationStatus } from "./DeliverableCodexConversationRepo.js";

interface Row {
  id: string;
  conversation_id: string;
  scope_key: string;
  project_id: string;
  deliverable_id: string;
  title: string;
  mode: DeliverableCodexConversation["mode"];
  executor: "codex";
  codex_thread_id: string | null;
  status: DeliverableCodexConversationStatus;
  context_version: string | null;
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

const columns = `id, conversation_id, scope_key, project_id, deliverable_id, title, mode, executor,
  codex_thread_id, status, context_version, created_at, updated_at, last_active_at`;

function fromRow(row: Row): DeliverableCodexConversation {
  return {
    id: row.id, conversationId: row.conversation_id, scopeKey: row.scope_key,
    projectId: row.project_id, deliverableId: row.deliverable_id, title: row.title,
    mode: row.mode, executor: row.executor, codexThreadId: row.codex_thread_id ?? undefined,
    status: row.status, contextVersion: row.context_version ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at, lastActiveAt: row.last_active_at,
  };
}

export class PostgresDeliverableCodexConversationRepo implements DeliverableCodexConversationRepo {
  constructor(private readonly pool: PgPool) {}

  async create(value: DeliverableCodexConversation): Promise<void> {
    await this.pool.query(`
      INSERT INTO deliverable_codex_conversations (${columns})
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      value.id, value.conversationId, value.scopeKey, value.projectId, value.deliverableId,
      value.title, value.mode, value.executor, value.codexThreadId ?? null, value.status,
      value.contextVersion ?? null, value.createdAt, value.updatedAt, value.lastActiveAt,
    ]);
  }

  async get(id: string): Promise<DeliverableCodexConversation | null> {
    const { rows } = await this.pool.query<Row>(`SELECT ${columns} FROM deliverable_codex_conversations WHERE id = $1`, [id]);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async listAllActive(): Promise<DeliverableCodexConversation[]> {
    const { rows } = await this.pool.query<Row>(`SELECT ${columns} FROM deliverable_codex_conversations WHERE status = 'active' ORDER BY last_active_at DESC, created_at DESC`);
    return rows.map(fromRow);
  }

  async listActive(scopeKey: string): Promise<DeliverableCodexConversation[]> {
    const { rows } = await this.pool.query<Row>(`
      SELECT ${columns} FROM deliverable_codex_conversations
      WHERE scope_key = $1 AND status = 'active'
      ORDER BY last_active_at DESC, created_at DESC
    `, [scopeKey]);
    return rows.map(fromRow);
  }

  async rename(id: string, title: string, at: string): Promise<DeliverableCodexConversation | null> {
    await this.pool.query(`UPDATE deliverable_codex_conversations SET title = $1, updated_at = $2 WHERE id = $3`, [title, at, id]);
    return this.get(id);
  }

  async touch(id: string, at: string): Promise<DeliverableCodexConversation | null> {
    await this.pool.query(`UPDATE deliverable_codex_conversations SET last_active_at = $1, updated_at = $1 WHERE id = $2`, [at, id]);
    return this.get(id);
  }

  async archive(id: string, at: string): Promise<DeliverableCodexConversation | null> {
    await this.pool.query(`UPDATE deliverable_codex_conversations SET status = 'archived', updated_at = $1 WHERE id = $2`, [at, id]);
    return this.get(id);
  }

  async setCodexThread(id: string, threadId: string | undefined, contextVersion: string | undefined, at: string): Promise<void> {
    await this.pool.query(`
      UPDATE deliverable_codex_conversations
      SET codex_thread_id = $1, context_version = $2, updated_at = $3
      WHERE id = $4
    `, [threadId ?? null, contextVersion ?? null, at, id]);
  }
}
