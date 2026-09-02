import type Database from "better-sqlite3";
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
    id: row.id,
    conversationId: row.conversation_id,
    scopeKey: row.scope_key,
    projectId: row.project_id,
    deliverableId: row.deliverable_id,
    title: row.title,
    mode: row.mode,
    executor: row.executor,
    codexThreadId: row.codex_thread_id ?? undefined,
    status: row.status,
    contextVersion: row.context_version ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
  };
}

export class SqliteDeliverableCodexConversationRepo implements DeliverableCodexConversationRepo {
  constructor(private readonly db: Database.Database) {}

  async create(value: DeliverableCodexConversation): Promise<void> {
    this.db.prepare(`
      INSERT INTO deliverable_codex_conversations
        (${columns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id, value.conversationId, value.scopeKey, value.projectId, value.deliverableId,
      value.title, value.mode, value.executor, value.codexThreadId ?? null, value.status,
      value.contextVersion ?? null, value.createdAt, value.updatedAt, value.lastActiveAt,
    );
  }

  async get(id: string): Promise<DeliverableCodexConversation | null> {
    const row = this.db.prepare(`SELECT ${columns} FROM deliverable_codex_conversations WHERE id = ?`).get(id) as Row | undefined;
    return row ? fromRow(row) : null;
  }

  async listActive(scopeKey: string): Promise<DeliverableCodexConversation[]> {
    return (this.db.prepare(`
      SELECT ${columns} FROM deliverable_codex_conversations
      WHERE scope_key = ? AND status = 'active'
      ORDER BY last_active_at DESC, created_at DESC
    `).all(scopeKey) as Row[]).map(fromRow);
  }

  async touch(id: string, at: string): Promise<DeliverableCodexConversation | null> {
    this.db.prepare(`UPDATE deliverable_codex_conversations SET last_active_at = ?, updated_at = ? WHERE id = ?`).run(at, at, id);
    return this.get(id);
  }

  async archive(id: string, at: string): Promise<DeliverableCodexConversation | null> {
    this.db.prepare(`UPDATE deliverable_codex_conversations SET status = 'archived', updated_at = ? WHERE id = ?`).run(at, id);
    return this.get(id);
  }

  async setCodexThread(id: string, threadId: string | undefined, contextVersion: string | undefined, at: string): Promise<void> {
    this.db.prepare(`
      UPDATE deliverable_codex_conversations
      SET codex_thread_id = ?, context_version = ?, updated_at = ?
      WHERE id = ?
    `).run(threadId ?? null, contextVersion ?? null, at, id);
  }
}
