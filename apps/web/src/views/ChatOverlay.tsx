import {
  useEffect, useMemo, useRef, useState,
  type FormEvent, type KeyboardEvent,
} from "react";
import { create } from "zustand";
import { RichContent } from "../components/RichContent.js";
import "../components/RichContent.css";
import "./ChatOverlay.css";

/**
 * ChatOverlay — Spotlight-style global chat with Hermes.
 *
 * Lives in its own Electron BrowserWindow (frameless, transparent, always on
 * top). Opened via Cmd+Shift+Space. Esc closes (window hides, conversation
 * survives — Hermes continues any in-flight tool calls in the background).
 *
 * Layout: messages stream above, input box at bottom (Spotlight-style).
 *   ┌──────────────────────────────────────────────────┐
 *   │  You · 帮我生成今天的 AI 早报...                  │
 *   │  Hermes · 好的，先调用早报生成工具。              │
 *   │     ⚡ mcp_rich_generate_news (running)          │
 *   │     ✓ mcp_rich_generate_news (completed)         │
 *   │  Hermes · 今天 5 条已写入，要不要也生成 PPT？     │
 *   ├──────────────────────────────────────────────────┤
 *   │  [你想让 Hermes 做什么？_______________]   ↵      │
 *   └──────────────────────────────────────────────────┘
 */

type Role = "user" | "assistant";
interface ToolEvent {
  name: string;
  status: "running" | "completed";
  ts: number;
}
interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  tools?: ToolEvent[]; // only on assistant messages
  pending?: boolean;   // true while assistant is still streaming
  error?: string;
}

interface ChatStore {
  messages: ChatMessage[];
  inflight: boolean; // true while a request is mid-stream
  append(msg: ChatMessage): void;
  patchLast(patch: Partial<ChatMessage>): void;
  pushTool(ev: ToolEvent): void;
  setInflight(b: boolean): void;
  reset(): void;
}

/** Zustand store mounted in this renderer. The chat window stays alive as
 *  long as Electron keeps the renderer alive — so the conversation survives
 *  open/close cycles within a session. localStorage on top for cold-boot. */
const STORAGE_KEY = "ke.chat.v1";
function loadMessages(): ChatMessage[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    // Any message left pending across reloads is broken — strip its pending flag.
    return parsed.map(m => ({ ...m, pending: false }));
  } catch { return []; }
}

const useChatStore = create<ChatStore>((set, get) => ({
  messages: loadMessages(),
  inflight: false,
  append: (msg) => set(s => {
    const next = [...s.messages, msg];
    persistMessages(next);
    return { messages: next };
  }),
  patchLast: (patch) => set(s => {
    const idx = s.messages.length - 1;
    if (idx < 0) return s;
    const next = s.messages.slice();
    next[idx] = { ...next[idx], ...patch };
    persistMessages(next);
    return { messages: next };
  }),
  pushTool: (ev) => set(s => {
    const idx = s.messages.length - 1;
    if (idx < 0 || s.messages[idx].role !== "assistant") return s;
    const next = s.messages.slice();
    const tools = next[idx].tools ?? [];
    // If this is a "completed" event matching an earlier "running", update
    // in place rather than appending — keeps the list compact.
    if (ev.status === "completed") {
      const runningIdx = [...tools].reverse().findIndex(t => t.name === ev.name && t.status === "running");
      if (runningIdx >= 0) {
        const realIdx = tools.length - 1 - runningIdx;
        next[idx] = { ...next[idx], tools: tools.map((t, i) => i === realIdx ? ev : t) };
        return { messages: next };
      }
    }
    next[idx] = { ...next[idx], tools: [...tools, ev] };
    return { messages: next };
  }),
  setInflight: (b) => set({ inflight: b }),
  reset: () => {
    persistMessages([]);
    set({ messages: [], inflight: false });
  },
  // unused initially but exposed for completeness
  ...{} as Record<string, unknown> as Partial<ChatStore>,
  _get: get, // keep for future refactor
}) as ChatStore);

function persistMessages(msgs: ChatMessage[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch { /* quota */ }
}

function nextId() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ChatOverlay() {
  const messages = useChatStore(s => s.messages);
  const inflight = useChatStore(s => s.inflight);
  const append = useChatStore(s => s.append);
  const patchLast = useChatStore(s => s.patchLast);
  const pushTool = useChatStore(s => s.pushTool);
  const setInflight = useChatStore(s => s.setInflight);
  const reset = useChatStore(s => s.reset);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to TOP as new content arrives — we render the message list
  // in reverse (newest first), so the most recent message lives right under
  // the input bar. The user scrolls DOWN to see older history.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [messages]);

  // Auto-focus input when the window becomes visible. The Electron host hides
  // (not closes) the window — when it re-shows we re-focus.
  useEffect(() => {
    const focus = () => textareaRef.current?.focus();
    focus();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);

  // Auto-grow / auto-shrink textarea height based on content. Derived from
  // `input` state so it correctly resets to 1 line after send() clears it.
  // CSS `max-height` caps a runaway paste; CSS sets the 1-row baseline so
  // shrinking back lands at the right spot.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || inflight) return;
    const userMsg: ChatMessage = { id: nextId(), role: "user", content: trimmed };
    append(userMsg);
    setInput("");

    // History sent to Hermes — everything so far including the new user msg.
    const history = [...messages, userMsg].map(m => ({
      role: m.role, content: m.content,
    }));

    // Push an empty pending assistant message that we'll stream into.
    append({ id: nextId(), role: "assistant", content: "", pending: true, tools: [] });
    setInflight(true);

    try {
      const r = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!r.ok || !r.body) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `chat failed: ${r.status}`);
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let currentEvent: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).replace(/\r$/, "");
          buf = buf.slice(nl + 1);
          if (line === "") { currentEvent = null; continue; }
          if (line.startsWith("event:")) { currentEvent = line.slice(6).trim(); continue; }
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (!data) continue;
            let parsed: unknown;
            try { parsed = JSON.parse(data); } catch { continue; }

            if (currentEvent === "text") {
              const { chunk } = parsed as { chunk: string };
              patchLast({
                content: (useChatStore.getState().messages.at(-1)?.content ?? "") + chunk,
              });
            } else if (currentEvent === "tool") {
              const t = parsed as { name: string; status: "running" | "completed" };
              pushTool({ name: t.name, status: t.status, ts: Date.now() });
            } else if (currentEvent === "done") {
              patchLast({ pending: false });
            } else if (currentEvent === "error") {
              const { message } = parsed as { message: string };
              patchLast({ pending: false, error: message });
            }
          }
        }
      }
    } catch (err) {
      patchLast({
        pending: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setInflight(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send(input);
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
    if (e.key === "Escape") {
      // Forward to Electron host via custom event — main process listens and
      // hides the window. The conversation stays alive in the store.
      window.dispatchEvent(new CustomEvent("ke.chat.close"));
    }
  }

  // Esc anywhere closes the window (not just textarea).
  useEffect(() => {
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") window.dispatchEvent(new CustomEvent("ke.chat.close"));
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  // Bridge ke.chat.close → window.close-ish via preload-provided method, if any.
  // Falls back to no-op when running in plain web context.
  useEffect(() => {
    const onClose = () => {
      const w = window as Window & { ke?: { closeChatOverlay?: () => void } };
      w.ke?.closeChatOverlay?.();
      // Fallback: blur window so the host's blur-handler can hide it.
      window.blur();
    };
    window.addEventListener("ke.chat.close", onClose as EventListener);
    return () => window.removeEventListener("ke.chat.close", onClose as EventListener);
  }, []);

  const empty = messages.length === 0;

  return (
    <div className="chat-overlay">
      <div className="chat-shell">
        {/* Raycast-style: input on TOP, content scrolls BELOW, status bar at
         *  the bottom. The input bar doubles as the draggable window region
         *  (declared in CSS via -webkit-app-region). */}
        <form className="chat-input" onSubmit={onSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={inflight ? "Hermes 正在思考，可以继续追问..." : ""}
            rows={1}
            autoFocus
          />
          <div className="chat-input-actions">
            {messages.length > 0 && (
              <button type="button" className="chat-pill" onClick={reset} title="清空对话">清空</button>
            )}
            <button
              type="submit"
              className="chat-send"
              disabled={!input.trim() || inflight}
              title="发送 (Enter)"
            >
              {inflight ? "···" : "↵"}
            </button>
          </div>
        </form>

        <div ref={scrollRef} className={`chat-scroll${empty ? " is-empty" : ""}`}>
          {empty ? <EmptyHint /> : (
            // Reverse so the newest message renders FIRST (visually at top,
            // right under the input bar). Older messages get pushed down.
            // We don't use `flex-direction: column-reverse` because it makes
            // wheel scroll feel backward on some trackpads.
            messages.slice().reverse().map(m => (
              <MessageRow key={m.id} message={m} />
            ))
          )}
        </div>

        <footer className="chat-foot">
          <div className="chat-foot-brand">
            <span className="chat-brand-dot" /> Rich · Hermes
            {inflight && <span className="chat-foot-status">· 工作中</span>}
          </div>
          <div className="chat-foot-hints">
            <kbd>↵</kbd> 发送
            <span className="chat-foot-sep">·</span>
            <kbd>⇧↵</kbd> 换行
            <span className="chat-foot-sep">·</span>
            <kbd>Esc</kbd> 关闭
          </div>
        </footer>
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  return (
    <article className={`chat-msg chat-msg--${message.role}${message.pending ? " is-pending" : ""}${message.error ? " has-error" : ""}`}>
      <span className="chat-msg-role">{message.role === "user" ? "你" : "Hermes"}</span>
      <div className="chat-msg-body">
        {/* Tool-call pills hidden by design — the data still flows on
         *  `message.tools` but isn't rendered to keep the conversation
         *  surface clean. */}
        {message.content && (
          <div className="chat-msg-content">
            <RichContent text={message.content} />
            {message.pending && <span className="chat-cursor" aria-hidden="true">▍</span>}
          </div>
        )}
        {!message.content && message.pending && (
          <div className="chat-msg-thinking">Hermes 正在思考...</div>
        )}
        {message.error && <div className="chat-msg-error">⚠ {message.error}</div>}
      </div>
    </article>
  );
}

function EmptyHint() {
  const samples = useMemo(() => [
    "帮我生成今天的 AI 早报",
    "我的知识树里有哪些顶层主题？",
    "把『高铁科普』这个主题展开 5 个子元",
    "查一下昨天的任务都跑成功了吗",
  ], []);
  return (
    <div className="chat-empty">
      <p className="chat-empty-title">告诉 Rich 你想做什么</p>
      <p className="chat-empty-sub">Hermes 会自己规划，调用 27 个 MCP 工具完成你的请求</p>
      <ul className="chat-samples">
        {samples.map(s => <li key={s}>"{s}"</li>)}
      </ul>
    </div>
  );
}
