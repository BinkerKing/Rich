import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Element } from "@ke/domain";
import { api } from "../api/client.js";
import { useStore } from "../state/store.js";
import "./components.css";

interface Props {
  element: Element;
  onClose: () => void;
}

interface Version { timestamp: string; element: Element }

function tryParseTs(stamp: string): Date | null {
  // backend file names use dash-separated ISO: 2026-05-16T17-51-50-978Z
  const iso = stamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, "T$1:$2:$3.$4Z");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatStamp(stamp: string): string {
  const d = tryParseTs(stamp);
  if (!d) return stamp;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function contentSummary(el: Element): string {
  const c = el.content as Record<string, unknown>;
  const candidates = ["oneSentence", "intro", "goal", "productPositioning"];
  for (const key of candidates) {
    const v = c?.[key];
    if (typeof v === "string" && v.trim()) return v.slice(0, 180);
  }
  return "（无内容预览）";
}

export function HistoryModal({ element, onClose }: Props) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reverting, setReverting] = useState<string | null>(null);
  const hydrate = useStore(s => s.hydrate);

  useEffect(() => {
    let cancelled = false;
    api.listVersions(element.id)
      .then(list => { if (!cancelled) setVersions(list); })
      .catch(e => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [element.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function doRevert(stamp: string) {
    if (!window.confirm(`确定回滚到 ${formatStamp(stamp)} 的版本？\n当前内容会先归档进历史，可再回滚回来。`)) return;
    setReverting(stamp);
    try {
      await api.revert(element.id, stamp);
      await hydrate();  // refresh elements cache
      onClose();
    } catch (e) {
      setError(`回滚失败：${String(e)}`);
    } finally {
      setReverting(null);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="history-modal"
        role="dialog"
        aria-label="元历史版本"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <div>
            <h2>历史版本</h2>
            <p>{element.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>

        {error && <div className="modal-error">{error}</div>}
        {!versions && !error && <div className="modal-loading">加载中…</div>}
        {versions && versions.length === 0 && (
          <div className="modal-empty">还没有历史版本——这是元的初始内容。</div>
        )}
        {versions && versions.length > 0 && (
          <ol className="history-list">
            {versions.map(v => (
              <li key={v.timestamp}>
                <div className="history-meta">
                  <strong>{formatStamp(v.timestamp)}</strong>
                  <span>richness {v.element.metadata.richness} · {v.element.metadata.aiModel ?? "未知模型"}</span>
                </div>
                <p className="history-preview">{contentSummary(v.element)}</p>
                <button
                  type="button"
                  className="history-revert"
                  disabled={reverting !== null}
                  onClick={() => void doRevert(v.timestamp)}
                >
                  {reverting === v.timestamp ? "回滚中…" : "回滚到这个版本"}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>,
    document.body,
  );
}
