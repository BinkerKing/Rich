import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConversationMessageRenderer, type ConversationBlockRenderers, type ConversationMessage } from "./ConversationMessageRenderer.js";
import "./CodexConversationPanel.css";

export type CodexConversationPanelProps = {
  conversationId?: string;
  header?: ReactNode;
  composer?: ReactNode;
  sidebarActions?: ReactNode;
  tone?: "default" | "calm";
  density?: "comfortable" | "compact";
  accent?: "teal" | "violet";
  blockRenderers?: ConversationBlockRenderers;
};

export function CodexConversationPanel({ conversationId, header, composer, sidebarActions, tone = "default", density = "comfortable", accent = "teal", blockRenderers }: CodexConversationPanelProps): ReactNode {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const load = async () => {
    if (!conversationId) return setMessages([]);
    const response = await fetch(`/api/deliverable-codex/conversations/${encodeURIComponent(conversationId)}/messages`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "读取对话失败");
    setMessages(body.messages.map((message: ConversationMessage, index: number) => ({ ...message, id: `${message.createdAt ?? "message"}-${index}` })));
  };
  useEffect(() => { void load().catch(reason => setError(String(reason))); }, [conversationId]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages, running]);
  const send = async () => {
    if (!conversationId || !input.trim() || running) return;
    const content = input.trim(); const clientRequestId = crypto.randomUUID(); const createdAt = new Date().toISOString();
    setInput(""); setError(""); setRunning(true);
    setMessages(current => [...current, { id: clientRequestId, role: "user", content, createdAt }, { id: `${clientRequestId}-assistant`, role: "assistant", content: "", createdAt, state: "streaming", blocks: [{ type: "status", text: "正在思考…", state: "streaming" }] }]);
    try {
      const response = await fetch(`/api/deliverable-codex/conversations/${encodeURIComponent(conversationId)}/stream`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, userMessageId: crypto.randomUUID(), clientRequestId, attachments: [] }) });
      if (!response.ok || !response.body) throw new Error(`发送失败 (${response.status})`);
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const next = await reader.read(); if (next.done) break; buffer += decoder.decode(next.value, { stream: true });
        const frames = buffer.split("\n\n"); buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const event = /^event: (.+)$/m.exec(frame)?.[1]; const raw = /^data: (.+)$/m.exec(frame)?.[1]; if (!raw) continue;
          const data = JSON.parse(raw) as { chunk?: string; text?: string; message?: string };
          if (event === "text" && data.chunk) setMessages(current => current.map(message => message.id === `${clientRequestId}-assistant` ? { ...message, content: message.content + data.chunk, blocks: undefined } : message));
          if (event === "activity" && data.text) setMessages(current => current.map(message => message.id === `${clientRequestId}-assistant` ? { ...message, blocks: [{ type: "status", text: data.text!, state: "running" }] } : message));
          if (event === "error") setError(data.message ?? "对话失败");
        }
      }
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setRunning(false); }
  };
  return <section className={`codex-conversation codex-conversation--${tone} codex-conversation--${density} codex-conversation--${accent}`}>
    <header className="codex-conversation__header"><div>{header ?? <><strong>与 Rich 协作</strong><small>Rich 收集信息，Agent 负责分析与执行</small></>}</div>{sidebarActions}</header>
    <div className="codex-conversation__messages" ref={scroller} aria-live="polite">{messages.length ? messages.map(message => <ConversationMessageRenderer key={message.id} message={message} renderers={blockRenderers} />) : <p className="codex-conversation__empty">先告诉 Rich 你想完成什么。</p>}</div>
    {error && <p className="codex-conversation__error" role="alert">{error}</p>}
    {composer ?? <footer className="codex-conversation__composer"><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={conversationId ? "输入信息、粘贴网址，或描述你的想法…" : "请先创建工作台"} disabled={!conversationId || running} /><button className="is-primary" onClick={() => void send()} disabled={!conversationId || running || !input.trim()}>{running ? "处理中" : "发送"}</button></footer>}
  </section>;
}
