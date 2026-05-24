import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { RichContent } from "../components/RichContent.js";
import "../components/RichContent.css";
import {
  CHAT_HISTORY_STORAGE_KEY,
  CHAT_HISTORY_UPDATED_EVENT,
  loadChatHistory,
  saveChatHistory,
  type ChatHistoryMessage,
} from "../lib/chatHistory.js";
import { IronManFlight } from "./IronManFlight.js";
import walk0 from "../assets/mascot/walk-0.png";
import walk1 from "../assets/mascot/walk-1.png";
import walk2 from "../assets/mascot/walk-2.png";
import walk3 from "../assets/mascot/walk-3.png";
import "./HomeView.css";

/**
 * HomeView — Rich's cinematic landing page.
 *
 * Replaces the previous InputView as the default home (when appView===tree
 * AND no rootId). Layout:
 *
 *   ┌──────────────────────────────────┐
 *   │      [ animated mascot ]         │  ← top half: presentation surface
 *   │                                  │     (currently just the walk cycle;
 *   │                                  │      future: avatar / video / etc.)
 *   ├─────[ input box on midline ]─────┤  ← middle: user → Rich input
 *   │                                  │
 *   │  Rich's streamed reply           │  ← bottom half: response area
 *   │                                  │
 *   └──────────────────────────────────┘
 *
 * Input pipes to Hermes via /api/chat/stream — same backend as the global
 * Cmd+Shift+Space chat overlay. Tool calls, text deltas, errors all
 * appear in the bottom half in real time. The thread is shared with the
 * global Cmd+Shift+Space chat overlay via localStorage.
 *
 * Quick-jump buttons (top right) still surface the other entry points so
 * the user can reach the old InputView, tree, news, etc.
 */

const WALK_FRAMES = [walk0, walk1, walk2, walk3];

/** Animation catalogue — server defines the names, we define the look.
 *  Each entry maps to CSS class `home-mascot--<name>`; tweak the visual
 *  in HomeView.css (glow color / scale / bob amplitude / particles). */
type MascotName =
  | "walk" | "idle" | "celebrate" | "think" | "happy"
  | "sad" | "alert" | "sleep" | "dance" | "wave" | "transform" | "ironman";

interface MascotState {
  current: MascotName;
  fallback: MascotName;
  startedAt: string;
  durationMs?: number;
  triggeredBy: "hermes" | "user" | "system";
}

/** Per-animation frame rate (ms between sprite swaps). Loop-style animations
 *  cycle through walk-0..walk-3; one-shots may freeze on a single frame and
 *  rely on CSS effects (scale / rotate / glow). */
const FPS_MS: Record<MascotName, number> = {
  walk: 180, idle: 600, celebrate: 90, think: 360, happy: 140,
  sad: 480, alert: 100, sleep: 1200, dance: 80, wave: 200, transform: 60,
  ironman: 999_999, // sprite hidden during this sequence; FPS irrelevant
};

type Turn = ChatHistoryMessage;
interface ChatPair {
  id: string;
  index: number;
  question: Turn;
  answer?: Turn;
}

function nextId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function shouldDance(text: string) {
  return /跳舞|跳个舞|小人跳|dance/i.test(text);
}

function buildChatPairs(turns: Turn[], limit = 50): ChatPair[] {
  const pairs: ChatPair[] = [];
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.role !== "user") continue;
    let answer: Turn | undefined;
    for (let j = i + 1; j < turns.length; j++) {
      if (turns[j].role === "user") break;
      if (turns[j].role === "assistant") {
        answer = turns[j];
        break;
      }
    }
    pairs.push({
      id: `${turn.id}-${answer?.id ?? "pending"}`,
      index: pairs.length + 1,
      question: turn,
      answer,
    });
  }
  return pairs.slice(-limit).reverse();
}

function messageTime(turn: Turn | undefined): number | null {
  if (!turn) return null;
  if (typeof turn.createdAt === "number") return turn.createdAt;
  const prefix = turn.id.split("-")[0];
  const parsed = Number.parseInt(prefix, 36);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatHistoryTime(turn: Turn | undefined): string {
  const ts = messageTime(turn);
  if (!ts) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function HomeView() {
  const [frame, setFrame] = useState(0);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>(() => loadChatHistory());
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mascot, setMascot] = useState<MascotState>({
    current: "walk", fallback: "walk",
    startedAt: new Date().toISOString(), triggeredBy: "system",
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const historyPointerToggledRef = useRef(false);
  // Hidden span that mirrors the typed text — its rendered width drives
  // where the custom underline caret sits. Same font / line-height /
  // letter-spacing as the textarea, so the measurement lines up to the pixel.
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [petX, setPetX] = useState(0);
  const [petY, setPetY] = useState(0);
  const chatPairs = useMemo(() => buildChatPairs(turns), [turns]);

  useEffect(() => {
    setHistoryOpen(false);
  }, []);

  // Initial fetch of mascot state, then live updates via the shared SSE
  // channel (/api/events). Any code path (REST or MCP) that publishes
  // `mascot.changed` triggers a refetch — we don't bother diff-applying
  // because the state is tiny.
  useEffect(() => {
    const refetch = () => {
      fetch("/api/mascot/state")
        .then(r => r.ok ? r.json() : null)
        .then(s => { if (s) setMascot(s); })
        .catch(() => { /* offline — keep current */ });
    };
    refetch();
    const es = new EventSource("/api/events");
    const onChange = () => refetch();
    es.addEventListener("change", onChange);
    return () => { es.close(); };
  }, []);

  // Mascot walk-cycle: swap sprite frames at a tempo dictated by the current
  // animation. Pure JS state (rather than CSS `steps()` animation) keeps the
  // same sprite set reusable at multiple sizes; the per-animation visual
  // effects (glow / bob amplitude / particles) live in CSS keyed off the
  // `home-mascot--<name>` class on the wrapper.
  useEffect(() => {
    const ms = FPS_MS[mascot.current] ?? 180;
    const id = window.setInterval(
      () => setFrame(f => (f + 1) % WALK_FRAMES.length),
      ms,
    );
    return () => window.clearInterval(id);
  }, [mascot.current]);

  // Newest message renders at the TOP (right under the input box), so
  // auto-scroll to scrollTop=0 on every update — keeps the live token
  // stream visible without the user chasing it.
  useEffect(() => {
    bottomRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    const refresh = () => setTurns(loadChatHistory({ preservePending: true }));
    const onStorage = (e: StorageEvent) => {
      if (e.key === CHAT_HISTORY_STORAGE_KEY) refresh();
    };
    window.addEventListener(CHAT_HISTORY_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHAT_HISTORY_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Auto-grow textarea: shrink-to-content first, then size to scrollHeight.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Underline-caret position. Measure the typed text in a hidden span (same
  // font as the textarea) to know where the caret should sit. For multi-line
  // input we measure only the LAST line's width and shift the pet down
  // by (lines - 1) × lineHeight so it tracks line wrapping too.
  useEffect(() => {
    const m = measureRef.current;
    if (!m) return;
    const lines = input.split("\n");
    const lastLine = lines[lines.length - 1];
    // Empty-line case: measure a single space so the pet has a stable
    // starting offset; otherwise an empty span has width 0 and the pet
    // would jump to the far left edge on the first keystroke.
    m.textContent = lastLine.length > 0 ? lastLine : "";
    setPetX(m.offsetWidth);
    const cs = window.getComputedStyle(m);
    const lh = parseFloat(cs.lineHeight) || 26;
    setPetY((lines.length - 1) * lh);
  }, [input]);

  useEffect(() => {
    const isTypingSurface = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest("input, textarea, select, button, a, [contenteditable='true'], [role='menuitem']"));
    };
    const insertAtCursor = (text: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? input.length;
      const end = el.selectionEnd ?? start;
      setInput(prev => `${prev.slice(0, start)}${text}${prev.slice(end)}`);
      window.requestAnimationFrame(() => {
        el.focus();
        const next = start + text.length;
        el.setSelectionRange(next, next);
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (isTypingSurface(event.target)) return;
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingSurface(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;
      event.preventDefault();
      insertAtCursor(event.key);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [input]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (shouldDance(trimmed)) {
      const dancing: MascotState = {
        current: "dance",
        fallback: mascot.fallback || "walk",
        startedAt: new Date().toISOString(),
        triggeredBy: "user",
      };
      setMascot(dancing);
      void fetch("/api/mascot/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "dance" }),
      }).catch(() => { /* local animation already started */ });
    }
    const now = Date.now();
    const userTurn: Turn = {
      id: nextId(), role: "user", content: trimmed, tools: [], pending: false, createdAt: now,
    };
    const assistantTurn: Turn = {
      id: nextId(), role: "assistant", content: "", tools: [], pending: true, createdAt: now,
    };
    const baseTurns = loadChatHistory();
    const nextTurns = [...baseTurns, userTurn, assistantTurn];
    setTurns(nextTurns);
    saveChatHistory(nextTurns);
    setHistoryOpen(true);
    setInput("");
    setBusy(true);

    // Build history-to-send: all prior turns + new user message. We don't
    // send the empty assistant placeholder we just appended; only the
    // canonical conversation Hermes needs to reason about.
    const history = [...baseTurns, userTurn].map(t => ({ role: t.role, content: t.content }));

    try {
      const r = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!r.ok || !r.body) throw new Error(`chat failed: ${r.status}`);
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
              setTurns(prev => {
                const next = prev.map((t, i) =>
                  i === prev.length - 1 ? { ...t, content: t.content + chunk } : t,
                );
                saveChatHistory(next);
                return next;
              });
            } else if (currentEvent === "tool") {
              const tev = parsed as { name: string; status: "running" | "completed" };
              setTurns(prev => {
                const next = prev.slice();
                const i = next.length - 1;
                const t = next[i];
                if (!t) return prev;
                const tools = [...(t.tools ?? [])];
                if (tev.status === "completed") {
                  // Update the most recent matching "running" entry to "completed".
                  for (let k = tools.length - 1; k >= 0; k--) {
                    if (tools[k].name === tev.name && tools[k].status === "running") {
                      tools[k] = { ...tev, ts: Date.now() };
                      next[i] = { ...t, tools };
                      saveChatHistory(next);
                      return next;
                    }
                  }
                }
                tools.push({ ...tev, ts: Date.now() });
                next[i] = { ...t, tools };
                saveChatHistory(next);
                return next;
              });
            } else if (currentEvent === "done") {
              setTurns(prev => {
                const next = prev.map((t, i) =>
                  i === prev.length - 1 ? { ...t, pending: false } : t,
                );
                saveChatHistory(next);
                return next;
              });
            } else if (currentEvent === "error") {
              const { message } = parsed as { message: string };
              setTurns(prev => {
                const next = prev.map((t, i) =>
                  i === prev.length - 1 ? { ...t, pending: false, error: message } : t,
                );
                saveChatHistory(next);
                return next;
              });
            }
          }
        }
      }
    } catch (err) {
      setTurns(prev => {
        const next = prev.map((t, i) =>
          i === prev.length - 1
            ? { ...t, pending: false, error: err instanceof Error ? err.message : String(err) }
            : t,
        );
        saveChatHistory(next);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send(input);
  }

  function toggleHistory() {
    setHistoryOpen(open => !open);
  }

  return (
    <div className="home-view">
      {/* Invisible drag strip across the top of the window. Native
       *  titleBarStyle is "hiddenInset" — without an explicit drag region
       *  the user can't move the window or double-click to maximize.
       *  Interactive children (quick-jump buttons, mascot eventually) are
       *  marked `-webkit-app-region: no-drag` in CSS so they stay clickable. */}
      <div className="home-drag-bar" aria-hidden="true" />

      {/* Navigation entirely lives in the bottom-left MascotDock — no
       *  top-right quick-jump on this page anymore. */}
      <button
        type="button"
        className={`home-history-toggle${historyOpen ? " is-open" : ""}`}
        aria-label={historyOpen ? "隐藏聊天历史" : "查看聊天历史"}
        title={historyOpen ? "隐藏聊天历史" : "查看聊天历史"}
        onClick={() => {
          if (historyPointerToggledRef.current) {
            historyPointerToggledRef.current = false;
            return;
          }
          toggleHistory();
        }}
        onPointerDown={e => {
          e.preventDefault();
          historyPointerToggledRef.current = true;
          toggleHistory();
        }}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleHistory();
          }
        }}
      >
        <span aria-hidden="true">≡</span>
      </button>

      {/* Top half — presentation surface. The wrapper carries the
       *  `home-mascot--<name>` class so each animation gets its own
       *  glow color / scale / bob amplitude / particle layer from CSS. */}
      <section className="home-stage" aria-hidden="true">
        <div className="home-scan-grid" />
        {mascot.current === "ironman" ? (
          // Iron Man owns the whole stage for 30s. `key` bound to startedAt
          // so re-triggering the same animation replays it cleanly (React
          // remounts the subtree → CSS keyframes restart from 0%).
          <IronManFlight key={mascot.startedAt} />
        ) : (
          <div className={`home-mascot-wrap home-mascot--${mascot.current}`}>
            <div className="home-mascot-glow" />
            <img
              src={WALK_FRAMES[frame]}
              alt=""
              className="home-mascot-sprite"
              draggable={false}
            />
            <div className="home-mascot-shadow" />
            <div className="home-mascot-particles" aria-hidden="true" />
          </div>
        )}
      </section>

      {/* Middle — input bar. Single column, no send button at all —
       *  press Enter to send. Native caret is hidden; a static underline
       *  sits at the end of the typed text, positioned via the measure span. */}
      <form className="home-input" onSubmit={onSubmit}>
        {/* Hidden measurement span — its rendered width drives the pet
         *  caret's left offset. Must use the same font / line-height /
         *  letter-spacing as the textarea (set in .home-input-measure). */}
        <span ref={measureRef} className="home-input-measure" aria-hidden="true" />
        <span
          className="home-input-pet"
          aria-hidden="true"
          style={{ transform: `translate(${petX}px, ${petY}px)` }}
        />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder=""
          rows={1}
          autoFocus
        />
        {/* Hidden submit so Enter inside textarea still triggers form onSubmit. */}
        <button type="submit" disabled={busy || !input.trim()} aria-hidden="true" tabIndex={-1} />
      </form>

      <section
        ref={bottomRef}
        className={`home-history${historyOpen ? " is-open" : " is-hidden"}`}
        aria-live="polite"
        aria-hidden={!historyOpen}
      >
        {historyOpen && (
          <ChatHistoryPanel pairs={chatPairs} />
        )}
      </section>
    </div>
  );
}

function ChatHistoryPanel({ pairs }: { pairs: ChatPair[] }) {
  const [activeId, setActiveId] = useState(() => pairs[0]?.id ?? "");
  const questionRefs = useRef(new Map<string, HTMLButtonElement>());
  const answerRefs = useRef(new Map<string, HTMLElement>());
  const answerPaneRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    setActiveId(current => pairs.some(pair => pair.id === current) ? current : pairs[0]?.id ?? "");
  }, [pairs]);

  useEffect(() => {
    const el = activeId ? questionRefs.current.get(activeId) : null;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function scrollToPair(id: string) {
    const target = answerRefs.current.get(id);
    const pane = answerPaneRef.current;
    if (!target || !pane) return;
    syncingRef.current = true;
    setActiveId(id);
    const targetTop = target.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
    pane.scrollTo({
      top: targetTop - 8,
      behavior: "smooth",
    });
    window.setTimeout(() => { syncingRef.current = false; }, 360);
  }

  function syncFromAnswerScroll() {
    if (syncingRef.current) return;
    const pane = answerPaneRef.current;
    if (!pane) return;
    const paneTop = pane.getBoundingClientRect().top;
    let nextId = pairs[0]?.id ?? "";
    for (const pair of pairs) {
      const el = answerRefs.current.get(pair.id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top - paneTop;
      if (top <= 24) nextId = pair.id;
      else break;
    }
    setActiveId(nextId);
  }

  return (
    <div className="home-history-split">
      <div className="home-history-questions" aria-label="你的问题历史">
        {pairs.map(pair => (
          <button
            key={pair.id}
            ref={el => {
              if (el) questionRefs.current.set(pair.id, el);
              else questionRefs.current.delete(pair.id);
            }}
            type="button"
            className={`home-history-question${activeId === pair.id ? " is-active" : ""}`}
            onClick={() => scrollToPair(pair.id)}
          >
            <span className="home-history-question__meta">
              <em>#{String(pair.index).padStart(2, "0")}</em>
              {formatHistoryTime(pair.question) && <time>{formatHistoryTime(pair.question)}</time>}
            </span>
            <span className="home-history-question__text">{pair.question.content}</span>
          </button>
        ))}
      </div>

      <div
        ref={answerPaneRef}
        className="home-history-answers"
        aria-label="Rich 的回答历史"
        onScroll={syncFromAnswerScroll}
      >
        {pairs.map(pair => (
          <AnswerHistoryRow
            key={pair.id}
            pair={pair}
            active={activeId === pair.id}
            setRef={el => {
              if (el) answerRefs.current.set(pair.id, el);
              else answerRefs.current.delete(pair.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AnswerHistoryRow({
  pair,
  active,
  setRef,
}: {
  pair: ChatPair;
  active: boolean;
  setRef: (el: HTMLElement | null) => void;
}) {
  const answer = pair.answer;
  return (
    <article
      ref={setRef}
      className={`home-history-answer${active ? " is-active" : ""}${answer?.pending ? " is-pending" : ""}${answer?.error ? " has-error" : ""}`}
    >
      <header className="home-history-answer__head">
        <span>Rich</span>
        <div>
          {formatHistoryTime(answer ?? pair.question) && <time>{formatHistoryTime(answer ?? pair.question)}</time>}
          {answer?.pending && <em>进行中</em>}
        </div>
      </header>
      <div className="home-history-answer__body">
        {answer?.content ? (
          <>
            <RichContent text={answer.content} />
            {answer.pending && <span className="home-cursor">▍</span>}
          </>
        ) : answer?.pending ? (
          <div className="home-turn-thinking">Rich 正在思考...</div>
        ) : (
          <div className="home-turn-thinking">等待回应...</div>
        )}
        {answer?.error && <div className="home-turn-error">{answer.error}</div>}
      </div>
    </article>
  );
}
