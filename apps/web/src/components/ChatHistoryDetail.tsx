/**
 * Rich 首页动画展示系统 v0.1 —— T17 历史详情面板。
 *
 * 三栏历史里点任一行 → 弹出居中浮层显示完整问题 + 完整视觉块 + 完整文字答案。
 * 支持 ← → 翻页 + 复制 + ESC 关闭。
 */
import { useEffect, useRef, type ReactNode } from "react";
import { VisualBlockRenderer } from "./VisualBlockRenderer.js";
import { RichContent } from "./RichContent.js";
import type { HistoryRow } from "../views/ChatHistoryView.js";
import "./RichContent.css";
import "./ChatHistoryDetail.css";

interface Props {
  row: HistoryRow;
  rows: HistoryRow[];
  onClose: () => void;
  onNavigate: (r: HistoryRow) => void;
}

export function ChatHistoryDetail({ row, rows, onClose, onNavigate }: Props): ReactNode {
  const idx = rows.findIndex(r => r.key === row.key);
  const prev = idx > 0 ? rows[idx - 1] : null;
  const next = idx < rows.length - 1 ? rows[idx + 1] : null;
  const bodyRef = useRef<HTMLDivElement>(null);

  // ESC / ← / → 键盘导航
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      // 忽略 input/textarea 里的键
      const t = e.target;
      if (t instanceof HTMLElement && t.closest("input, textarea")) return;
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowLeft" && prev) { e.preventDefault(); onNavigate(prev); }
      else if (e.key === "ArrowRight" && next) { e.preventDefault(); onNavigate(next); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose, onNavigate]);

  // 切换 row 时把内容区滚回顶
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [row.key]);

  const copy = (text: string): void => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text);
  };

  return (
    <div className="chd" onClick={onClose} role="dialog" aria-modal="true">
      <div className="chd__card" onClick={e => e.stopPropagation()}>
        <header className="chd__head">
          <span className="chd__esc">ESC</span>
          <button type="button" className="chd__close" onClick={onClose} aria-label="关闭">×</button>
        </header>

        <div className="chd__body" ref={bodyRef}>
          <section className="chd__sec">
            <div className="chd__sec-label">问题</div>
            <div className="chd__question">{row.user?.content ?? "(空)"}</div>
            {row.ts > 0 && (
              <div className="chd__ts">{new Date(row.ts).toLocaleString("zh-CN")}</div>
            )}
          </section>

          {row.visualAscii.length > 0 && (
            <section className="chd__sec">
              <div className="chd__sec-label">视觉块 ({row.visualAscii.length})</div>
              {row.visualAscii.map((ascii, i) => (
                <div key={i} className="chd__visual-wrap">
                  <VisualBlockRenderer ascii={ascii} mode="final" />
                  <button type="button" className="chd__copy" onClick={() => copy(ascii)}>
                    复制
                  </button>
                </div>
              ))}
            </section>
          )}

          {row.textOnly && (
            <section className="chd__sec">
              <div className="chd__sec-label">文字答案</div>
              <div className="chd__text"><RichContent text={row.textOnly} /></div>
              <button type="button" className="chd__copy" onClick={() => copy(row.textOnly)}>
                复制全文
              </button>
            </section>
          )}

          {row.assistant?.error && (
            <section className="chd__sec">
              <div className="chd__sec-label">错误</div>
              <div className="chd__error">{row.assistant.error}</div>
            </section>
          )}
        </div>

        <footer className="chd__nav">
          <button type="button" className="chd__nav-btn" disabled={!prev}
            onClick={() => prev && onNavigate(prev)}>
            ← 上一条
          </button>
          <span className="chd__nav-counter">{idx + 1} / {rows.length}</span>
          <button type="button" className="chd__nav-btn" disabled={!next}
            onClick={() => next && onNavigate(next)}>
            下一条 →
          </button>
        </footer>
      </div>
    </div>
  );
}
