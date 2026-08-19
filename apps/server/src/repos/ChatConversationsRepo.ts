export type ChatRole = "user" | "assistant" | "system";

export interface ChatConversation {
  id: string;
  title: string;
  surface: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface ChatMessageRecord {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  adapter?: string;
  modelSessionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ChatConversationSummary {
  conversationId: string;
  summary: string;
  messageCount: number;
  lastMessageId?: string;
  updatedAt: string;
}

export interface ChatConversationsRepo {
  ensureConversation(input: {
    id: string;
    title?: string;
    surface?: string;
    now: string;
  }): Promise<ChatConversation>;
  appendMessage(message: ChatMessageRecord): Promise<void>;
  listMessages(conversationId: string, limit: number): Promise<ChatMessageRecord[]>;
  listConversations(limit: number): Promise<ChatConversation[]>;
  countMessages(conversationId: string): Promise<number>;
  getSummary(conversationId: string): Promise<ChatConversationSummary | null>;
  upsertSummary(summary: ChatConversationSummary): Promise<void>;
}
