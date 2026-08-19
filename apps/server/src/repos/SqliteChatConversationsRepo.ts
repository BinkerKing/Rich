import type Database from "better-sqlite3";
import type { ChatConversation, ChatConversationsRepo, ChatMessageRecord } from "./ChatConversationsRepo.js";

interface ConversationRow {
  id: string;
  title: string;
  surface: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  adapter: string | null;
  model_session_id: string | null;
  metadata: string | null;
  created_at: string;
}

function conversationFromRow(row: ConversationRow): ChatConversation {
  return {
    id: row.id,
    title: row.title,
    surface: row.surface,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
  };
}

function messageFromRow(row: MessageRow): ChatMessageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as ChatMessageRecord["role"],
    content: row.content,
    adapter: row.adapter ?? undefined,
    modelSessionId: row.model_session_id ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : undefined,
    createdAt: row.created_at,
  };
}

export class SqliteChatConversationsRepo implements ChatConversationsRepo {
  constructor(private db: Database.Database) {}

  async ensureConversation(input: {
    id: string;
    title?: string;
    surface?: string;
    now: string;
  }): Promise<ChatConversation> {
    const title = input.title?.trim() || "Rich 对话";
    const surface = input.surface?.trim() || "chat";
    this.db.prepare(`
      INSERT INTO chat_conversations (id, title, surface, created_at, updated_at, last_message_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = CASE
          WHEN chat_conversations.title = 'Rich 对话' THEN excluded.title
          ELSE chat_conversations.title
        END,
        surface = excluded.surface,
        updated_at = excluded.updated_at
    `).run(input.id, title, surface, input.now, input.now, input.now);

    const row = this.db.prepare(`
      SELECT id, title, surface, created_at, updated_at, last_message_at
        FROM chat_conversations WHERE id = ?
    `).get(input.id) as ConversationRow;
    return conversationFromRow(row);
  }

  async appendMessage(message: ChatMessageRecord): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO chat_messages
        (id, conversation_id, role, content, adapter, model_session_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.id,
      message.conversationId,
      message.role,
      message.content,
      message.adapter ?? null,
      message.modelSessionId ?? null,
      message.metadata ? JSON.stringify(message.metadata) : null,
      message.createdAt,
    );
    this.db.prepare(`
      UPDATE chat_conversations
         SET updated_at = ?, last_message_at = ?
       WHERE id = ?
    `).run(message.createdAt, message.createdAt, message.conversationId);
  }

  async listMessages(conversationId: string, limit: number): Promise<ChatMessageRecord[]> {
    const rows = this.db.prepare(`
      SELECT id, conversation_id, role, content, adapter, model_session_id, metadata, created_at
        FROM chat_messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC
       LIMIT ?
    `).all(conversationId, limit) as MessageRow[];
    return rows.reverse().map(messageFromRow);
  }

  async listConversations(limit: number): Promise<ChatConversation[]> {
    const rows = this.db.prepare(`
      SELECT id, title, surface, created_at, updated_at, last_message_at
        FROM chat_conversations
       ORDER BY last_message_at DESC
       LIMIT ?
    `).all(limit) as ConversationRow[];
    return rows.map(conversationFromRow);
  }
}
