import type Database from "better-sqlite3";
import type { ProjectDictionaryCodexConversation, ProjectDictionaryCodexConversationRepo, ProjectDictionaryCodexConversationStatus } from "./ProjectDictionaryCodexConversationRepo.js";

interface Row {
  id: string;
  conversation_id: string;
  project_id: string;
  title: string;
  executor: "codex";
  codex_thread_id: string | null;
  status: ProjectDictionaryCodexConversationStatus;
  is_bound: number;
  context_version: string | null;
  last_context_sync_at: string | null;
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

const columns = "id, conversation_id, project_id, title, executor, codex_thread_id, status, is_bound, context_version, last_context_sync_at, created_at, updated_at, last_active_at";

function fromRow(row: Row): ProjectDictionaryCodexConversation {
  return { id: row.id, conversationId: row.conversation_id, projectId: row.project_id, title: row.title, executor: row.executor, codexThreadId: row.codex_thread_id ?? undefined, status: row.status, isBound: Boolean(row.is_bound), contextVersion: row.context_version ?? undefined, lastContextSyncAt: row.last_context_sync_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at, lastActiveAt: row.last_active_at };
}

export class SqliteProjectDictionaryCodexConversationRepo implements ProjectDictionaryCodexConversationRepo {
  constructor(private readonly db: Database.Database) {}

  async create(value: ProjectDictionaryCodexConversation): Promise<void> {
    this.db.prepare(`INSERT INTO project_dictionary_codex_conversations (${columns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(value.id, value.conversationId, value.projectId, value.title, value.executor, value.codexThreadId ?? null, value.status, value.isBound ? 1 : 0, value.contextVersion ?? null, value.lastContextSyncAt ?? null, value.createdAt, value.updatedAt, value.lastActiveAt);
  }

  async get(id: string): Promise<ProjectDictionaryCodexConversation | null> {
    const row = this.db.prepare(`SELECT ${columns} FROM project_dictionary_codex_conversations WHERE id = ?`).get(id) as Row | undefined;
    return row ? fromRow(row) : null;
  }

  async listActive(projectId: string): Promise<ProjectDictionaryCodexConversation[]> {
    return (this.db.prepare(`SELECT ${columns} FROM project_dictionary_codex_conversations WHERE project_id = ? AND status = 'active' ORDER BY last_active_at DESC, created_at DESC`).all(projectId) as Row[]).map(fromRow);
  }

  async getBound(projectId: string): Promise<ProjectDictionaryCodexConversation | null> {
    const row = this.db.prepare(`SELECT ${columns} FROM project_dictionary_codex_conversations WHERE project_id = ? AND status = 'active' AND is_bound = 1`).get(projectId) as Row | undefined;
    return row ? fromRow(row) : null;
  }

  async bind(id: string, at: string): Promise<ProjectDictionaryCodexConversation | null> {
    const current = await this.get(id);
    if (!current || current.status !== "active") return null;
    this.db.transaction(() => {
      this.db.prepare(`UPDATE project_dictionary_codex_conversations SET is_bound = 0, updated_at = ? WHERE project_id = ? AND is_bound = 1`).run(at, current.projectId);
      this.db.prepare(`UPDATE project_dictionary_codex_conversations SET is_bound = 1, updated_at = ? WHERE id = ?`).run(at, id);
    })();
    return this.get(id);
  }

  async touch(id: string, at: string): Promise<ProjectDictionaryCodexConversation | null> {
    this.db.prepare(`UPDATE project_dictionary_codex_conversations SET last_active_at = ?, updated_at = ? WHERE id = ?`).run(at, at, id);
    return this.get(id);
  }

  async archive(id: string, at: string): Promise<ProjectDictionaryCodexConversation | null> {
    this.db.prepare(`UPDATE project_dictionary_codex_conversations SET status = 'archived', is_bound = 0, updated_at = ? WHERE id = ?`).run(at, id);
    return this.get(id);
  }

  async setCodexThread(id: string, threadId: string | undefined, contextVersion: string | undefined, at: string): Promise<void> {
    this.db.prepare(`UPDATE project_dictionary_codex_conversations SET codex_thread_id = ?, context_version = ?, updated_at = ? WHERE id = ?`).run(threadId ?? null, contextVersion ?? null, at, id);
  }

  async markContextSynced(id: string, at: string): Promise<void> {
    this.db.prepare(`UPDATE project_dictionary_codex_conversations SET last_context_sync_at = ?, updated_at = ? WHERE id = ?`).run(at, at, id);
  }
}
