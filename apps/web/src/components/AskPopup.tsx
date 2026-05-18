import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { QARecord } from "@ke/domain";
import { api } from "../api/client.js";
import "./AskPopup.css";

type Anchor =
  | { type: "section"; sectionId: string }
  | { type: "annotation"; annotationId: string }
  | { type: "element" };

type Mode = "ask" | "feedback";

interface Props {
  elementId: string;
  anchor: Anchor;
  /** Short text shown in the popup header explaining what the question is about. */
  scopeLabel: string;
  /** Extra context to send to the AI (section excerpt or marked text). */
  contextText?: string;
  onClose: () => void;
  /** Called when an ask (Q&A) round completes — caller renders the QA inline. */
  onDone: (qa: QARecord) => void;
  /** Called when user submits a feedback. Receives the user's request text
   *  (with section scope already noted). The caller should trigger the AI
   *  feedback action that rewrites/expands the section accordingly. */
  onFeedback?: (text: string) => Promise<void> | void;
  /** Initial cursor position (relative to viewport) to anchor the popup. */
  position?: { x: number; y: number };
}

/**
 * Floating popup with two modes:
 *   - 答疑: ask AI a scoped Q&A question; streams answer; saved inline.
 *   - 反馈: submit a rewrite/feedback request for the section; the section
 *     will be regenerated according to user's instructions (e.g. "add an
 *     image", "rewrite as a checklist").
 */
export function AskPopup({ elementId, anchor, scopeLabel, contextText, onClose, onDone, onFeedback, position }: Props) {
  const [mode, setMode] = useState<Mode>("ask");
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 0); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submitAsk() {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setStreaming("");
    try {
      let buf = "";
      for await (const ev of api.askStream({ elementId, question: q, anchor, contextText, model: "codex" })) {
        if (ev.type === "delta") { buf += ev.text; setStreaming(buf); }
        else if (ev.type === "error") { setError(ev.message); setBusy(false); return; }
        else if (ev.type === "done") { onDone(ev.result.qa); onClose(); return; }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function submitFeedback() {
    const fb = text.trim();
    if (!fb || busy || !onFeedback) return;
    setBusy(true);
    setError(null);
    try {
      // The caller decides which feedback channel to use:
      //   - section anchor → server-side section-feedback (AI returns ONLY
      //     the new section JSON; server replaces by id; other sections are
      //     never touched).
      //   - element-wide → legacy whole-element feedback (AI rewrites all
      //     of content; bounded by hard constraints in the prompt).
      // We just hand off the user's text + the anchor; the caller does the
      // routing.
      await onFeedback(fb);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const submit = () => (mode === "ask" ? submitAsk() : submitFeedback());

  const WIDTH = 460;
  const HEIGHT_EST = streaming !== null ? 380 : 260;
  const x = position ? Math.min(Math.max(position.x, 12), window.innerWidth - WIDTH - 12) : window.innerWidth / 2 - WIDTH / 2;
  const y = position ? Math.min(Math.max(position.y, 12), window.innerHeight - HEIGHT_EST - 12) : window.innerHeight / 2 - HEIGHT_EST / 2;

  const askPlaceholder = "提个问题，AI 会基于该段落 / 标记内容回答。Cmd/Ctrl + Enter 提交。";
  const fbPlaceholder = "想怎么改？例如：加一张图、改成检查清单、补充实战例子……Cmd/Ctrl + Enter 提交。";

  return createPortal(
    <>
      <div className="ask-popup__backdrop" onClick={onClose} />
      <div className="ask-popup" style={{ left: x, top: y, width: WIDTH }} role="dialog">
        <header>
          <div className="ask-popup__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "ask"}
              className={`ask-popup__tab ${mode === "ask" ? "is-active" : ""}`}
              onClick={() => { setMode("ask"); setStreaming(null); setError(null); }}
              disabled={busy}
            >答疑</button>
            {onFeedback && (
              <button
                type="button"
                role="tab"
                aria-selected={mode === "feedback"}
                className={`ask-popup__tab ${mode === "feedback" ? "is-active" : ""}`}
                onClick={() => { setMode("feedback"); setStreaming(null); setError(null); }}
                disabled={busy}
              >反馈</button>
            )}
          </div>
          <span className="ask-popup__scope">{scopeLabel}</span>
          <button type="button" className="ask-popup__close" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={mode === "ask" ? askPlaceholder : fbPlaceholder}
          rows={3}
          disabled={busy}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        {mode === "ask" && streaming !== null && (
          <div className="ask-popup__stream">
            <strong>AI 回答</strong>
            <div className="ask-popup__answer">{streaming || "正在思考…"}</div>
          </div>
        )}
        {error && <div className="ask-popup__error">{error}</div>}
        <footer>
          <button type="button" className="ask-popup__submit" disabled={busy || !text.trim()} onClick={() => void submit()}>
            {busy
              ? (mode === "ask" ? "回答中…" : "提交中…")
              : (mode === "ask" ? "提问" : "提交反馈")}
          </button>
          <button type="button" className="ask-popup__cancel" onClick={onClose}>取消</button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
