import { useEffect, useRef, useState, type FormEvent } from "react";
import { RichContent } from "../components/RichContent.js";
import "../components/RichContent.css";
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
 * appear in the bottom half in real time. Session is per-HomeView mount;
 * leaving the home page resets the visible thread.
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

type Role = "user" | "assistant";
interface Turn {
  id: string;
  role: Role;
  content: string;
  tools: Array<{ name: string; status: "running" | "completed" }>;
  pending: boolean;
  error?: string;
}

function nextId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export function HomeView() {
  const [frame, setFrame] = useState(0);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [mascot, setMascot] = useState<MascotState>({
    current: "walk", fallback: "walk",
    startedAt: new Date().toISOString(), triggeredBy: "system",
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Hidden span that mirrors the typed text — its rendered width drives
  // where the custom "pet caret" sits. Same font / line-height / letter-
  // spacing as the textarea, so the measurement lines up to the pixel.
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [petX, setPetX] = useState(0);
  const [petY, setPetY] = useState(0);

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

  // Auto-grow textarea: shrink-to-content first, then size to scrollHeight.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Pet-caret position. Measure the typed text in a hidden span (same font
  // as the textarea) to know where the pet should sit. For multi-line
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

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const userTurn: Turn = {
      id: nextId(), role: "user", content: trimmed, tools: [], pending: false,
    };
    const assistantTurn: Turn = {
      id: nextId(), role: "assistant", content: "", tools: [], pending: true,
    };
    setTurns(prev => [...prev, userTurn, assistantTurn]);
    setInput("");
    setBusy(true);

    // Build history-to-send: all prior turns + new user message. We don't
    // send the empty assistant placeholder we just appended; only the
    // canonical conversation Hermes needs to reason about.
    const history = [...turns, userTurn].map(t => ({ role: t.role, content: t.content }));

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
              setTurns(prev => prev.map((t, i) =>
                i === prev.length - 1 ? { ...t, content: t.content + chunk } : t,
              ));
            } else if (currentEvent === "tool") {
              const tev = parsed as { name: string; status: "running" | "completed" };
              setTurns(prev => prev.map((t, i) => {
                if (i !== prev.length - 1) return t;
                const tools = [...t.tools];
                if (tev.status === "completed") {
                  // Update the most recent matching "running" entry to "completed".
                  for (let k = tools.length - 1; k >= 0; k--) {
                    if (tools[k].name === tev.name && tools[k].status === "running") {
                      tools[k] = tev;
                      return { ...t, tools };
                    }
                  }
                }
                tools.push(tev);
                return { ...t, tools };
              }));
            } else if (currentEvent === "done") {
              setTurns(prev => prev.map((t, i) =>
                i === prev.length - 1 ? { ...t, pending: false } : t,
              ));
            } else if (currentEvent === "error") {
              const { message } = parsed as { message: string };
              setTurns(prev => prev.map((t, i) =>
                i === prev.length - 1 ? { ...t, pending: false, error: message } : t,
              ));
            }
          }
        }
      }
    } catch (err) {
      setTurns(prev => prev.map((t, i) =>
        i === prev.length - 1
          ? { ...t, pending: false, error: err instanceof Error ? err.message : String(err) }
          : t,
      ));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send(input);
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
       *  press Enter to send. Native caret is hidden; a blinking 🐶 sits
       *  at the end of the typed text, positioned via the measure span. */}
      <form className="home-input" onSubmit={onSubmit}>
        {/* Hidden measurement span — its rendered width drives the pet
         *  caret's left offset. Must use the same font / line-height /
         *  letter-spacing as the textarea (set in .home-input-measure). */}
        <span ref={measureRef} className="home-input-measure" aria-hidden="true" />
        <span
          className="home-input-pet"
          aria-hidden="true"
          style={{ transform: `translate(${petX}px, ${petY}px)` }}
        >
          ▸
        </span>
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

      {/* Bottom half — Rich's reply stream. No empty-state hints — when
       *  the user lands fresh, the bottom is simply blank space. Cleaner. */}
      <section ref={bottomRef} className="home-reply" aria-live="polite">
        {/* Newest first — latest reply sits at the visual top, closest to
         *  the input bar. Older history scrolls downward. */}
        {turns.slice().reverse().map(t => <TurnRow key={t.id} turn={t} />)}
      </section>
    </div>
  );
}

function TurnRow({ turn }: { turn: Turn }) {
  return (
    <article className={`home-turn home-turn--${turn.role}${turn.pending ? " is-pending" : ""}${turn.error ? " has-error" : ""}`}>
      <span className="home-turn-role">{turn.role === "user" ? "你" : "Rich"}</span>
      <div className="home-turn-body">
        {/* Tool-call pills (turn.tools) are intentionally NOT rendered —
         *  the user prefers a clean conversational surface. The data still
         *  arrives via SSE and lives on `turn.tools` for potential future
         *  use (debug panel / DevTools view), but isn't shown inline. */}
        {turn.content && (
          <div className="home-turn-content">
            <RichContent text={turn.content} />
            {turn.pending && <span className="home-cursor">▍</span>}
          </div>
        )}
        {!turn.content && turn.pending && (
          // Tools are hidden; this placeholder is now the only "Rich is
          // working" signal until the first text chunk arrives.
          <div className="home-turn-thinking">Rich 正在思考…</div>
        )}
        {turn.error && <div className="home-turn-error">⚠ {turn.error}</div>}
      </div>
    </article>
  );
}
