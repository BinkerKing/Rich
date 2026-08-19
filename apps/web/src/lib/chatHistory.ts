export type ChatRole = "user" | "assistant";

export interface ChatToolEvent {
  name: string;
  status: "running" | "completed";
  ts: number;
}

/** 历史记录里的附件引用 —— 只存元数据，原始字节在服务端 chat_attachments 表 */
export interface ChatHistoryAttachment {
  id: string;        // 服务端 attachment id（att-...）
  url: string;       // /api/chat/attachments/:id/data
  mime: string;
  width?: number;
  height?: number;
}

/** 兼容老历史里 url 没带 /data 后缀的情况 —— 把元数据路径自动改成数据路径 */
export function attachmentDataUrl(att: ChatHistoryAttachment): string {
  if (att.url.endsWith("/data")) return att.url;
  // 老格式 /api/chat/attachments/:id → 自动补 /data
  if (/^\/api\/chat\/attachments\/[^/]+$/.test(att.url)) return `${att.url}/data`;
  // 外部 URL（V1 OSS）或 已经带 /data 的，原样返回
  return att.url;
}

export interface ChatHistoryMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: number;
  tools?: ChatToolEvent[];
  pending?: boolean;
  error?: string;
  /** 用户在这条 message 附上的图片（仅 user 角色用） */
  attachments?: ChatHistoryAttachment[];
}

export const CHAT_HISTORY_STORAGE_KEY = "ke.chat.v1";
export const CHAT_HISTORY_UPDATED_EVENT = "ke.chat.history.updated";
export const DEFAULT_CHAT_CONVERSATION_ID = "rich-chat-default";

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

export function loadChatHistory(options: { preservePending?: boolean } = {}): ChatHistoryMessage[] {
  const w = safeWindow();
  if (!w) return [];
  try {
    const raw = w.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatHistoryMessage[];
    if (!Array.isArray(parsed)) return [];
    if (options.preservePending) return parsed;
    return parsed.map(m => ({ ...m, pending: false }));
  } catch {
    return [];
  }
}

export function saveChatHistory(messages: ChatHistoryMessage[]): void {
  const w = safeWindow();
  if (!w) return;
  try {
    w.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages));
    w.dispatchEvent(new CustomEvent(CHAT_HISTORY_UPDATED_EVENT));
  } catch {
    // localStorage may be unavailable or full; chat should keep working in memory.
  }
}

export async function loadServerChatHistory(
  conversationId = DEFAULT_CHAT_CONVERSATION_ID,
  limit = 80,
): Promise<ChatHistoryMessage[]> {
  const res = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}`);
  if (!res.ok) return [];
  const json = await res.json().catch(() => null) as
    | { messages?: Array<{ id: string; role: string; content: string; createdAt?: string | number; metadata?: unknown }> }
    | null;
  const messages = Array.isArray(json?.messages) ? json.messages : [];
  return messages
    .filter(message => message.role === "user" || message.role === "assistant")
    .map(message => {
      const createdAt = typeof message.createdAt === "number"
        ? message.createdAt
        : message.createdAt
          ? Date.parse(message.createdAt)
          : undefined;
      return {
        id: message.id,
        role: message.role as ChatRole,
        content: message.content,
        createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
        pending: false,
      };
    });
}
