import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import { searchElements } from "../views/InputView.js";
import { elementTypeClass, elementTypeLabel } from "./elementLabels.js";
import "./CommandPalette.css";

/**
 * Global command palette — toggled by Cmd/Ctrl+K. Shows
 * a search input + live element matches. Pressing Enter on a non-empty input
 * kicks off an AI 搜索 (analyze-input) in the background; the resulting tab
 * lands on the home view and the search becomes a task in the task list.
 *
 * Mounted at the App level so it's available regardless of current view.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const elements = useStore(s => s.elements);
  const enterAtElement = useStore(s => s.enterAtElement);
  const startHomeAnalysis = useStore(s => s.startHomeAnalysis);
  const setHomeAnalysisResult = useStore(s => s.setHomeAnalysisResult);
  const setHomeAnalysisError = useStore(s => s.setHomeAnalysisError);

  // Open via Cmd/Ctrl+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "k" || e.key === "K" || e.code === "KeyK") {
        e.preventDefault();
        setOpen(v => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-focus input when palette opens.
  useEffect(() => {
    if (!open) { setQ(""); return; }
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  // Close on Escape (when input is focused).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const hits = useMemo(
    () => q.trim() ? searchElements(q, elements.values(), 8) : [],
    [q, elements],
  );

  function submitAiSearch() {
    const raw = q.trim();
    if (!raw) return;
    const sessionId = startHomeAnalysis(raw);
    setOpen(false);
    setQ("");
    // Fire-and-forget — task appears in task list with status="running",
    // user can keep working in other views.
    void (async () => {
      try {
        const result = await api.analyzeInput(raw, "codex");
        setHomeAnalysisResult(sessionId, result);
      } catch (err) {
        setHomeAnalysisError(sessionId, err instanceof Error ? err.message : String(err));
      }
    })();
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="cmd-palette" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
      <div className="cmd-palette__panel" onClick={e => e.stopPropagation()}>
        <div className="cmd-palette__head">
          <span className="cmd-palette__icon" aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); submitAiSearch(); }
            }}
            placeholder="搜索元 · 回车发起 AI 搜索（结果会变成一个任务）"
          />
          <span className="cmd-palette__hint">Cmd K · Esc</span>
        </div>
        {q.trim() && (
          <div className="cmd-palette__results">
            {hits.length === 0 ? (
              <div className="cmd-palette__empty">没匹配到现有元 · 回车让 AI 帮你找位置</div>
            ) : (
              hits.map(hit => (
                <button
                  key={hit.element.id}
                  type="button"
                  className={`cmd-palette__item ${elementTypeClass(hit.element.type)}`}
                  onClick={() => {
                    void enterAtElement(hit.element.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="cmd-palette__item-type">{elementTypeLabel(hit.element.type)}</span>
                  <strong>{hit.element.title}</strong>
                  {hit.element.subtitle && <em>{hit.element.subtitle}</em>}
                </button>
              ))
            )}
            <div className="cmd-palette__footer">
              <span>↵ 回车发起 AI 搜索「{q.trim()}」</span>
              <button type="button" className="cmd-palette__ai-btn" onClick={submitAiSearch}>
                AI 搜索 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
