import {
  useEffect, useMemo, useRef, useState,
  type FormEvent, type KeyboardEvent,
} from "react";
import { create } from "zustand";
import type { Element } from "@ke/domain";
import { Icon, iconForElement } from "../components/Icon.js";
import { RichContent } from "../components/RichContent.js";
import { dispatchMascotEvent } from "../lib/mascotEvents.js";
import { persistVisualBlocks } from "../lib/extractVisualBlocks.js";
import { markChatSendStart, markMascotFirstFrame, markFirstTextChunk, newReqId } from "../lib/perfMarks.js";
import { ChatHistoryView } from "./ChatHistoryView.js";
import { useChatComposer } from "../lib/useChatComposer.js";
import { APP_MENU_ITEMS, type AppMenuItem } from "../lib/appCatalog.js";
import { requestRichNavigation } from "../lib/richNavigation.js";
import { useStore, type AppView } from "../state/store.js";
import "../components/RichContent.css";
import {
  CHAT_HISTORY_STORAGE_KEY,
  CHAT_HISTORY_UPDATED_EVENT,
  DEFAULT_CHAT_CONVERSATION_ID,
  loadChatHistory,
  loadServerChatHistory,
  saveChatHistory,
  attachmentDataUrl,
  type ChatHistoryMessage,
  type ChatToolEvent,
} from "../lib/chatHistory.js";
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

type ToolEvent = ChatToolEvent;
type ChatMessage = ChatHistoryMessage;

interface ChatStore {
  messages: ChatMessage[];
  inflight: boolean; // true while a request is mid-stream
  append(msg: ChatMessage): void;
  patchLast(patch: Partial<ChatMessage>): void;
  pushTool(ev: ToolEvent): void;
  setInflight(b: boolean): void;
  replaceAll(messages: ChatMessage[]): void;
  reset(): void;
}

/** Zustand store mounted in this renderer. The chat window stays alive as
 *  long as Electron keeps the renderer alive — so the conversation survives
 *  open/close cycles within a session. localStorage on top for cold-boot. */
const useChatStore = create<ChatStore>((set, get) => ({
  messages: loadChatHistory(),
  inflight: false,
  append: (msg) => set(s => {
    const next = [...s.messages, msg];
    saveChatHistory(next);
    return { messages: next };
  }),
  patchLast: (patch) => set(s => {
    const idx = s.messages.length - 1;
    if (idx < 0) return s;
    const next = s.messages.slice();
    next[idx] = { ...next[idx], ...patch };
    saveChatHistory(next);
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
        saveChatHistory(next);
        return { messages: next };
      }
    }
    next[idx] = { ...next[idx], tools: [...tools, ev] };
    saveChatHistory(next);
    return { messages: next };
  }),
  setInflight: (b) => set({ inflight: b }),
  replaceAll: (messages) => set({ messages }),
  reset: () => {
    saveChatHistory([]);
    set({ messages: [], inflight: false });
  },
  // unused initially but exposed for completeness
  ...{} as Record<string, unknown> as Partial<ChatStore>,
  _get: get, // keep for future refactor
}) as ChatStore);

function nextId() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// 单一选择/搜索模式 —— 之前的 4 种合并成 1 种：边搜索边选，命中应用 / 元就跳。
// 旧的 qa / work 已去掉（普通问答直接打字发送即可，工具调用走 Hermes 默认行为）。
type SlashMode = "find";
type SlashItem =
  | { key: string; kind: "mode"; mode: SlashModeOption }
  | { key: string; kind: "app"; app: AppMenuItem }
  | { key: string; kind: "element"; element: Element };

interface SlashModeOption {
  id: SlashMode;
  token: string;
  label: string;
  hint: string;
}

const SLASH_MODES: SlashModeOption[] = [
  { id: "find", token: "/find ", label: "搜索 / 选择", hint: "找应用、元、元内信息 —— 命中直接跳" },
];

const MODE_ALIASES: Record<string, SlashMode> = {
  find: "find",
  search: "find",
  select: "find",
  choose: "find",
  "搜索": "find",
  "选择": "find",
};

function parseSlashInput(value: string): { active: boolean; mode: SlashMode | null; query: string } {
  if (!value.startsWith("/")) return { active: false, mode: null, query: "" };
  const body = value.slice(1).trimStart();
  if (!body) return { active: true, mode: null, query: "" };
  const [head = "", ...tail] = body.split(/\s+/);
  const mode = MODE_ALIASES[head.toLowerCase()] ?? MODE_ALIASES[head];
  if (mode) return { active: true, mode, query: tail.join(" ").trim() };
  return { active: true, mode: null, query: body.trim() };
}

function safeSearchText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function elementSearchText(element: Element): string {
  return [
    element.title,
    element.subtitle,
    element.type,
    element.domain,
    ...(element.aliases ?? []),
    ...(element.tags ?? []),
    safeSearchText(element.content),
  ].filter(Boolean).join("\n").toLowerCase();
}

function normalizeSlashMessage(value: string): string | null {
  const parsed = parseSlashInput(value);
  if (!parsed.active) return value;
  // 现在只剩 find 一种模式 —— 不当聊天发送，全部交给 chooseSlashItem 走跳转。
  return null;
}

export function ChatOverlay() {
  const messages = useChatStore(s => s.messages);
  const inflight = useChatStore(s => s.inflight);
  const append = useChatStore(s => s.append);
  const patchLast = useChatStore(s => s.patchLast);
  const pushTool = useChatStore(s => s.pushTool);
  const setInflight = useChatStore(s => s.setInflight);
  const replaceAll = useChatStore(s => s.replaceAll);
  const reset = useChatStore(s => s.reset);

  const [input, setInput] = useState("");
  /** T16: 是否切到三栏历史回看视图 */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composingRef = useRef(false);
  const lastDictationInputAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composer = useChatComposer({ maxAttachments: 8 });
  const hydrate = useStore(s => s.hydrate);
  const elements = useStore(s => s.elements);

  useEffect(() => { void hydrate(); }, [hydrate]);

  const slash = useMemo(() => parseSlashInput(input), [input]);
  const appResults = useMemo(() => {
    if (!slash.active) return [];
    const query = slash.query.toLowerCase();
    if (!query) return APP_MENU_ITEMS;
    return APP_MENU_ITEMS
      .filter(app => [app.id, app.label, app.desc].join(" ").toLowerCase().includes(query))
      .slice(0, 8);
  }, [slash.active, slash.query]);
  const elementResults = useMemo(() => {
    if (!slash.active) return [];
    const query = slash.query.toLowerCase();
    const list = Array.from(elements.values());
    const sorted = query
      ? list.filter(element => elementSearchText(element).includes(query))
      : list.sort((a, b) => Date.parse(b.metadata.updatedAt) - Date.parse(a.metadata.updatedAt));
    return sorted.slice(0, 8);
  }, [elements, slash.active, slash.query]);
  const slashItems = useMemo<SlashItem[]>(() => {
    if (!slash.active) return [];
    const modeItems: SlashItem[] = slash.mode
      ? []
      : SLASH_MODES
        .filter(mode => !slash.query || `${mode.label} ${mode.token} ${mode.hint}`.toLowerCase().includes(slash.query.toLowerCase()))
        .map(mode => ({ key: `mode:${mode.id}`, kind: "mode", mode }));
    // find 模式或已经在打字（没明确选模式但有 query）都立刻开始搜索 + 展示候选
    const canSearch = slash.mode === "find" || (!slash.mode && slash.query.length > 0);
    if (!canSearch) return modeItems;
    return [
      ...modeItems,
      ...appResults.map(app => ({ key: `app:${app.id}`, kind: "app" as const, app })),
      ...elementResults.map(element => ({ key: `element:${element.id}`, kind: "element" as const, element })),
    ];
  }, [appResults, elementResults, slash.active, slash.mode, slash.query]);

  useEffect(() => { setSlashIndex(0); }, [input]);

  function openApp(view: AppView) {
    requestRichNavigation({ kind: "view", view });
    setInput("");
    window.setTimeout(() => window.blur(), 0);
  }

  function openElement(elementId: string) {
    requestRichNavigation({ kind: "element", elementId });
    setInput("");
    window.setTimeout(() => window.blur(), 0);
  }

  function chooseSlashItem(item: SlashItem | undefined) {
    if (!item) return false;
    if (item.kind === "mode") {
      const token = item.mode.token;
      setInput(token);
      // 选完模式光标定位到末尾（不是开头），紧接着就能继续输入查询词
      window.requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        try { el.setSelectionRange(token.length, token.length); }
        catch { /* IE11 era safari edge cases; harmless */ }
      });
      return true;
    }
    if (item.kind === "app") {
      openApp(item.app.id);
      return true;
    }
    openElement(item.element.id);
    return true;
  }

  function submitSlashCommand() {
    if (!slash.active) return false;
    const normalized = normalizeSlashMessage(input);
    if (normalized) {
      void send(normalized);
      return true;
    }
    chooseSlashItem(slashItems[slashIndex] ?? slashItems[0]);
    return true;
  }

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

  useEffect(() => {
    const refresh = () => {
      if (!useChatStore.getState().inflight) replaceAll(loadChatHistory({ preservePending: true }));
    };
    const refreshFromServer = () => {
      if (useChatStore.getState().inflight) return;
      void loadServerChatHistory().then(serverMessages => {
        if (serverMessages.length === 0 || useChatStore.getState().inflight) return;
        replaceAll(serverMessages);
        saveChatHistory(serverMessages);
      }).catch(() => refresh());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CHAT_HISTORY_STORAGE_KEY) refresh();
    };
    refreshFromServer();
    window.addEventListener(CHAT_HISTORY_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshFromServer);
    return () => {
      window.removeEventListener(CHAT_HISTORY_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshFromServer);
    };
  }, [replaceAll]);

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
    const attRefs = composer.getAttachmentRefs();
    if ((!trimmed && attRefs.length === 0) || inflight || composer.isUploading) return;
    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content: trimmed || "（图片）",
      attachments: attRefs.length > 0
        ? attRefs.map(r => ({ id: r.id, url: r.url, mime: r.mime, width: r.width, height: r.height }))
        : undefined,
    };
    append(userMsg);
    setInput("");
    // 把附件绑到 message
    for (const ref of attRefs) {
      void fetch(`/api/chat/attachments/${ref.id}/bind`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: userMsg.id }),
      }).catch(() => { /* 不影响发送 */ });
    }
    composer.clear();

    // History sent to Hermes — everything so far including the new user msg.
    const history = [...messages, userMsg].map(m => ({
      role: m.role, content: m.content,
    }));

    // Push an empty pending assistant message that we'll stream into.
    append({ id: nextId(), role: "assistant", content: "", pending: true, tools: [] });
    setInflight(true);
    // T06/T07/T08 —— 立即切 Mascot 到 thinking（user 感知线，跟服务端 mascot
    // 事件兜底叠加。任一方先到都生效，state machine 防抖）
    dispatchMascotEvent({ type: "user-send" });
    // T18 性能埋点：记录回车的时刻
    const reqId = newReqId();
    markChatSendStart(reqId);
    markMascotFirstFrame(reqId);   // 实际上跟 send 同一 tick，L1 ≈ 0
    let firstTextChunkSeen = false;

    try {
      const r = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: DEFAULT_CHAT_CONVERSATION_ID,
          surface: "chat-overlay",
          messages: history,
          attachments: attRefs.length > 0
            ? attRefs.map(r => ({ id: r.id, mime: r.mime }))
            : undefined,
        }),
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
              if (!firstTextChunkSeen) {
                firstTextChunkSeen = true;
                dispatchMascotEvent({ type: "first-text-chunk" });
                markFirstTextChunk(reqId);   // T18: 上报首字延迟
              }
            } else if (currentEvent === "tool") {
              const t = parsed as { name: string; status: "running" | "completed" };
              pushTool({ name: t.name, status: t.status, ts: Date.now() });
              dispatchMascotEvent({ type: "tool-progress", tool: t.name });
            } else if (currentEvent === "mascot") {
              // 服务端推的状态（T02 兜底首帧 mascot:thinking）
              const m = parsed as { state: import("../lib/mascotEvents.js").MascotState };
              if (m.state) dispatchMascotEvent({ type: "server-push", state: m.state });
            } else if (currentEvent === "done") {
              patchLast({ pending: false });
              dispatchMascotEvent({ type: "done" });
              // T15: 把 assistant 消息里的所有视觉块持久化（异步，不阻塞 UI）
              const lastMsg = useChatStore.getState().messages.at(-1);
              if (lastMsg?.role === "assistant" && lastMsg.content) {
                void persistVisualBlocks(lastMsg.id, lastMsg.content);
              }
            } else if (currentEvent === "error") {
              const { message } = parsed as { message: string };
              patchLast({ pending: false, error: message });
              dispatchMascotEvent({ type: "error", message });
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      patchLast({ pending: false, error: message });
      dispatchMascotEvent({ type: "error", message });
    } finally {
      setInflight(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitSlashCommand()) return;
    void send(input);
  }
  function syncOverlayInput(el: HTMLTextAreaElement, inputType?: string) {
    if (inputType === "insertFromDictation") {
      lastDictationInputAtRef.current = Date.now();
    }
    setInput(el.value);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (slash.active && slashItems.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setSlashIndex(i => (i + delta + slashItems.length) % slashItems.length);
      return;
    }
    // Enter sends; Shift+Enter inserts newline.
    if (e.key === "Enter" && !e.shiftKey) {
      const justDictated = Date.now() - lastDictationInputAtRef.current < 1200;
      if (e.nativeEvent.isComposing || composingRef.current || justDictated) return;
      e.preventDefault();
      if (submitSlashCommand()) return;
      void send(input);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (slash.active) {
        setInput("");
        return;
      }
      // Forward to Electron host via custom event — main process listens and
      // hides the window. The conversation stays alive in the store.
      window.dispatchEvent(new CustomEvent("ke.chat.close"));
    }
  }

  // Esc anywhere closes the window (not just textarea).
  useEffect(() => {
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) window.dispatchEvent(new CustomEvent("ke.chat.close"));
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
        <form
          className="chat-input"
          onSubmit={onSubmit}
          onDragOver={e => {
            if (e.dataTransfer?.types?.includes("Files")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={e => {
            const images = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith("image/"));
            if (images.length === 0) return;
            e.preventDefault();
            for (const f of images) {
              void composer.attach(f).catch(err => console.warn("[chat-input] attach:", err));
            }
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onBeforeInput={e => {
              const native = e.nativeEvent as InputEvent;
              if (native.inputType === "insertFromDictation") {
                lastDictationInputAtRef.current = Date.now();
              }
            }}
            onInput={e => {
              const native = e.nativeEvent as InputEvent;
              syncOverlayInput(e.currentTarget, native.inputType);
            }}
            onChange={e => syncOverlayInput(e.target)}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={e => {
              composingRef.current = false;
              syncOverlayInput(e.currentTarget);
            }}
            onPaste={e => {
              const imgItem = Array.from(e.clipboardData?.items ?? []).find(it => it.type.startsWith("image/"));
              if (!imgItem) return;
              const file = imgItem.getAsFile();
              if (!file) return;
              e.preventDefault();
              void composer.attach(file).catch(err => console.warn("[chat-input] paste:", err));
            }}
            onKeyDown={onKeyDown}
            placeholder={inflight ? "Hermes 正在思考，可以继续追问..." : ""}
            rows={1}
            autoFocus
          />
          <div className="chat-input-actions">
            <button
              type="button"
              className="chat-pill"
              onClick={() => fileInputRef.current?.click()}
              disabled={composer.isFull}
              title={composer.isFull ? "已达上限" : "附加图片"}
            >📎</button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={e => {
                const files = Array.from(e.target.files ?? []);
                for (const f of files) {
                  void composer.attach(f).catch(err => console.warn("[chat-input] picker:", err));
                }
                e.target.value = "";
              }}
            />
            {messages.length > 0 && (
              <>
                <button type="button" className="chat-pill"
                  onClick={() => setHistoryOpen(true)} title="历史回看（三栏）">
                  📜 历史
                </button>
                <button type="button" className="chat-pill" onClick={reset} title="清空对话">清空</button>
              </>
            )}
            <button
              type="submit"
              className="chat-send"
              disabled={(!input.trim() && composer.attachments.length === 0) || inflight || composer.isUploading}
              title="发送 (Enter)"
            >
              {inflight ? "···" : "↵"}
            </button>
          </div>

          {slash.active && (
            <SlashCommandPanel
              mode={slash.mode}
              query={slash.query}
              items={slashItems}
              activeKey={slashItems[slashIndex]?.key}
              onChoose={chooseSlashItem}
            />
          )}

          {/* 缩略图条放在文字框下面（用户审美偏好） */}
          {composer.attachments.length > 0 && (
            <div className="chat-input-attachments" aria-label="已附加的图片">
              {composer.attachments.map(a => (
                <div
                  key={a.clientId}
                  className={`chat-input-thumb chat-input-thumb--${a.state}`}
                  title={a.state === "failed" ? a.error : a.mime}
                >
                  <img src={a.previewUrl} alt="" draggable={false} className="is-zoomable" />
                  {a.state === "uploading" && <span className="chat-input-thumb__spinner" aria-hidden="true">⌛</span>}
                  {a.state === "failed" && <span className="chat-input-thumb__err" aria-hidden="true">!</span>}
                  <button
                    type="button"
                    className="chat-input-thumb__remove"
                    onClick={() => composer.detach(a.clientId)}
                    aria-label="移除"
                  >×</button>
                </div>
              ))}
            </div>
          )}
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
      {historyOpen && <ChatHistoryView onBack={() => setHistoryOpen(false)} />}
    </div>
  );
}

function SlashCommandPanel({
  mode,
  query,
  items,
  activeKey,
  onChoose,
}: {
  mode: SlashMode | null;
  query: string;
  items: SlashItem[];
  activeKey?: string;
  onChoose(item: SlashItem): void;
}) {
  const modes = items.filter((item): item is Extract<SlashItem, { kind: "mode" }> => item.kind === "mode");
  const apps = items.filter((item): item is Extract<SlashItem, { kind: "app" }> => item.kind === "app");
  const elements = items.filter((item): item is Extract<SlashItem, { kind: "element" }> => item.kind === "element");
  const modeLabel = SLASH_MODES.find(item => item.id === mode)?.label ?? "命令模式";

  return (
    <div className="chat-slash" role="listbox" aria-label="快捷模式">
      <header className="chat-slash-head">
        <span className="chat-slash-kicker">/</span>
        <span>{mode ? modeLabel : "搜索 / 选择"}</span>
        <em>{query ? `搜索：${query}` : "输入关键词找应用 / 元，↑↓ 切换，Enter 打开"}</em>
      </header>

      {modes.length > 0 && (
        <section className="chat-slash-section chat-slash-section--modes" aria-label="模式">
          {modes.map(item => (
            <button
              key={item.key}
              type="button"
              className={`chat-slash-mode${item.key === activeKey ? " is-active" : ""}`}
              onClick={() => onChoose(item)}
            >
              <strong>{item.mode.label}</strong>
              <span>{item.mode.hint}</span>
            </button>
          ))}
        </section>
      )}

      {(apps.length > 0 || elements.length > 0) && (
        <section className="chat-slash-section" aria-label="搜索结果">
          {apps.length > 0 && <p className="chat-slash-label">应用</p>}
          {apps.map(item => (
            <button
              key={item.key}
              type="button"
              className={`chat-slash-row chat-slash-row--${item.app.tone}${item.key === activeKey ? " is-active" : ""}`}
              onClick={() => onChoose(item)}
            >
              <span className="chat-slash-icon"><Icon name={item.app.icon} /></span>
              <span className="chat-slash-main">
                <strong>{item.app.label}</strong>
                <small>{item.app.desc}</small>
              </span>
              <span className="chat-slash-go">打开</span>
            </button>
          ))}

          {elements.length > 0 && <p className="chat-slash-label">元内信息</p>}
          {elements.map(item => (
            <button
              key={item.key}
              type="button"
              className={`chat-slash-row chat-slash-row--element${item.key === activeKey ? " is-active" : ""}`}
              onClick={() => onChoose(item)}
            >
              <span className="chat-slash-icon"><Icon name={iconForElement(item.element.type, item.element.title)} /></span>
              <span className="chat-slash-main">
                <strong>{item.element.title}</strong>
                <small>{item.element.subtitle || [item.element.type, item.element.tags?.slice(0, 2).join(" / ")].filter(Boolean).join(" · ")}</small>
              </span>
              <span className="chat-slash-go">跳转</span>
            </button>
          ))}
        </section>
      )}

      {items.length === 0 && (
        <div className="chat-slash-empty">没找到匹配项，换个关键词试试。</div>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  return (
    <article className={`chat-msg chat-msg--${message.role}${message.pending ? " is-pending" : ""}${message.error ? " has-error" : ""}`}>
      <span className="chat-msg-role">{message.role === "user" ? "你" : "Hermes"}</span>
      <div className="chat-msg-body">
        {/* 用户附加的图片（V0.1 仅 user 消息） */}
        {message.role === "user" && (message.attachments?.length ?? 0) > 0 && (
          <div className="chat-msg-attachments">
            {message.attachments!.map(att => (
              <img
                key={att.id}
                src={attachmentDataUrl(att)}
                alt=""
                draggable={false}
                className="chat-msg-attachment is-zoomable"
                title="点击查看原图"
              />
            ))}
          </div>
        )}
        {message.content && message.content !== "（图片）" && (
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
