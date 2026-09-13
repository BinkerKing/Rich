import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useChatComposer } from "../../../lib/useChatComposer.js";
import { filterCodexSlashTools, parseCodexSlashInput, type CodexSlashTool } from "../../../lib/codexSlashTools.js";
import { formatCodexLocationContext, type CodexLocationContextInput } from "../../../lib/codexLocationContext.js";
import { RichContent } from "../../../components/RichContent.js";
import { notifyDeliverableDataChanged, requestDeliverableItemFocus } from "./DeliverablesModel.js";
import { requestShortcutOpen } from "../../../lib/shortcutEngine.js";
import { useStore } from "../../../state/store.js";
import { api, type AiManagedTaskCreateInput } from "../../../api/client.js";
import "./DeliverableCodexWorkbench.css";
import "./DeliverableCodexWorkbenchAutosize.css";

type Mode = "free";
type TaskMode = { id: string; label: string; hint: string };
type TaskModeSession = TaskMode & { location: CodexLocationContextInput; startedAt: string };
type Theme = "obsidian" | "graphite";
type PendingAiTask = { sceneId: AiManagedTaskCreateInput["sceneId"]; label: string; payload?: Record<string, unknown> };
type Conversation = { id: string; title: string; mode: Mode; status: "active" | "archived"; projectId: string; deliverableId: string; codexThreadId?: string; lastActiveAt: string };
type Message = { role: "user" | "assistant" | "system"; content: string; createdAt?: string; durationMs?: number; kind?: "task-mode-started" | "task-mode-instruction" | "task-mode-policy-updated"; taskModeLabel?: string; taskModeLocation?: CodexLocationContextInput; attachments?: Array<{ id?: string; url?: string; previewUrl?: string }> };
type QueuedMessage = { id: string; conversation: Conversation; content: string; attachments: Array<{ id: string; mime: string; url: string; width?: number; height?: number; previewUrl?: string }> };
type WindowState = { x: number; y: number; width: number; height: number; maximized: boolean };
const windowStorageKey = "rich.deliverable-codex.window";
const themeStorageKey = "rich.deliverable-codex.theme";
const conversationOrderStorageKey = "rich.deliverable-codex.conversation-order";
const taskModeStorageKey = "rich.deliverable-codex.task-modes";
const defaultWindow: WindowState = { x: 0, y: 0, width: 980, height: 720, maximized: false };
const workbenchMargin = 28;
const desktopTitlebarHeight = 56;
const deliverableTaskModes: TaskMode[] = [{ id: "deliverable-analysis", label: "交付物分析", hint: "分析当前交付物的需求、记录与材料" }];
const generalTaskMode: TaskMode = { id: "general-task", label: "任务模式（自动适配）", hint: "理解需求、制定计划；没有专用承接时进入通用任务" };
const deliverableWriteToolNames = new Set([
  "rich_deliverable_record_create",
  "rich_deliverable_record_update",
  "rich_deliverable_requirement_update",
  "rich_deliverable_settings_update",
  "rich_deliverable_file_meta_update",
]);

function isDeliverableWriteTool(name?: string): boolean {
  return Boolean(name && deliverableWriteToolNames.has(name));
}
const viewLabels: Record<string, string> = {
  home: "首页",
  apps: "应用",
  tree: "知识树",
  admin: "后台",
  news: "AI 早报",
  mindmap: "思维导图",
  greatme: "伟大的我",
  toolbox: "工具箱",
  practice: "应用开发",
  taskWorkbench: "任务",
  health: "健康",
  projects: "项目",
  rikingProjects: "Riking 项目",
  aiTaskManagement: "AI 任务管理",
};

function currentPageLocation(appView: string): string[] {
  if (appView === "aiTaskManagement") {
    const title = document.querySelector<HTMLElement>(".ai-task-management .atm-heading h1")?.textContent?.trim();
    return ["AI 任务管理", title || "任务清单"];
  }
  if (appView !== "projects") return [viewLabels[appView] ?? "Rich"];
  const section = document.querySelector<HTMLElement>('.prj-ws__nav [role="tab"][aria-selected="true"]')?.getAttribute("aria-label");
  return ["项目管理", section ?? "未标注页面"];
}

function currentProjectTitle(): string {
  return document.querySelector(".prj-ws__title")?.textContent?.trim() || "未命名项目";
}

function currentLocationContext(appView: string, projectId: string, deliverableId: string, deliverableTitle: string): CodexLocationContextInput {
  const page = currentPageLocation(appView);
  if (appView !== "projects") return { page };
  return {
    page,
    project: { id: projectId, title: currentProjectTitle() },
    business: { kind: "交付物", id: deliverableId, title: deliverableTitle },
  };
}

function fitWindowToViewport(state: WindowState): WindowState {
  const maxWidth = Math.max(320, window.innerWidth - workbenchMargin * 2);
  const maxHeight = Math.max(280, window.innerHeight - workbenchMargin * 2);
  const width = Math.min(Math.max(320, state.width), maxWidth);
  const height = Math.min(Math.max(280, state.height), maxHeight);
  const centerX = (window.innerWidth - width) / 2;
  const centerY = (window.innerHeight - height) / 2;
  return {
    ...state,
    width,
    height,
    x: Math.min(Math.max(state.x, workbenchMargin - centerX), window.innerWidth - workbenchMargin - width - centerX),
    y: Math.min(Math.max(state.y, workbenchMargin - centerY), window.innerHeight - workbenchMargin - height - centerY),
  };
}

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `请求失败 (${response.status})`);
  return body;
}

function sortConversations(conversations: Conversation[]): Conversation[] {
  try {
    const order = JSON.parse(localStorage.getItem(conversationOrderStorageKey) ?? "[]") as string[];
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...conversations].sort((left, right) => (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER));
  } catch { return conversations; }
}

function saveConversationOrder(conversations: Conversation[]): void {
  localStorage.setItem(conversationOrderStorageKey, JSON.stringify(conversations.map(conversation => conversation.id)));
}

function formatMessageTime(createdAt?: string): string {
  if (!createdAt) return "刚刚";
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? "刚刚" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
function formatDuration(milliseconds: number): string { return `${Math.max(1, Math.round(milliseconds / 1000))}秒`; }

function selectedTextInMessage(element: HTMLElement | null): string {
  const selection = window.getSelection();
  if (!element || !selection || selection.rangeCount === 0) return "";
  return element.contains(selection.getRangeAt(0).commonAncestorContainer) ? selection.toString().trim() : "";
}

function withMessageDurations(messages: Message[]): Message[] {
  let startedAt: number | undefined;
  return messages.map(message => {
    if (message.role === "user") startedAt = message.createdAt ? new Date(message.createdAt).getTime() : undefined;
    if (message.role !== "assistant" || startedAt === undefined || !message.createdAt) return message;
    const durationMs = new Date(message.createdAt).getTime() - startedAt;
    return Number.isNaN(durationMs) ? message : { ...message, durationMs: Math.max(0, durationMs) };
  });
}

export function DeliverableCodexWorkbench({ projectId, deliverableId, deliverableTitle, visible, requestedConversationId, initialPrompt, executionTaskId, initialConversationTitle, openSequence }: { projectId: string; deliverableId: string; deliverableTitle: string; visible: boolean; requestedConversationId?: string; initialPrompt?: string; executionTaskId?: string; initialConversationTitle?: string; openSequence?: number }): ReactNode {
  const appView = useStore(state => state.appView);
  const setAppView = useStore(state => state.setAppView);
  const elements = useStore(state => state.elements);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [editableTitle, setEditableTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState("");
  const [locationAttached, setLocationAttached] = useState(false);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [toolIndex, setToolIndex] = useState(0);
  const [taskModePickerOpen, setTaskModePickerOpen] = useState(false);
  const [taskModeIndex, setTaskModeIndex] = useState(0);
  const [taskModes, setTaskModes] = useState<Record<string, TaskModeSession>>(() => { try { return JSON.parse(localStorage.getItem(taskModeStorageKey) ?? "{}"); } catch { return {}; } });
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const [queueMenuId, setQueueMenuId] = useState<string>();
  const [streaming, setStreaming] = useState(false);
  const [streamingConversationId, setStreamingConversationId] = useState<string>();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [runningByConversation, setRunningByConversation] = useState<Record<string, boolean>>({});
  const [lostConversationIds, setLostConversationIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [capturingCurrentView, setCapturingCurrentView] = useState(false);
  const [pendingAiTask, setPendingAiTask] = useState<PendingAiTask>();
  const [projectTaskPickerOpen, setProjectTaskPickerOpen] = useState(false);
  const [pickerProjectId, setPickerProjectId] = useState<string>();
  const [pickerDeliverables, setPickerDeliverables] = useState<Array<{ id: string; title: string }>>([]);
  const composer = useChatComposer({ maxAttachments: 4 });
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const composerFilePickerRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const conversationMenuRef = useRef<HTMLDivElement>(null);
  const composerMenuRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLElement>(null);
  const shouldFollowMessagesRef = useRef(true);
  const streamingRef = useRef(false);
  const launchedExecutionTaskRef = useRef<string>();
  const [windowState, setWindowState] = useState<WindowState>(() => { try { return fitWindowToViewport({ ...defaultWindow, ...JSON.parse(localStorage.getItem(windowStorageKey) ?? "{}") }); } catch { return fitWindowToViewport(defaultWindow); } });
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem(themeStorageKey) === "graphite" ? "graphite" : "obsidian");
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number }>();
  const active = useMemo(() => conversations.find(item => item.id === activeId), [activeId, conversations]);
  const isResponding = Boolean(active && (streamingConversationId === active.id || runningByConversation[active.id]));
  const activeTaskMode = active ? taskModes[active.id] : undefined;
  const attachedLocation = currentLocationContext(appView, projectId, deliverableId, deliverableTitle);
  const locationContext = locationAttached ? formatCodexLocationContext(attachedLocation) : "";
  const codexSlash = useMemo(() => parseCodexSlashInput(input), [input]);
  const codexTools = useMemo(() => filterCodexSlashTools(codexSlash.query), [codexSlash.query]);
  const taskModeAvailable = true;
  const availableTaskModes = currentPageLocation(appView).at(-1) === "交付物" && active?.projectId !== "__general__" ? [generalTaskMode, ...deliverableTaskModes] : [generalTaskMode];
  const isNearMessagesBottom = (element: HTMLElement) => element.scrollHeight - element.scrollTop - element.clientHeight < 24;
  const updateMessageFollowState = () => {
    const element = messagesRef.current;
    if (element) shouldFollowMessagesRef.current = isNearMessagesBottom(element);
  };

  const refresh = async () => {
    const payload = await readJson<{ conversations: Conversation[] }>("/api/deliverable-codex/conversations");
    setConversations(sortConversations(payload.conversations));
    setActiveId(current => current && payload.conversations.some(item => item.id === current) ? current : payload.conversations[0]?.id);
  };
  const loadMessages = async (conversationId: string) => {
    const payload = await readJson<{ messages: Array<{ role: "user" | "assistant" | "system"; content: string; createdAt: string; metadata?: { type?: string; mode?: { label?: string }; location?: CodexLocationContextInput }; attachments?: Array<{ id: string; url?: string }> }> }>(`/api/deliverable-codex/conversations/${encodeURIComponent(conversationId)}/messages`);
    setMessages(current => ({ ...current, [conversationId]: withMessageDurations(payload.messages.map(message => ({ role: message.role, content: message.content, createdAt: message.createdAt, kind: message.metadata?.type === "task-mode-started" || message.metadata?.type === "task-mode-instruction" || message.metadata?.type === "task-mode-policy-updated" ? message.metadata.type : undefined, taskModeLabel: message.metadata?.mode?.label, taskModeLocation: message.metadata?.location, attachments: message.attachments }))) }));
  };
  const loadRunningStatus = async (conversationId: string) => {
    try {
      const payload = await readJson<{ running?: boolean }>(`/api/deliverable-codex/conversations/${encodeURIComponent(conversationId)}/status`);
      setRunningByConversation(current => ({ ...current, [conversationId]: Boolean(payload.running) }));
    } catch { /* The stream itself reports request errors; status refreshes are best effort. */ }
  };
  useEffect(() => { void refresh().catch(reason => setError(reason instanceof Error ? reason.message : String(reason))); }, [projectId, deliverableId]);
  useEffect(() => {
    if (!visible || !requestedConversationId) return;
    void readJson<{ conversations: Conversation[] }>("/api/deliverable-codex/conversations").then(payload => {
      setConversations(sortConversations(payload.conversations));
      if (payload.conversations.some(item => item.id === requestedConversationId)) setActiveId(requestedConversationId);
      else setError("绑定的 Codex 对话不可用，请检查是否已归档");
    }).catch(reason => setError(String(reason)));
  }, [requestedConversationId, openSequence, visible]);
  useEffect(() => {
    if (!activeId || messages[activeId]) return;
    void loadMessages(activeId).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [activeId, messages]);
  useEffect(() => {
    if (!visible || !active?.id) return;
    void loadRunningStatus(active.id);
    const interval = window.setInterval(() => {
      void loadRunningStatus(active.id);
      if (!streamingRef.current) void loadMessages(active.id).catch(reason => setError(String(reason)));
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [active?.id, visible]);
  useEffect(() => { setError(""); }, [activeId]);
  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 3_000);
    return () => window.clearTimeout(timeout);
  }, [error]);
  useEffect(() => { setEditableTitle(active?.title ?? ""); }, [active?.id, active?.title]);
  useEffect(() => { if (editingTitle) titleInputRef.current?.focus(); }, [editingTitle]);
  useEffect(() => {
    const element = composerTextareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [input]);
  useEffect(() => { setToolIndex(0); }, [input]);
  useEffect(() => { const element = messagesRef.current; if (visible && element && shouldFollowMessagesRef.current) element.scrollTop = element.scrollHeight; }, [activeId, messages, visible]);
  useEffect(() => { localStorage.setItem(windowStorageKey, JSON.stringify(windowState)); }, [windowState]);
  useEffect(() => { localStorage.setItem(themeStorageKey, theme); }, [theme]);
  useEffect(() => { localStorage.setItem(taskModeStorageKey, JSON.stringify(taskModes)); }, [taskModes]);
  useEffect(() => {
    if (!visible) return;
    composerTextareaRef.current?.focus();
  }, [visible]);
  useEffect(() => { if (!streaming) return; const startedAt = Date.now() - elapsedMs; const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 250); return () => window.clearInterval(timer); }, [streaming]);
  useEffect(() => { if (!conversationMenuOpen) return; const close = (event: PointerEvent) => { if (!conversationMenuRef.current?.contains(event.target as Node)) setConversationMenuOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, [conversationMenuOpen]);
  useEffect(() => { if (!composerMenuOpen) return; const close = (event: PointerEvent) => { if (!composerMenuRef.current?.contains(event.target as Node)) setComposerMenuOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, [composerMenuOpen]);
  useEffect(() => { const resize = () => setWindowState(fitWindowToViewport); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize); }, []);
  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => { if (windowState.maximized || (event.target as HTMLElement).closest("button, input, .deliverable-codex-workbench__title")) return; dragRef.current = { x: event.clientX, y: event.clientY, startX: windowState.x, startY: windowState.y }; event.currentTarget.setPointerCapture(event.pointerId); };
  const drag = (event: ReactPointerEvent<HTMLElement>) => { const point = dragRef.current; if (point) setWindowState(current => fitWindowToViewport({ ...current, x: point.startX + event.clientX - point.x, y: point.startY + event.clientY - point.y })); };

  const create = async (startup?: { prompt?: string; taskId?: string; title?: string }) => {
    const conversationTitle = startup?.title ?? title.trim();
    if (!conversationTitle) return;
    setError("");
    try {
      const payload = await readJson<{ conversation: Conversation }>(`/api/deliverable-codex/${encodeURIComponent(projectId)}/${encodeURIComponent(deliverableId)}/conversations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: conversationTitle }) });
      if (startup?.taskId) await api.claimAiManagedTask(startup.taskId, "Rich·Codex", payload.conversation.id);
      setConversations(current => { const next = [payload.conversation, ...current]; saveConversationOrder(next); return next; }); setActiveId(payload.conversation.id); setTitle(""); setCreating(false);
      if (startup?.prompt) void sendMessage(payload.conversation, startup.prompt, [], false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  useEffect(() => {
    if (!visible || !initialPrompt || !executionTaskId || launchedExecutionTaskRef.current === executionTaskId) return;
    launchedExecutionTaskRef.current = executionTaskId;
    void create({ prompt: initialPrompt, taskId: executionTaskId, title: initialConversationTitle ?? "Rich·Codex Bug 任务" });
  }, [visible, initialPrompt, executionTaskId, initialConversationTitle, openSequence]);
  const archive = async () => {
    if (!active) return;
    await readJson(`/api/deliverable-codex/conversations/${encodeURIComponent(active.id)}/archive`, { method: "POST" });
    await refresh();
  };
  const rename = async () => {
    if (!active) return;
    const nextTitle = editableTitle.trim();
    if (!nextTitle || nextTitle === active.title) { setEditableTitle(active.title); return; }
    try {
      const payload = await readJson<{ conversation: Conversation }>(`/api/deliverable-codex/conversations/${encodeURIComponent(active.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: nextTitle }) });
      setConversations(current => current.map(item => item.id === payload.conversation.id ? payload.conversation : item));
    } catch (reason) { setEditableTitle(active.title); setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const sendMessage = async (target: Conversation, content: string, attachments: QueuedMessage["attachments"], clearComposer: boolean, taskMode?: TaskModeSession, force = false) => {
    if (streamingRef.current && !force) return;
    const userMessageId = crypto.randomUUID(); const clientRequestId = crypto.randomUUID(); const createdAt = new Date().toISOString(); const startedAt = Date.now();
    if (target.id === active?.id) shouldFollowMessagesRef.current = true;
    if (target.id === active?.id) setInput(""); setElapsedMs(0); streamingRef.current = true; setStreaming(true); setStreamingConversationId(target.id); setError("");
    setMessages(current => ({ ...current, [target.id]: [...(current[target.id] ?? []), { role: "user", content, createdAt, kind: taskMode ? "task-mode-instruction" : undefined, taskModeLabel: taskMode?.label, taskModeLocation: taskMode?.location, attachments }, { role: "assistant", content: "", createdAt }] }));
    try {
      const response = await fetch(`/api/deliverable-codex/conversations/${encodeURIComponent(target.id)}/stream`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, userMessageId, clientRequestId, attachments, metadata: taskMode ? { type: "task-mode-instruction", mode: { id: taskMode.id, label: taskMode.label }, location: taskMode.location } : undefined }) });
      if (!response.ok || !response.body) throw new Error(`发送失败 (${response.status})`);
      setLostConversationIds(current => {
        const next = new Set(current);
        next.delete(target.id);
        return next;
      });
      if (clearComposer) composer.clear();
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const next = await reader.read(); if (next.done) break; buffer += decoder.decode(next.value, { stream: true });
        const parts = buffer.split("\n\n"); buffer = parts.pop() ?? "";
        for (const part of parts) {
          const event = /^event: (.+)$/m.exec(part)?.[1]; const raw = /^data: (.+)$/m.exec(part)?.[1]; if (!raw) continue;
          const data = JSON.parse(raw) as { chunk?: string; content?: string; createdAt?: string; message?: string; name?: string; status?: string };
          if (event === "text" && data.chunk) setMessages(current => ({ ...current, [target.id]: (current[target.id] ?? []).map((message, index, all) => index === all.length - 1 ? { ...message, content: message.content + data.chunk } : message) }));
          const policyContent = data.content;
          if (event === "policy" && policyContent) setMessages(current => {
            const currentMessages = current[target.id] ?? [];
            const pendingAssistant = currentMessages.at(-1)?.role === "assistant" && !currentMessages.at(-1)?.content ? currentMessages.at(-1) : undefined;
            const beforeAssistant = pendingAssistant ? currentMessages.slice(0, -1) : currentMessages;
            return { ...current, [target.id]: [...beforeAssistant, { role: "system", content: policyContent, createdAt: data.createdAt, kind: "task-mode-policy-updated" }, ...(pendingAssistant ? [pendingAssistant] : [])] };
          });
          if (event === "tool" && data.status === "succeeded" && isDeliverableWriteTool(data.name)) notifyDeliverableDataChanged(projectId, deliverableId);
          if (event === "error") {
            setLostConversationIds(current => new Set(current).add(target.id));
            setError(data.message ?? "Codex 对话失败");
          }
        }
      }
      void loadMessages(target.id).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
    } catch (reason) {
      setLostConversationIds(current => new Set(current).add(target.id));
      setError(reason instanceof Error ? reason.message : String(reason));
    }
      finally { const durationMs = Date.now() - startedAt; setMessages(current => ({ ...current, [target.id]: (current[target.id] ?? []).map((message, index, all) => index === all.length - 1 && message.role === "assistant" ? { ...message, durationMs } : message) })); streamingRef.current = false; setStreaming(false); setStreamingConversationId(undefined); }
    };
  const interruptAndSend = async (message: QueuedMessage) => {
    setQueuedMessages(current => current.filter(item => item.id !== message.id));
    try {
      const { interrupted } = await readJson<{ interrupted: boolean }>(`/api/deliverable-codex/conversations/${encodeURIComponent(message.conversation.id)}/interrupt`, { method: "POST" });
      if (!interrupted) throw new Error("当前 Codex 回合已结束，请重新发送");
      await sendMessage(message.conversation, message.content, message.attachments, false);
    } catch (reason) {
      setQueuedMessages(current => [message, ...current]);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  const interruptCurrentTurn = async () => {
    if (!active || !isResponding) return;
    setError("");
    try {
      const { interrupted } = await readJson<{ interrupted: boolean }>(`/api/deliverable-codex/conversations/${encodeURIComponent(active.id)}/interrupt`, { method: "POST" });
      if (!interrupted) setRunningByConversation(current => ({ ...current, [active.id]: false }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const resendMessage = (content: string, messageAttachments: Message["attachments"] = []) => {
    if (!active || streaming) return;
    const attachments = (messageAttachments ?? []).flatMap(attachment => attachment.id ? [{
      id: attachment.id,
      mime: "image/png",
      url: attachment.url ?? `/api/chat/attachments/${attachment.id}/data`,
      previewUrl: attachment.previewUrl,
    }] : []);
    void sendMessage(active, content, attachments, false);
  };
  const reformatAssistantMessage = (content: string) => {
    if (!active || isResponding || !content.trim()) return;
    const instruction = [
      "请只将下面这条答复重新排版成清爽、结构化的 Markdown。",
      "不重新研究、不新增事实、不改变链接、路径、代码或结论；不要解释排版过程。",
      "先给“结论摘要”（最多 3 条），再使用“关键发现 / 依据或文件 / 风险与待确认 / 下一步建议”等二级标题；长段拆为短要点。",
      "", "原答复：", content,
    ].join("\n");
    void sendMessage(active, instruction, [], false);
  };
  const copyMessage = async (content: string) => {
    try {
      try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(content); return; }
      } catch { /* Fall back to the browser copy command in packaged Electron. */ }
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("复制失败");
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  async function attachCurrentViewScreenshot() {
    const richWindow = (window as Window & { richWindow?: { captureCurrentView?: () => Promise<string | null> } }).richWindow;
    try {
      setComposerMenuOpen(false);
      setCapturingCurrentView(true);
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const dataUrl = await richWindow?.captureCurrentView?.();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      await composer.attach(new File([blob], `Rich-${Date.now()}.png`, { type: "image/png" }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setCapturingCurrentView(false); }
  }
  const queueOrSend = () => {
    if (!active || (!input.trim() && composer.attachments.length === 0) || composer.isUploading) return;
    const draft = input.trim() || "请查看我附上的图片。";
    const content = locationContext ? `${locationContext}\n\n${draft}` : draft;
    const attachments = composer.getAttachmentRefs().map((attachment, index) => ({ ...attachment, previewUrl: composer.attachments[index]?.previewUrl }));
    if (isResponding) return;
    if (pendingAiTask) {
      const taskInput: AiManagedTaskCreateInput = {
        sceneId: pendingAiTask.sceneId,
        title: draft.slice(0, 80),
        input: { text: content, images: attachments.map(item => ({ id: item.id, label: "对话附件", mime: item.mime })), materials: [] },
        payload: pendingAiTask.sceneId === "bug_fix"
          ? { ...pendingAiTask.payload, gitDeployLatest: /(?:提交\s*git|git\s*提交|重新部署|重新发布)/i.test(draft), deploymentPolicy: "git_deploy_latest_only" }
          : pendingAiTask.payload,
        contextSummary: content.slice(0, 2000),
        sourceConversationId: active.id,
        ...(pendingAiTask.sceneId === "deliverable_task" ? {
          projectId: typeof pendingAiTask.payload?.projectId === "string" ? pendingAiTask.payload.projectId : projectId,
          deliverableId: typeof pendingAiTask.payload?.deliverableId === "string" ? pendingAiTask.payload.deliverableId : deliverableId,
        } : {}),
      };
      void api.createAiManagedTask(taskInput).then(() => setError(`${pendingAiTask.label}已记录，等待 AI 认领`)).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
      setPendingAiTask(undefined);
    }
    void sendMessage(active, content, attachments, true);
    setLocationAttached(false);
  };
  const chooseCodexTool = (tool: CodexSlashTool | undefined) => {
    if (!tool) return;
    setInput("");
    if (tool.id === "image") composerFilePickerRef.current?.click();
    if (tool.id === "location") setLocationAttached(true);
    if (tool.id === "location-screenshot") void attachCurrentViewScreenshot();
    if (tool.id === "bug") {
      setLocationAttached(true); setPendingAiTask({ sceneId: "bug_fix", label: "Bug 任务", payload: { page: currentPageLocation(appView), gitDeployLatest: false } });
      void attachCurrentViewScreenshot(); setInput("请描述 Bug 的现象、预期结果和触发方式。");
    }
    if (tool.id === "requirement") {
      setPendingAiTask({ sceneId: "requirement_analysis", label: "需求 PRD" }); setInput("请描述你的需求想法、目标和约束，我会记录为 PRD 分析任务。");
    }
    if (tool.id === "project") {
      setProjectTaskPickerOpen(true);
    }
    if (tool.id === "task-mode") {
      if (availableTaskModes.length === 0) setError("当前页面没有可用的任务模式");
      else { setTaskModeIndex(0); setTaskModePickerOpen(true); }
    }
    window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
  };
  const startTaskMode = async (mode: TaskMode | undefined) => {
    if (streamingRef.current || isResponding) { setTaskModePickerOpen(false); setError("请等待当前回合结束后再切换任务模式"); return; }
    if (!active || !mode || !taskModeAvailable) { setTaskModePickerOpen(false); setError("当前页面没有可用的任务模式"); return; }
    setTaskModePickerOpen(false);
    window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
    const startedAt = new Date().toISOString();
    const location = currentLocationContext(appView, active.projectId, active.deliverableId, deliverableTitle);
    try {
      const payload = await readJson<{ instruction: string }>(`/api/deliverable-codex/conversations/${encodeURIComponent(active.id)}/events/task-mode-started`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: crypto.randomUUID(), mode, location, startedAt }) });
      const session = { ...mode, location, startedAt };
      setTaskModes(current => ({ ...current, [active.id]: session }));
      setMessages(current => ({ ...current, [active.id]: [...(current[active.id] ?? []), { role: "system", kind: "task-mode-started", taskModeLabel: mode.label, taskModeLocation: location, content: "任务模式已启动", createdAt: startedAt }] }));
      await sendMessage(active, payload.instruction, [], false, session, true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const jumpToTaskBusiness = () => {
    const location = activeTaskMode?.location;
    if (activeTaskMode?.id === "general-task") { setAppView("taskWorkbench"); window.dispatchEvent(new Event("rich:close-deliverable-codex")); return; }
    const project = location?.project;
    const business = location?.business;
    if (!project || business?.kind !== "交付物") return;
    requestShortcutOpen({ kind: "project", id: project.id });
    setAppView("projects");
    window.dispatchEvent(new Event("rich:close-deliverable-codex"));
    window.requestAnimationFrame(() => requestDeliverableItemFocus(project.id, business.id));
  };
  useEffect(() => {
    if (!taskModePickerOpen) return;
    const handleTaskModeKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); event.stopPropagation();
        setTaskModeIndex(current => (current + (event.key === "ArrowDown" ? 1 : -1) + availableTaskModes.length) % availableTaskModes.length);
      } else if (event.key === "Enter") {
        event.preventDefault(); event.stopPropagation(); void startTaskMode(availableTaskModes[taskModeIndex]);
      } else if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); setTaskModePickerOpen(false);
        window.requestAnimationFrame(() => composerTextareaRef.current?.focus());
      }
    };
    window.addEventListener("keydown", handleTaskModeKey, true);
    return () => window.removeEventListener("keydown", handleTaskModeKey, true);
  }, [active?.id, availableTaskModes, taskModeIndex, taskModePickerOpen]);
  useEffect(() => {
    if (streaming || queuedMessages.length === 0) return;
    const [next, ...rest] = queuedMessages;
    setQueuedMessages(rest);
    void sendMessage(next.conversation, next.content, next.attachments, false);
  }, [streaming, queuedMessages]);

  const workbenchStyle = windowState.maximized
    ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%", maxWidth: "none", maxHeight: "none", borderRadius: 0, transform: "none" }
    : { width: windowState.width, height: windowState.height, transform: `translate(${windowState.x}px, ${windowState.y}px)` };
  const displayedMessages: Message[] = active
    ? (messages[active.id] ?? []).filter(message => message.role !== "system" || message.kind === "task-mode-started" || message.kind === "task-mode-policy-updated")
    : [];
  const workbench = <div className={`deliverable-codex-backdrop${visible ? "" : " is-hidden"}${windowState.maximized ? " is-maximized" : ""}${capturingCurrentView ? " is-capturing-current-view" : ""}`} style={windowState.maximized ? { zIndex: 2147483000, top: desktopTitlebarHeight, padding: 0, background: "#09090a" } : undefined} role="dialog" aria-modal="true" aria-label="交付物 Codex 对话">
    <section className={`deliverable-codex-workbench is-theme-${theme}${activeTaskMode ? " is-task-mode" : ""}${windowState.maximized ? " is-maximized" : ""}`} style={workbenchStyle}>
      <aside className="deliverable-codex-workbench__sidebar">
        <button type="button" className="deliverable-codex-workbench__new" onClick={() => { setCreating(current => !current); setTitle(""); }}>＋ 新对话</button>
        <nav aria-label="对话列表">{conversations.map(conversation => <button key={conversation.id} draggable type="button" className={`${conversation.id === activeId ? "is-active" : ""}${lostConversationIds.has(conversation.id) ? " is-connection-lost" : ""}`} onDragStart={event => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", conversation.id); }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const sourceId = event.dataTransfer.getData("text/plain"); if (!sourceId || sourceId === conversation.id) return; setConversations(current => { const sourceIndex = current.findIndex(item => item.id === sourceId); const targetIndex = current.findIndex(item => item.id === conversation.id); if (sourceIndex < 0 || targetIndex < 0) return current; const next = [...current]; const [moved] = next.splice(sourceIndex, 1); next.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, moved); saveConversationOrder(next); return next; }); }} onClick={() => { shouldFollowMessagesRef.current = true; setActiveId(conversation.id); }}><strong>{conversation.title}</strong></button>)}</nav>
        <div className="deliverable-codex-workbench__theme">
          <button type="button" aria-label="选择主题" title="主题" aria-expanded={themeMenuOpen} onClick={() => setThemeMenuOpen(current => !current)}>◐</button>
          {themeMenuOpen && <div className="deliverable-codex-workbench__theme-menu" role="menu"><button type="button" role="menuitem" className={theme === "obsidian" ? "is-active" : ""} onClick={() => { setTheme("obsidian"); setThemeMenuOpen(false); }}><i/>曜黑</button><button type="button" role="menuitem" className={theme === "graphite" ? "is-active" : ""} onClick={() => { setTheme("graphite"); setThemeMenuOpen(false); }}><i/>石墨灰</button></div>}
        </div>
      </aside>
      <div className="deliverable-codex-workbench__content">
        <header className="deliverable-codex-workbench__tabs" onPointerDown={beginDrag} onPointerMove={drag} onPointerUp={() => { dragRef.current = undefined; }}>
          <div ref={conversationMenuRef} className="deliverable-codex-workbench__title-group">{editingTitle ? <input ref={titleInputRef} aria-label="会话标题" value={editableTitle} disabled={!active} onChange={event => setEditableTitle(event.target.value)} onBlur={() => { setEditingTitle(false); void rename(); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setEditableTitle(active?.title ?? ""); setEditingTitle(false); } }}/> : <span className="deliverable-codex-workbench__title" title="双击编辑标题" onDoubleClick={() => { if (active) setEditingTitle(true); }}>{active?.title ?? "新会话"}</span>}<div className="deliverable-codex-workbench__conversation-menu"><button type="button" aria-label="更多会话操作" aria-expanded={conversationMenuOpen} disabled={!active} onClick={() => setConversationMenuOpen(current => !current)}>•••</button>{conversationMenuOpen && <div role="menu"><button type="button" role="menuitem" onClick={() => { setConversationMenuOpen(false); setEditingTitle(true); }}>重命名</button><button type="button" role="menuitem" onClick={() => { setConversationMenuOpen(false); void archive(); }}>归档</button></div>}</div></div>
          <button type="button" title={windowState.maximized ? "还原窗口" : "全屏"} onClick={() => setWindowState(current => ({ ...current, maximized: !current.maximized }))}>{windowState.maximized ? "↙" : "⛶"}</button>{activeTaskMode && <div className="deliverable-codex-workbench__task-mode-bar"><button type="button" onClick={jumpToTaskBusiness} disabled={!activeTaskMode.location}>{activeTaskMode.id === "general-task" ? "任务：" : "交付物："}{activeTaskMode.location?.business?.title ?? "当前页面"}</button><b>任务模式：{activeTaskMode.label}</b></div>}
        </header>
        {creating && <form className="deliverable-codex-workbench__create" onSubmit={event => { event.preventDefault(); void create(); }}><input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="会话标题"/><button type="submit">创建</button></form>}
        {taskModePickerOpen && <section className="deliverable-codex-workbench__task-mode-picker" role="listbox" aria-label="任务模式选择"><small>当前页面：{currentPageLocation(appView).join(" / ")}</small>{availableTaskModes.map((mode, index) => <button key={mode.id} type="button" role="option" aria-selected={index === taskModeIndex} className={index === taskModeIndex ? "is-active" : ""} onClick={() => startTaskMode(mode)}><b>{mode.label}</b><span>{mode.hint} · Enter 启动</span></button>)}</section>}
        {projectTaskPickerOpen && <section className="deliverable-codex-workbench__task-mode-picker" role="dialog" aria-label="选择项目交付物"><small>{pickerProjectId ? "选择交付物" : "选择项目"}</small>{!pickerProjectId ? Array.from(elements.values()).filter(item => item.type === "project").map(item => <button key={item.id} type="button" onClick={() => { setPickerProjectId(item.id); void api.listProjectManagementModuleItems(item.id, "deliverables", undefined, true).then(items => setPickerDeliverables(items.map(entry => ({ id: entry.id, title: entry.title })))).catch(reason => setError(String(reason))); }}><b>{item.title}</b><span>选择该项目的交付物</span></button>) : <><button type="button" onClick={() => { setPickerProjectId(undefined); setPickerDeliverables([]); }}>← 返回项目</button>{pickerDeliverables.map(item => <button key={item.id} type="button" onClick={() => { setPendingAiTask({ sceneId: "deliverable_task", label: "交付物任务", payload: { projectId: pickerProjectId, deliverableId: item.id, deliverableTitle: item.title } }); setInput(`请描述交付物「${item.title}」的任务目标和交付要求。`); setProjectTaskPickerOpen(false); }}><b>{item.title}</b><span>创建交付物任务</span></button>)}</>}<button type="button" onClick={() => setProjectTaskPickerOpen(false)}>取消</button></section>}
        <main ref={messagesRef} className="deliverable-codex-workbench__messages" onScroll={updateMessageFollowState}>
          {active ? displayedMessages.map((message, index) => {
            const isTaskModeStart = message.kind === "task-mode-started";
            const isTaskInstruction = message.kind === "task-mode-instruction" || message.kind === "task-mode-policy-updated";
            const isTaskPolicyUpdate = message.kind === "task-mode-policy-updated";
            return <article key={index} className={`${isTaskModeStart ? "is-event" : isTaskInstruction ? "is-task-instruction" : `is-${message.role}`}${streaming && message.role === "assistant" && index === displayedMessages.length - 1 ? " is-streaming" : ""}`}>
              {message.role === "assistant" && <div className="deliverable-codex-workbench__duration">用时 {formatDuration(message.durationMs ?? (streaming && index === displayedMessages.length - 1 ? elapsedMs : 0))}</div>}
              <div className="deliverable-codex-workbench__message-bubble">
                {message.attachments?.length ? <div className="deliverable-codex-workbench__message-images">{message.attachments.map((attachment, imageIndex) => <img key={attachment.id ?? imageIndex} src={attachment.previewUrl ?? attachment.url ?? `/api/chat/attachments/${attachment.id}/data`} alt={message.role === "assistant" ? "Codex 生成图片" : "已发送图片"} onClick={() => setPreviewUrl(attachment.previewUrl ?? attachment.url ?? `/api/chat/attachments/${attachment.id}/data`)}/>)}</div> : null}
                {isTaskModeStart
                  ? <section className="deliverable-codex-workbench__event-card"><header><i aria-hidden="true">✦</i><span><small>任务模式已启动</small><b>{message.taskModeLabel ?? message.content.replace("任务模式已启动 · ", "")}</b></span><time>已就绪</time></header><div><span><small>页面定位</small><b>{message.taskModeLocation?.page.join(" / ") ?? "定位信息缺失"}</b></span><span><small>业务定位</small><b>{message.taskModeLocation?.business ? `${message.taskModeLocation.business.kind}：${message.taskModeLocation.business.title}` : "不适用"}</b></span></div></section>
                  : isTaskInstruction
                    ? <section className="deliverable-codex-workbench__instruction-card"><header><span>{isTaskPolicyUpdate ? "本次规则已同步给 Codex" : "任务上下文已交给 Codex"}</span><b>{isTaskPolicyUpdate ? "规则更新" : message.taskModeLabel ?? "任务模式"}</b></header><div><RichContent text={message.content}/></div></section>
                  : <div className="deliverable-codex-workbench__markdown"><RichContent text={message.content}/></div>}
              </div>
              <div className="deliverable-codex-workbench__message-meta"><time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>{message.role === "assistant" && message.content && <button type="button" className="deliverable-codex-workbench__message-format" title="整理排版" aria-label="整理排版" disabled={isResponding} onClick={() => reformatAssistantMessage(message.content)}>☷</button>}<button type="button" className="deliverable-codex-workbench__message-copy" title="复制" aria-label="复制消息" onMouseDown={event => event.preventDefault()} onClick={event => { const selectedText = selectedTextInMessage(event.currentTarget.closest("article")); void copyMessage(selectedText || message.content); }}>⧉</button>{message.role === "user" && !isTaskModeStart && <button type="button" className="deliverable-codex-workbench__resend" title="重新发送" aria-label="重新发送" disabled={streaming} onClick={() => resendMessage(message.content, message.attachments)}>↻</button>}</div>
            </article>;
          }) : <p className="deliverable-codex-workbench__empty">新建一个会话，开始围绕此交付物对话。</p>}
        </main>
        {error && <p className="deliverable-codex-workbench__error">{error}</p>}
        {queuedMessages.filter(message => message.conversation.id === active?.id).length > 0 && <section className="deliverable-codex-workbench__queue" aria-label="排队消息">{queuedMessages.filter(message => message.conversation.id === active?.id).map(message => <article key={message.id}>{message.attachments[0]?.previewUrl && <img src={message.attachments[0].previewUrl} alt="排队图片"/>}<p>{message.content}</p><button type="button" title="中断当前回复并调整" aria-label="中断当前回复并调整" onClick={() => void interruptAndSend(message)}>↳ 调整</button><button type="button" title="删除" aria-label="删除排队消息" onClick={() => setQueuedMessages(current => current.filter(item => item.id !== message.id))}>⌫</button><button type="button" aria-label="更多排队操作" onClick={() => setQueueMenuId(current => current === message.id ? undefined : message.id)}>•••</button>{queueMenuId === message.id && <div role="menu"><button type="button" role="menuitem" onClick={() => { setQueuedMessages(current => [message, ...current.filter(item => item.id !== message.id)]); setQueueMenuId(undefined); }}>移到队首</button></div>}</article>)}</section>}
        <footer className="deliverable-codex-workbench__composer"><div className={`deliverable-codex-workbench__turn-status${isResponding ? " is-running" : ""}`} role="status"><i aria-hidden="true"/>{isResponding ? "Codex 正在回复…" : "Codex 已完成，可继续提问"}</div>{locationContext && <div className="deliverable-codex-workbench__location"><span><i aria-hidden="true"/><b>页面定位</b><small>{attachedLocation.page.join(" / ")}</small>{attachedLocation.project && attachedLocation.business && <><b>业务定位</b><small>项目：{attachedLocation.project.title}（项目编号：{attachedLocation.project.id}） / {attachedLocation.business.kind}：{attachedLocation.business.title}（{attachedLocation.business.kind}编号：{attachedLocation.business.id}）</small></>}</span><button type="button" aria-label="移除页面和业务定位" onClick={() => setLocationAttached(false)}>×</button></div>}{composer.attachments.length > 0 && <div className="deliverable-codex-workbench__attachments">{composer.attachments.map(attachment => <figure key={attachment.clientId}><button type="button" onClick={() => setPreviewUrl(attachment.previewUrl)}><img src={attachment.previewUrl} alt="已粘贴图片"/></button><button type="button" aria-label="删除图片" onClick={() => composer.detach(attachment.clientId)}>×</button></figure>)}</div>}<input ref={composerFilePickerRef} className="deliverable-codex-workbench__file-picker" type="file" accept="image/*" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void composer.attach(file); event.currentTarget.value = ""; }}/><textarea ref={composerTextareaRef} rows={1} value={input} disabled={!active} onChange={event => setInput(event.target.value)} onPaste={event => { const image = Array.from(event.clipboardData.items).find(item => item.type.startsWith("image/"))?.getAsFile(); if (image) { event.preventDefault(); void composer.attach(image); } }} onKeyDown={event => { if (codexSlash.open && codexTools.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) { event.preventDefault(); setToolIndex(current => (current + (event.key === "ArrowDown" ? 1 : -1) + codexTools.length) % codexTools.length); return; } if (codexSlash.open && event.key === "Enter" && !event.shiftKey) { event.preventDefault(); chooseCodexTool(codexTools[toolIndex] ?? codexTools[0]); return; } if (codexSlash.open && event.key === "Escape") { event.preventDefault(); setInput(""); return; } if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); queueOrSend(); } }} placeholder={active ? "随心输入，输入 / 选择工具" : "请先新建会话"}/>{codexSlash.open && <div className="deliverable-codex-workbench__composer-menu deliverable-codex-workbench__tool-menu" role="listbox" aria-label="Codex 工具列表"><b>添加</b>{codexTools.length > 0 ? codexTools.map((tool, index) => <button key={tool.id} type="button" role="option" aria-selected={index === toolIndex} className={index === toolIndex ? "is-active" : ""} onMouseDown={event => event.preventDefault()} onClick={() => chooseCodexTool(tool)}><i className={tool.id === "image" ? "is-file" : tool.id === "location" ? "is-location" : "is-screenshot"}/><span>{tool.label}<small>{tool.hint}</small></span></button>) : <p>没有匹配的工具</p>}</div>}<div ref={composerMenuRef} className="deliverable-codex-workbench__composer-actions">{composerMenuOpen && <div className="deliverable-codex-workbench__composer-menu" role="menu"><b>添加</b><button type="button" role="menuitem" onClick={() => { setComposerMenuOpen(false); composerFilePickerRef.current?.click(); }}><i className="is-file"/><span>图片</span></button><button type="button" role="menuitem" onClick={() => { setLocationAttached(true); setComposerMenuOpen(false); }}><i className="is-location"/><span>定位 <small>附加当前页面定位</small></span></button><button type="button" role="menuitem" onClick={() => void attachCurrentViewScreenshot()}><i className="is-screenshot"/><span>定位截图 <small>将当前界面作为图片附加</small></span></button></div>}<button type="button" className="deliverable-codex-workbench__add-button" aria-label="打开附加功能" title="附加功能" disabled={!active} onClick={() => setComposerMenuOpen(current => !current)}>＋</button><button type="button" aria-label={isResponding ? "Codex 正在响应" : "发送消息"} disabled={!active || (!input.trim() && composer.attachments.length === 0) || composer.isUploading} onClick={queueOrSend}>{isResponding ? "＋" : "↑"}</button></div></footer>
        {isResponding && <button type="button" className="deliverable-codex-workbench__turn-stop" aria-label="停止回复" title="停止回复" onClick={() => void interruptCurrentTurn()}>■</button>}
      </div>
      {previewUrl && <div className="deliverable-codex-workbench__image-preview" role="dialog" aria-modal="true" onClick={() => setPreviewUrl(undefined)}><img src={previewUrl} alt="粘贴图片预览"/></div>}
      <i className="deliverable-codex-workbench__resize" onPointerDown={event => { const start = { x: event.clientX, y: event.clientY, width: windowState.width, height: windowState.height }; event.currentTarget.setPointerCapture(event.pointerId); const resize = (move: PointerEvent) => setWindowState(current => fitWindowToViewport({ ...current, width: start.width + move.clientX - start.x, height: start.height + move.clientY - start.y })); const stop = () => { window.removeEventListener("pointermove", resize); window.removeEventListener("pointerup", stop); }; window.addEventListener("pointermove", resize); window.addEventListener("pointerup", stop); }}/>
    </section>
  </div>;
  return createPortal(workbench, document.body);
}
