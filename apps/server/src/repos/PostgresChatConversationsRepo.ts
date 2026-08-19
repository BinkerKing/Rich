import type { PgPool } from "../db/postgres.js";
import type { ChatConversation, ChatConversationSummary, ChatConversationsRepo, ChatMessageRecord } from "./ChatConversationsRepo.js";

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
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface SummaryRow {
  conversation_id: string;
  summary: string;
  message_count: number;
  last_message_id: string | null;
  updated_at: string;
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
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  };
}

function summaryFromRow(row: SummaryRow): ChatConversationSummary {
  return {
    conversationId: row.conversation_id,
    summary: row.summary,
    messageCount: row.message_count,
    lastMessageId: row.last_message_id ?? undefined,
    updatedAt: row.updated_at,
  };
}

export class PostgresChatConversationsRepo implements ChatConversationsRepo {
  constructor(private pool: PgPool) {}

  async ensureConversation(input: {
    id: string;
    title?: string;
    surface?: string;
    now: string;
  }): Promise<ChatConversation> {
    const title = input.title?.trim() || "Rich 对话";
    const surface = input.surface?.trim() || "chat";
    const { rows } = await this.pool.query<ConversationRow>(
      `INSERT INTO chat_conversations (id, title, surface, created_at, updated_at, last_message_at)
       VALUES ($1, $2, $3, $4, $4, $4)
       ON CONFLICT(id) DO UPDATE SET
         title = CASE
           WHEN chat_conversations.title = 'Rich 对话' THEN EXCLUDED.title
           ELSE chat_conversations.title
         END,
         surface = EXCLUDED.surface,
         updated_at = EXCLUDED.updated_at
       RETURNING id, title, surface, created_at, updated_at, last_message_at`,
      [input.id, title, surface, input.now],
    );
    return conversationFromRow(rows[0]);
  }

  async appendMessage(message: ChatMessageRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO chat_messages
         (id, conversation_id, role, content, adapter, model_session_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT(id) DO UPDATE SET
         content = EXCLUDED.content,
         adapter = EXCLUDED.adapter,
         model_session_id = EXCLUDED.model_session_id,
         metadata = EXCLUDED.metadata`,
      [
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.adapter ?? null,
        message.modelSessionId ?? null,
        message.metadata ? JSON.stringify(message.metadata) : null,
        message.createdAt,
      ],
    );
    await this.pool.query(
      `UPDATE chat_conversations
          SET updated_at = $1, last_message_at = $1
        WHERE id = $2`,
      [message.createdAt, message.conversationId],
    );
  }

  async listMessages(conversationId: string, limit: number): Promise<ChatMessageRecord[]> {
    const { rows } = await this.pool.query<MessageRow>(
      `SELECT id, conversation_id, role, content, adapter, model_session_id, metadata, created_at
         FROM chat_messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [conversationId, limit],
    );
    return rows.reverse().map(messageFromRow);
  }

  async listConversations(limit: number): Promise<ChatConversation[]> {
    const { rows } = await this.pool.query<ConversationRow>(
      `SELECT id, title, surface, created_at, updated_at, last_message_at
         FROM chat_conversations
        ORDER BY last_message_at DESC
        LIMIT $1`,
      [limit],
    );
    return rows.map(conversationFromRow);
  }

  async countMessages(conversationId: string): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      `SELECT count(*) AS count FROM chat_messages WHERE conversation_id = $1`,
      [conversationId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getSummary(conversationId: string): Promise<ChatConversationSummary | null> {
    const { rows } = await this.pool.query<SummaryRow>(
      `SELECT conversation_id, summary, message_count, last_message_id, updated_at
         FROM chat_conversation_summaries
        WHERE conversation_id = $1`,
      [conversationId],
    );
    return rows[0] ? summaryFromRow(rows[0]) : null;
  }

  async upsertSummary(summary: ChatConversationSummary): Promise<void> {
    await this.pool.query(
      `INSERT INTO chat_conversation_summaries
         (conversation_id, summary, message_count, last_message_id, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(conversation_id) DO UPDATE SET
         summary = EXCLUDED.summary,
         message_count = EXCLUDED.message_count,
         last_message_id = EXCLUDED.last_message_id,
         updated_at = EXCLUDED.updated_at`,
      [
        summary.conversationId,
        summary.summary,
        summary.messageCount,
        summary.lastMessageId ?? null,
        summary.updatedAt,
      ],
    );
  }
}
