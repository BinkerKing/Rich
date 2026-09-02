import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useChatComposer } from "../../../lib/useChatComposer.js";
import "./DeliverableCodexWorkbench.css";
import "./DeliverableCodexWorkbenchAutosize.css";

type Mode = "free" | "task" | "bug";
type Conversation = { id: string; title: string; mode: Mode; status: "active" | "archived"; codexThreadId?: string; lastActiveAt: string };
type Message = { role: "user" | "assistant" | "system"; content: string; attachments?: Array<{ id?: string; url?: string; previewUrl?: string }> };
type ConnectionState = "checking" | "connected" | "server_offline" | "session_lost";

const modeLabel: Record<Mode, string> = { free: "自由模式", task: "任务模式", bug: "BUG 模式" };
const taskName: Record<Mode, string> = { free: "交付物自由对话", task: "交付物任务", bug: "交付物 BUG 诊断" };
const connectionLabel: Record<ConnectionState, string> = { checking: "正在检查 Codex 连接", connected: "Codex Server 与当前对话均正常", server_offline: "Codex Server 未连接", session_lost: "Codex Server 正常，但当前对话已失效" };

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `请求失败 (${response.status})`);
  return body;
}

export function DeliverableCodexWorkbench({ projectId, deliverableId, deliverableTitle, visible }: { projectId: string; deliverableId: string; deliverableTitle: string; visible: boolean }): ReactNode {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("free");
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [previewUrl, setPreviewUrl] = useState<string>();
  const composer = useChatComposer({ maxAttachments: 4 });
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLElement>(null);
  const active = useMemo(() => conversations.find(item => item.id === activeId), [activeId, conversations]);

  const refresh = async () => {
    const payload = await readJson<{ conversations: Conversation[] }>(`/api/deliverable-codex/${encodeURIComponent(projectId)}/${encodeURIComponent(deliverableId)}/conversations`);
    setConversations(payload.conversations);
    setActiveId(current => current && payload.conversations.some(item => item.id === current) ? current : payload.conversations[0]?.id);
  };
  useEffect(() => { void refresh().catch(reason => setError(reason instanceof Error ? reason.message : String(reason))); }, [projectId, deliverableId]);
  useEffect(() => {
    if (!activeId || messages[activeId]) return;
    void readJson<{ messages: Array<{ role: "user" | "assistant" | "system"; content: string; attachments?: Array<{ id: string; url?: string }> }> }>(`/api/deliverable-codex/conversations/${encodeURIComponent(activeId)}/messages`)
      .then(payload => setMessages(current => ({ ...current, [activeId]: payload.messages.map(message => ({ role: message.role, content: message.content, attachments: message.attachments })) })))
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [activeId, messages]);
  useEffect(() => {
    if (!activeId) { setConnection("checking"); return; }
    let disposed = false;
    const check = async () => {
      try {
        const payload = await readJson<{ state: Exclude<ConnectionState, "checking"> }>(`/api/deliverable-codex/conversations/${encodeURIComponent(activeId)}/status`);
        if (!disposed) setConnection(payload.state);
      } catch { if (!disposed) setConnection("server_offline"); }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 15_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [activeId]);
  useEffect(() => {
    const element = composerTextareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [input]);
  useEffect(() => { const element = messagesRef.current; if (visible && element) element.scrollTop = element.scrollHeight; }, [activeId, messages, visible]);

  const create = async () => {
    if (!title.trim()) return;
    setError("");
    try {
      const payload = await readJson<{ conversation: Conversation }>(`/api/deliverable-codex/${encodeURIComponent(projectId)}/${encodeURIComponent(deliverableId)}/conversations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: title.trim(), mode }) });
      setConversations(current => [payload.conversation, ...current]); setActiveId(payload.conversation.id); setTitle(""); setCreating(false);
      if (payload.conversation.mode === "task") void send(payload.conversation, "请阅读 Rich 已提供的交付物上下文，确认你已理解当前目标，并简要说明你接下来可以协助完成什么。", "Rich 已请求 Codex 阅读并确认上述上下文。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const archive = async () => {
    if (!active) return;
    await readJson(`/api/deliverable-codex/conversations/${encodeURIComponent(active.id)}/archive`, { method: "POST" });
    await refresh();
  };
  const writeBack = async () => {
    if (!active || active.mode !== "task") return;
    const summary = [...(messages[active.id] ?? [])].reverse().find(message => message.role === "assistant")?.content.trim();
    if (!summary) return;
    try { await readJson(`/api/deliverable-codex/conversations/${encodeURIComponent(active.id)}/writeback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary }) }); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const send = async (target = active, message = input.trim(), displayContent = message) => {
    if (!target || (!message && composer.attachments.length === 0) || streaming || composer.isUploading) return;
    const content = message || "请查看我附上的图片。"; const userMessageId = crypto.randomUUID(); const clientRequestId = crypto.randomUUID();
    if (target.id === active?.id) setInput(""); setStreaming(true); setError("");
    const displayRole: Message["role"] = displayContent === content ? "user" : "system";
    const outgoingImages = composer.attachments.map(attachment => ({ previewUrl: attachment.previewUrl }));
    setMessages(current => ({ ...current, [target.id]: [...(current[target.id] ?? []), { role: displayRole, content: displayContent, attachments: outgoingImages }, { role: "assistant", content: "" }] }));
    try {
      const response = await fetch(`/api/deliverable-codex/conversations/${encodeURIComponent(target.id)}/stream`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, userMessageId, clientRequestId, attachments: composer.getAttachmentRefs() }) });
      if (!response.ok || !response.body) throw new Error(`发送失败 (${response.status})`);
      composer.clear();
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const next = await reader.read(); if (next.done) break; buffer += decoder.decode(next.value, { stream: true });
        const parts = buffer.split("\n\n"); buffer = parts.pop() ?? "";
        for (const part of parts) {
          const event = /^event: (.+)$/m.exec(part)?.[1]; const raw = /^data: (.+)$/m.exec(part)?.[1]; if (!raw) continue;
          const data = JSON.parse(raw) as { chunk?: string; message?: string };
          if (event === "text" && data.chunk) setMessages(current => ({ ...current, [target.id]: (current[target.id] ?? []).map((message, index, all) => index === all.length - 1 ? { ...message, content: message.content + data.chunk } : message) }));
          if (event === "error") setError(data.message ?? "Codex 对话失败");
        }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setStreaming(false); }
  };

  return <div className={`deliverable-codex-backdrop${visible ? "" : " is-hidden"}`} role="dialog" aria-modal="true" aria-label="交付物 Codex 对话">
    <section className="deliverable-codex-workbench">
      <header className="deliverable-codex-workbench__tabs">
        <div className="deliverable-codex-workbench__titles">{conversations.map(conversation => <button key={conversation.id} type="button" className={conversation.id === activeId ? "is-active" : ""} onClick={() => setActiveId(conversation.id)}><span>交付物 · {conversation.title}</span><em>{modeLabel[conversation.mode]}</em></button>)}</div>
        <button type="button" onClick={() => setCreating(true)}>＋ 新会话</button>
        <button type="button" disabled={!active} onClick={() => void archive()}>归档</button>
        {active?.mode === "task" && <button type="button" disabled={streaming || !(messages[active.id] ?? []).some(message => message.role === "assistant" && message.content)} onClick={() => void writeBack()}>回写交付物</button>}
      </header>
      <div className="deliverable-codex-workbench__scope">交付物 / {deliverableTitle} {active && <span className={`deliverable-codex-workbench__connection is-${connection}`} title={connectionLabel[connection]}><i aria-hidden="true"/>Codex <b>· {taskName[active.mode]}</b></span>}</div>
      {creating && <form className="deliverable-codex-workbench__create" onSubmit={event => { event.preventDefault(); void create(); }}><input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="会话标题"/><select value={mode} onChange={event => setMode(event.target.value as Mode)}><option value="free">自由模式</option><option value="task">任务模式（可按要求回写）</option><option value="bug">BUG 模式</option></select><button type="submit">创建</button><button type="button" onClick={() => setCreating(false)}>取消</button></form>}
      <main ref={messagesRef} className="deliverable-codex-workbench__messages">{active ? (messages[active.id] ?? []).map((message, index) => <article key={index} className={`is-${message.role}`}><b>{message.role === "user" ? "你" : message.role === "system" ? "Rich · 已发送给 Codex 的上下文" : "Codex"}</b>{message.attachments?.length ? <div className="deliverable-codex-workbench__message-images">{message.attachments.map((attachment, imageIndex) => <img key={attachment.id ?? imageIndex} src={attachment.previewUrl ?? attachment.url ?? `/api/chat/attachments/${attachment.id}/data`} alt="已发送图片" onClick={() => setPreviewUrl(attachment.previewUrl ?? attachment.url ?? `/api/chat/attachments/${attachment.id}/data`)}/>)}</div> : null}<p>{message.content || (streaming ? "正在响应…" : "")}</p></article>) : <p className="deliverable-codex-workbench__empty">新建一个会话，开始围绕此交付物对话。</p>}</main>
      {error && <p className="deliverable-codex-workbench__error">{error}</p>}
      <footer className="deliverable-codex-workbench__composer">{composer.attachments.length > 0 && <div className="deliverable-codex-workbench__attachments">{composer.attachments.map(attachment => <figure key={attachment.clientId}><button type="button" onClick={() => setPreviewUrl(attachment.previewUrl)}><img src={attachment.previewUrl} alt="已粘贴图片"/></button><button type="button" aria-label="删除图片" onClick={() => composer.detach(attachment.clientId)}>×</button></figure>)}</div>}<textarea ref={composerTextareaRef} rows={1} value={input} disabled={!active || streaming} onChange={event => setInput(event.target.value)} onPaste={event => { const image = Array.from(event.clipboardData.items).find(item => item.type.startsWith("image/"))?.getAsFile(); if (image) { event.preventDefault(); void composer.attach(image); } }} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void send(); } }} placeholder={active ? "随心输入" : "请先新建会话"}/><div className="deliverable-codex-workbench__composer-actions"><span aria-hidden="true"/><button type="button" aria-label={streaming ? "Codex 正在响应" : "发送消息"} disabled={!active || (!input.trim() && composer.attachments.length === 0) || composer.isUploading} onClick={() => void send()}>{streaming ? "■" : "↑"}</button></div></footer>
      {previewUrl && <div className="deliverable-codex-workbench__image-preview" role="dialog" aria-modal="true" onClick={() => setPreviewUrl(undefined)}><img src={previewUrl} alt="粘贴图片预览"/></div>}
    </section>
  </div>;
}
