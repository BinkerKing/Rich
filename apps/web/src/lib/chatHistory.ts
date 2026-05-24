export type ChatRole = "user" | "assistant";

export interface ChatToolEvent {
  name: string;
  status: "running" | "completed";
  ts: number;
}

export interface ChatHistoryMessage {
  id: string;
  role: ChatRole;
  content: string;
  tools?: ChatToolEvent[];
  pending?: boolean;
  error?: string;
}

export const CHAT_HISTORY_STORAGE_KEY = "ke.chat.v1";
export const CHAT_HISTORY_UPDATED_EVENT = "ke.chat.history.updated";

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
