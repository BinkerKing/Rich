/**
 * Rich 首页动画展示系统 v0.1 —— 三栏历史回看视图 (T16)。
 *
 * 三栏布局：左 = 用户问题（作为锚）/ 中 = 视觉块缩略 / 右 = 文字答案缩略
 * 点任一列打开完整详情面板（T17）。
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadChatHistory, type ChatHistoryMessage, CHAT_HISTORY_UPDATED_EVENT } from "../lib/chatHistory.js";
import { VisualBlockRenderer } from "../components/VisualBlockRenderer.js";
import { ChatHistoryDetail } from "../components/ChatHistoryDetail.js";
import "./ChatHistoryView.css";

interface HistoryRow {
  /** 这一轮对话的唯一 key（用 user message id 作为锚） */
  key: string;
  user: ChatHistoryMessage | null;
  assistant: ChatHistoryMessage | null;
  /** 从 assistant content 抽出的 visual 块原文（数组） */
  visualAscii: string[];
  /** assistant content 里去掉 visual 块后的纯 text */
  textOnly: string;
  /** 时间戳（取 user 的 createdAt） */
  ts: number;
}

const VISUAL_FENCE_RE = /```([a-zA-Z]*)\n([\s\S]*?)```/g;

function buildRows(messages: ChatHistoryMessage[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const next = messages[i + 1];
    const assistant = next?.role === "assistant" ? next : null;
    const content = assistant?.content ?? "";
    const visualAscii: string[] = [];
    let textOnly = content;
    if (content) {
      // 抽出所有视觉块
      VISUAL_FENCE_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = VISUAL_FENCE_RE.exec(content)) !== null) {
        visualAscii.push(match[2]);
      }
      // 去掉视觉块得到纯 text
      textOnly = content.replace(VISUAL_FENCE_RE, "").trim();
    }
    rows.push({
      key: m.id,
      user: m,
      assistant,
      visualAscii,
      textOnly,
      ts: m.createdAt ?? 0,
    });
  }
  return rows;
}

export function ChatHistoryView({ onBack }: { onBack: () => void }): ReactNode {
  const [messages, setMessages] = useState<ChatHistoryMessage[]>(() => loadChatHistory());
  const [selectedRow, setSelectedRow] = useState<HistoryRow | null>(null);
  const rows = useMemo(() => buildRows(messages), [messages]);
  const leftRef = useRef<HTMLDivElement>(null);
  const middleRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // 监听 localStorage 变更（chat overlay 在另一个上下文写入时同步刷新）
  useEffect(() => {
    const handler = (): void => setMessages(loadChatHistory());
    window.addEventListener(CHAT_HISTORY_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CHAT_HISTORY_UPDATED_EVENT, handler);
  }, []);

  // 同步滚动 —— 任一列滚动时，按比例驱动另外两列
  useEffect(() => {
    const cols = [leftRef.current, middleRef.current, rightRef.current].filter(Boolean) as HTMLDivElement[];
    if (cols.length < 2) return;
    let isSyncing = false;
    const onScroll = (source: HTMLDivElement) => () => {
      if (isSyncing) return;
      isSyncing = true;
      const sourceRatio = source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight);
      for (const c of cols) {
        if (c === source) continue;
        const target = sourceRatio * (c.scrollHeight - c.clientHeight);
        c.scrollTop = target;
      }
      // requestAnimationFrame 解锁，避免循环触发
      requestAnimationFrame(() => { isSyncing = false; });
    };
    const handlers = cols.map(c => ({ el: c, fn: onScroll(c) }));
    for (const h of handlers) h.el.addEventListener("scroll", h.fn);
    return () => {
      for (const h of handlers) h.el.removeEventListener("scroll", h.fn);
    };
  }, [rows.length]);

  return (
    <div className="chat-history">
      <header className="chat-history__head">
        <button type="button" className="chat-history__back" onClick={onBack}>← 返回</button>
        <h1>聊天历史回看</h1>
        <span className="chat-history__count">{rows.length} 轮对话</span>
      </header>

      {rows.length === 0 ? (
        <div className="chat-history__empty">
          还没有对话记录。回到首页问 Rich 一些问题，回来这里就能滚回去看了。
        </div>
      ) : (
        <div className="chat-history__cols">
          <div className="chat-history__col chat-history__col--user" ref={leftRef}>
            <div className="chat-history__col-head">问题</div>
            {rows.map(r => (
              <button key={`u-${r.key}`} className="chat-history__row chat-history__row--user"
                onClick={() => setSelectedRow(r)}>
                <div className="chat-history__row-text">{r.user?.content ?? "(空)"}</div>
                {r.ts > 0 && (
                  <div className="chat-history__row-meta">
                    {new Date(r.ts).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="chat-history__col chat-history__col--visual" ref={middleRef}>
            <div className="chat-history__col-head">视觉块</div>
            {rows.map(r => (
              <button key={`v-${r.key}`} className="chat-history__row chat-history__row--visual"
                onClick={() => setSelectedRow(r)}>
                {r.visualAscii.length === 0 ? (
                  <div className="chat-history__visual-empty">— 这次没画 —</div>
                ) : (
                  <div className="chat-history__visual-stack">
                    {r.visualAscii.slice(0, 2).map((ascii, i) => (
                      <VisualBlockRenderer key={i} ascii={ascii} mode="final" />
                    ))}
                    {r.visualAscii.length > 2 && (
                      <div className="chat-history__visual-more">+ {r.visualAscii.length - 2} 更多</div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="chat-history__col chat-history__col--text" ref={rightRef}>
            <div className="chat-history__col-head">文字答案</div>
            {rows.map(r => (
              <button key={`t-${r.key}`} className="chat-history__row chat-history__row--text"
                onClick={() => setSelectedRow(r)}>
                {r.textOnly ? (
                  <div className="chat-history__row-text">{r.textOnly.slice(0, 300)}{r.textOnly.length > 300 && "…"}</div>
                ) : r.assistant?.pending ? (
                  <div className="chat-history__row-pending">… 还在写</div>
                ) : (
                  <div className="chat-history__row-empty">(无文字)</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedRow && (
        <ChatHistoryDetail
          row={selectedRow}
          rows={rows}
          onClose={() => setSelectedRow(null)}
          onNavigate={(r) => setSelectedRow(r)}
        />
      )}
    </div>
  );
}

export type { HistoryRow };
