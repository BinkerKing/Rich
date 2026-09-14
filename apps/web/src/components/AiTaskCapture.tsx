import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { api, type AiManagedTask } from "../api/client.js";
import { useChatComposer } from "../lib/useChatComposer.js";
import { useStore } from "../state/store.js";
import { openBoundCodex } from "../views/project-management/deliverables/DeliverableCodexLauncher.js";
import "./AiTaskCapture.css";

const modes: Array<{ id: AiManagedTask["sceneId"]; token: string; label: string; description: string }> = [
  { id: "bug_fix", token: "/bug", label: "BUG", description: "记录当前页面的 Bug 修复任务" },
  { id: "requirement_analysis", token: "/requirement", label: "需求", description: "登记需求分析任务" },
  { id: "deliverable_task", token: "/task", label: "任务", description: "登记交付任务" },
  { id: "system_improvement", token: "/improve", label: "改造", description: "登记系统改造任务" },
];
const listCommand = { token: "/list", label: "清单", description: "查看当前未结束的 AI 任务" };
const taskTypeLabel: Record<AiManagedTask["sceneId"], string> = { bug_fix: "BUG", requirement_analysis: "需求", deliverable_task: "任务", system_improvement: "改造" };
const taskStatusLabel: Record<AiManagedTask["status"], string> = { draft: "暂存", ready: "待认领", claimed: "处理中", needs_review: "处理完成", blocked: "有阻塞", resolved: "已解决" };
function taskPageLocation(task: AiManagedTask): string { const page = task.payload.page; return Array.isArray(page) ? page.filter((item): item is string => typeof item === "string").join(" / ") || "—" : "—"; }

const viewLabels: Record<string, string> = { aiTaskManagement: "AI 任务管理", projects: "项目管理", deliverables: "交付物", taskWorkbench: "任务工作台" };
function currentTaskLocation(appView: string): string {
  const root = viewLabels[appView] ?? appView;
  if (appView !== "projects" || typeof document === "undefined") return root;
  const menu = document.querySelector<HTMLElement>(".prj-ws__nav-btn[aria-selected=\"true\"]")?.getAttribute("aria-label")?.trim();
  return menu ? `${root} / ${menu}` : root;
}
type Box = { x: number; y: number; width: number; height: number };
type Note = { x: number; y: number; text: string };
type AnnotationState = { boxes: Box[]; notes: Note[] };
type ScreenshotEditorHandle = { save: () => void };
type CaptureFrame = { x: number; y: number; width: number; height: number };
const frameStorageKey = "rich.ai-task-capture.frame";

function defaultFrame(): CaptureFrame {
  const width = Math.min(860, window.innerWidth - 48);
  const height = Math.min(560, window.innerHeight - 48);
  return { width, height, x: Math.max(24, (window.innerWidth - width) / 2), y: Math.max(24, (window.innerHeight - height) / 2) };
}

function readFrame(): CaptureFrame {
  try {
    const saved = JSON.parse(window.localStorage.getItem(frameStorageKey) ?? "null");
    if ([saved?.x, saved?.y, saved?.width, saved?.height].every(value => typeof value === "number")) return saved;
  } catch { /* use the centered default */ }
  return defaultFrame();
}

function clampFrame(frame: CaptureFrame): CaptureFrame {
  const width = Math.min(Math.max(480, frame.width), window.innerWidth - 24);
  const height = Math.min(Math.max(360, frame.height), window.innerHeight - 24);
  return { width, height, x: Math.min(Math.max(12, frame.x), window.innerWidth - width - 12), y: Math.min(Math.max(12, frame.y), window.innerHeight - height - 12) };
}

const ScreenshotEditor = forwardRef<ScreenshotEditorHandle, { source: string; onSave: (file: File) => void }>(function ScreenshotEditor({ source, onSave }, ref) {
  const image = useRef<HTMLImageElement>(null);
  const [history, setHistory] = useState<AnnotationState[]>([{ boxes: [], notes: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tool, setTool] = useState<"box" | "text">("box");
  const [ready, setReady] = useState(false);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Box>();
  const [dragPreview, setDragPreview] = useState<AnnotationState>();
  const [activeNote, setActiveNote] = useState<number>();
  const dragging = useRef<{ kind: "box" | "note"; index: number; start: { x: number; y: number }; origin: Box | Note }>();
  const dragState = useRef<AnnotationState>();
  const noteInputs = useRef(new Map<number, HTMLInputElement>());
  const annotations = history[historyIndex]!;
  const displayed = dragPreview ?? annotations;

  const commit = (next: AnnotationState) => {
    dragState.current = undefined;
    setDragPreview(undefined);
    setHistory(previous => [...previous.slice(0, historyIndex + 1), next]);
    setHistoryIndex(historyIndex + 1);
  };

  const point = (event: React.MouseEvent<HTMLElement>) => {
    const img = image.current!;
    const rect = img.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (img.naturalWidth / rect.width), y: (event.clientY - rect.top) * (img.naturalHeight / rect.height) };
  };
  const pointerDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ready) return;
    const p = point(event);
    if (tool === "text") {
      commit({ ...annotations, notes: [...annotations.notes, { ...p, text: "" }] });
      setActiveNote(annotations.notes.length);
      return;
    }
    drawing.current = p;
  };
  const pointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragging.current) {
      const current = dragging.current;
      const p = point(event);
      const deltaX = p.x - current.start.x;
      const deltaY = p.y - current.start.y;
      const next = current.kind === "box"
        ? { ...annotations, boxes: annotations.boxes.map((box, index) => index === current.index ? { ...box, x: Math.max(0, current.origin.x + deltaX), y: Math.max(0, current.origin.y + deltaY) } : box) }
        : { ...annotations, notes: annotations.notes.map((note, index) => index === current.index ? { ...note, x: Math.max(0, current.origin.x + deltaX), y: Math.max(0, current.origin.y + deltaY) } : note) };
      dragState.current = next;
      setDragPreview(next);
      return;
    }
    if (!drawing.current) return;
    const p = point(event);
    setDraft({ x: Math.min(drawing.current.x, p.x), y: Math.min(drawing.current.y, p.y), width: Math.abs(p.x - drawing.current.x), height: Math.abs(p.y - drawing.current.y) });
  };
  const pointerUp = () => {
    if (dragging.current) {
      const next = dragState.current;
      dragging.current = undefined;
      if (next) commit(next);
      return;
    }
    if (draft && draft.width > 4 && draft.height > 4) commit({ ...annotations, boxes: [...annotations.boxes, draft] });
    drawing.current = null;
    setDraft(undefined);
  };
  const save = () => {
    const original = image.current;
    if (!original) return;
    const canvas = document.createElement("canvas");
    canvas.width = original.naturalWidth;
    canvas.height = original.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(original, 0, 0);
    ctx.strokeStyle = "#ef5350";
    ctx.fillStyle = "#ef5350";
    ctx.lineWidth = Math.max(3, canvas.width / 480);
    annotations.boxes.forEach(box => ctx.strokeRect(box.x, box.y, box.width, box.height));
    ctx.font = `${Math.max(18, canvas.width / 48)}px sans-serif`;
    annotations.notes.filter(note => note.text.trim()).forEach(note => ctx.fillText(note.text, note.x, note.y + Math.max(18, canvas.width / 48)));
    canvas.toBlob(blob => { if (blob) onSave(new File([blob], "annotated-screenshot.png", { type: "image/png" })); }, "image/png");
  };
  const percent = (value: number, total: number) => `${(value / total) * 100}%`;
  const startMove = (event: React.MouseEvent<HTMLElement>, kind: "box" | "note", index: number) => {
    event.stopPropagation();
    const origin = kind === "box" ? annotations.boxes[index]! : annotations.notes[index]!;
    dragging.current = { kind, index, start: point(event), origin };
  };
  const discardEmptyNote = (index: number) => {
    if (!annotations.notes[index]?.text.trim()) commit({ ...annotations, notes: annotations.notes.filter((_, noteIndex) => noteIndex !== index) });
  };
  useEffect(() => {
    if (activeNote === undefined) return;
    requestAnimationFrame(() => {
      const input = noteInputs.current.get(activeNote);
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }, [activeNote, historyIndex]);
  useImperativeHandle(ref, () => ({ save }), [annotations]);

  const buttonStyle = (active = false): React.CSSProperties => ({ display: "grid", width: 32, height: 32, padding: 0, placeItems: "center", border: "1px solid #596267", background: active ? "#e4eaeb" : "#1c2022", color: active ? "#192022" : "#e6ebed", cursor: "pointer" });
  return <section className="ai-task-inline-editor" aria-label="编辑任务截图" style={{ marginTop: 12, padding: 12, border: "1px solid #596267", borderRadius: 10, background: "#101214", overflow: "auto" }}>
    <div style={{ position: "relative", display: "inline-block", minHeight: 0, border: "1px solid #647077", background: "#080a0b", lineHeight: 0 }} onMouseDown={pointerDown} onMouseMove={pointerMove} onMouseUp={pointerUp} onMouseLeave={pointerUp}>
      <div role="toolbar" aria-label="截图标注工具" style={{ position: "absolute", zIndex: 1, top: 8, right: 8, display: "flex", boxShadow: "0 4px 16px #0008" }}>
        <button type="button" aria-label="画框" title="画框" style={{ ...buttonStyle(tool === "box"), borderRadius: "6px 0 0 6px" }} onMouseDown={event => event.stopPropagation()} onClick={() => setTool("box")}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 18.5 5.5l2 2L7 21H5v-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="m14.5 7 2.5 2.5" stroke="currentColor" strokeWidth="1.8" /></svg></button>
        <button type="button" aria-label="添加文字" title="添加文字" style={buttonStyle(tool === "text")} onMouseDown={event => event.stopPropagation()} onClick={() => setTool("text")}><b style={{ fontSize: 15, lineHeight: 1 }}>A</b></button>
        <button type="button" aria-label="撤销" title="撤销" disabled={historyIndex === 0} style={{ ...buttonStyle(), opacity: historyIndex === 0 ? .38 : 1 }} onMouseDown={event => event.stopPropagation()} onClick={() => setHistoryIndex(index => Math.max(0, index - 1))}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 7 4 12l5 5M5 12h9a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <button type="button" aria-label="重做" title="重做" disabled={historyIndex === history.length - 1} style={{ ...buttonStyle(), borderRadius: "0 6px 6px 0", opacity: historyIndex === history.length - 1 ? .38 : 1 }} onMouseDown={event => event.stopPropagation()} onClick={() => setHistoryIndex(index => Math.min(history.length - 1, index + 1))}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 7 5 5-5 5M19 12h-9a5 5 0 0 0-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      </div>
      {!ready && <span style={{ color: "#c6ced1", lineHeight: "44px" }}>正在载入截图…</span>}
      <img ref={image} style={{ display: "block", maxWidth: "100%", maxHeight: "58vh", cursor: tool === "box" ? "crosshair" : "text" }} src={source} alt="待标注截图" onLoad={() => setReady(true)} />
      {ready && [...displayed.boxes, ...(draft ? [draft] : [])].map((box, index) => <i key={`box-${index}`} onMouseDown={event => startMove(event, "box", index)} style={{ position: "absolute", boxSizing: "border-box", border: "3px solid #ef5350", cursor: "move", left: percent(box.x, image.current!.naturalWidth), top: percent(box.y, image.current!.naturalHeight), width: percent(box.width, image.current!.naturalWidth), height: percent(box.height, image.current!.naturalHeight) }} />)}
      {ready && displayed.notes.map((note, index) => activeNote === index ? <input key={`note-${index}`} ref={element => { if (element) noteInputs.current.set(index, element); else noteInputs.current.delete(index); }} value={note.text} aria-label="图片文字标注" onMouseDown={event => event.stopPropagation()} onBlur={() => { setActiveNote(undefined); discardEmptyNote(index); }} onChange={event => commit({ ...annotations, notes: annotations.notes.map((item, noteIndex) => noteIndex === index ? { ...item, text: event.target.value } : item) })} style={{ position: "absolute", width: `${Math.max(2, note.text.length + 1)}ch`, minWidth: "2ch", border: 0, borderBottom: "1px solid #ef5350", padding: 0, outline: "none", background: "transparent", color: "#ef5350", font: "600 18px/1.25 sans-serif", textShadow: "0 1px 2px #000", left: percent(note.x, image.current!.naturalWidth), top: percent(note.y, image.current!.naturalHeight) }} /> : <span key={`note-${index}`} onMouseDown={event => startMove(event, "note", index)} onDoubleClick={() => setActiveNote(index)} style={{ position: "absolute", color: "#ef5350", font: "600 18px/1.25 sans-serif", lineHeight: 1.25, textShadow: "0 1px 2px #000", cursor: "move", userSelect: "none", left: percent(note.x, image.current!.naturalWidth), top: percent(note.y, image.current!.naturalHeight) }}>{note.text}</span>)}
    </div>
  </section>;
});

export function AiTaskCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<AiManagedTask["sceneId"]>("bug_fix");
  const [selectedMode, setSelectedMode] = useState<AiManagedTask["sceneId"]>();
  const [draftId, setDraftId] = useState<string>();
  const [republishId, setRepublishId] = useState<string>();
  const [listMode, setListMode] = useState(true);
  const [listedTasks, setListedTasks] = useState<AiManagedTask[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string>();
  const [executorPickerTaskId, setExecutorPickerTaskId] = useState<string>();
  const [frozenLocation, setFrozenLocation] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [editing, setEditing] = useState<{ clientId: string; source: string }>();
  const [frame, setFrame] = useState<CaptureFrame>(readFrame);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<ScreenshotEditorHandle>(null);
  const openRef = useRef(false);
  const executorPickerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!executorPickerTaskId) return;

    const closeExecutorPicker = (event: PointerEvent) => {
      if (!executorPickerRef.current?.contains(event.target as Node)) {
        setExecutorPickerTaskId(undefined);
      }
    };

    document.addEventListener("pointerdown", closeExecutorPicker);
    return () => document.removeEventListener("pointerdown", closeExecutorPicker);
  }, [executorPickerTaskId]);
  const composer = useChatComposer({ maxAttachments: 4 });
  const appView = useStore(s => s.appView);
  const location = currentTaskLocation(appView);
  const taskLocation = frozenLocation ?? location;

  useEffect(() => {
    if (editing && !composer.attachments.some(item => item.clientId === editing.clientId)) setEditing(undefined);
  }, [editing, composer.attachments]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    if (!open || !listMode) return;
    let active = true;
    setListLoading(true);
    void api.listAiManagedTasks().then(tasks => {
      if (active) setListedTasks(tasks);
    }).finally(() => {
      if (active) setListLoading(false);
    });
    return () => { active = false; };
  }, [open, listMode]);
  useEffect(() => {
    const show = () => {
      if (openRef.current) {
        setOpen(false);
        return;
      }
      window.dispatchEvent(new Event("rich:close-deliverable-codex"));
      setFrame(clampFrame(readFrame()));
      setOpen(true);
    };
    window.addEventListener("rich:open-ai-task-capture", show);
    return () => window.removeEventListener("rich:open-ai-task-capture", show);
  }, []);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("rich:close-ai-task-capture", close);
    return () => window.removeEventListener("rich:close-ai-task-capture", close);
  }, []);
  useEffect(() => { window.localStorage.setItem(frameStorageKey, JSON.stringify(frame)); }, [frame]);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 260)}px`;
    input.style.overflowY = input.scrollHeight > 260 ? "auto" : "hidden";
  }, [open, text]);
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const attachScreenshot = async () => {
    const richWindow = (window as Window & { richWindow?: { captureCurrentView?: () => Promise<string | null> } }).richWindow;
    try {
      setCapturing(true);
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const dataUrl = await richWindow?.captureCurrentView?.();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      await composer.attach(new File([blob], `Rich-${Date.now()}.png`, { type: "image/png" }));
    } finally {
      setCapturing(false);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }));
    }
  };
  const selectMode = (item: typeof modes[number]) => {
    setListMode(false);
    setDraftId(undefined);
    setRepublishId(undefined);
    setMode(item.id);
    setSelectedMode(item.id);
    setFrozenLocation(item.id === "bug_fix" ? location : undefined);
    setText(value => value.replace(/^\s*(?:#(?:BUG|需求|任务|改造)：)?\s*\/\w*\s*/i, ""));
    setSuggestionsOpen(false);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
    if (item.id === "bug_fix") {
      composer.clear();
      setEditing(undefined);
      requestAnimationFrame(() => void attachScreenshot());
    }
  };
  const selectListMode = () => {
    setListMode(true);
    setSelectedMode(undefined);
    setFrozenLocation(undefined);
    setDraftId(undefined);
    setRepublishId(undefined);
    composer.clear();
    setEditing(undefined);
    setText("");
    setSuggestionsOpen(false);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(0, 0);
    });
  };
  const update = (value: string) => {
    setText(value);
    const show = /^\s*\/\w*$/.test(value);
    setSuggestionsOpen(show);
    const hit = modes.find(item => value.trimStart().startsWith(item.token));
    if (hit) setMode(hit.id);
  };
  const confirmSlashMode = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    const command = text.trim().toLowerCase();
    if (command === listCommand.token) {
      event.preventDefault();
      selectListMode();
      return;
    }
    const item = modes.find(candidate => candidate.token === command);
    if (!item) return;
    event.preventDefault();
    selectMode(item);
  };
  const replaceAttachment = async (file: File) => {
    if (!editing) return;
    composer.detach(editing.clientId);
    await composer.attach(file);
    setEditing(undefined);
  };
  const detachAttachment = (clientId: string) => {
    composer.detach(clientId);
    if (editing?.clientId === clientId) setEditing(undefined);
  };
  const beginMove = (event: React.PointerEvent<HTMLElement>, resize = false) => {
    if (!resize && (event.target as Element).closest("button")) return;
    event.preventDefault();
    const start = frame;
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (next: PointerEvent) => {
      const deltaX = next.clientX - startX;
      const deltaY = next.clientY - startY;
      setFrame(clampFrame(resize ? { ...start, width: start.width + deltaX, height: start.height + deltaY } : { ...start, x: start.x + deltaX, y: start.y + deltaY }));
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  const submit = async () => {
    const content = text.replace(/^\s*(?:#(?:BUG|需求|任务|改造)：)?\s*\/(bug|requirement|task|improve)\s*/i, "").replace(/^\s*#(?:BUG|需求|任务|改造)：\s*/i, "").trim();
    if (!content || composer.isUploading) return;
    const taskInput = { sceneId: mode, title: content.slice(0, 80), input: { text: `页面定位：${taskLocation}\n\n${content}`, images: composer.getAttachmentRefs().map(item => ({ id: item.id, label: "任务截图", path: item.url, mime: item.mime })), materials: [] }, payload: { page: [taskLocation], draft: { text: content, location: taskLocation } }, contextSummary: content.slice(0, 2000) };
    setSaving(true);
    try {
      if (draftId) await api.publishAiManagedTaskDraft(draftId, taskInput); else if (republishId) await api.republishAiManagedTask(republishId, taskInput); else await api.createAiManagedTask(taskInput);
      composer.clear(); setText(""); setDraftId(undefined); setRepublishId(undefined); setSelectedMode(undefined); setListMode(false); setFrozenLocation(undefined); setOpen(false);
    } finally { setSaving(false); }
  };
  const saveDraft = async () => {
    if (!selectedMode || composer.isUploading || saving) return;
    const content = text.trim();
    const taskInput = { sceneId: mode, title: content.slice(0, 80) || `${modes.find(item => item.id === mode)?.label ?? "任务"} 草稿`, input: { text: `页面定位：${taskLocation}\n\n${content}`, images: composer.getAttachmentRefs().map(item => ({ id: item.id, label: "任务截图", path: item.url, mime: item.mime })), materials: [] }, payload: { page: [taskLocation], draft: { text: content, location: taskLocation } }, contextSummary: content.slice(0, 2000) };
    setSaving(true);
    try {
      const draft = await api.saveAiManagedTaskDraft(taskInput, draftId ?? republishId);
      setDraftId(draft.id);
      setRepublishId(undefined);
      composer.clear(); setText(""); setSelectedMode(undefined); setFrozenLocation(undefined); setListMode(true);
    } finally { setSaving(false); }
  };
  const restoreEditableTask = (task: AiManagedTask) => {
    if (task.status !== "draft" && task.status !== "ready") return;
    const draft = task.payload.draft;
    const saved = draft && typeof draft === "object" ? draft as { text?: unknown; location?: unknown } : undefined;
    setMode(task.sceneId); setSelectedMode(task.sceneId); setDraftId(task.status === "draft" ? task.id : undefined); setRepublishId(task.status === "ready" ? task.id : undefined); setListMode(false);
    setFrozenLocation(typeof saved?.location === "string" ? saved.location : undefined);
    setText(typeof saved?.text === "string" ? saved.text : task.contextSummary);
    composer.restore(task.input.images);
    setEditing(undefined);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  };
  const assignRichCodex = (task: AiManagedTask) => {
    setExecutorPickerTaskId(undefined);
    const prompt = [
      "# Rich BUG 处理任务",
      "",
      `- AI 任务唯一标识：${task.id}`,
      `- 当前页面定位：${Array.isArray(task.payload.page) ? task.payload.page.filter((item): item is string => typeof item === "string").join(" / ") : "未记录"}`,
      "- 此任务已由界面分配给执行人 `Rich·Codex`，状态已是“处理中”，并已写入本会话 ID；不要另建任务，也不要再次认领。",
      "",
      "## 必须遵守的执行流程",
      "1. 先调用 `rich_ai_task_get` 读取该唯一标识对应的完整 Bug 包、截图和上下文，再定位并修复问题。",
      "2. 每次完成代码修正后必须提交 Git，提交信息应准确说明修复内容。",
      "3. 默认不要重新部署或发布 Rich App；只有用户明确要求部署时才执行，并在结果中说明。",
      "4. 完成后必须调用 `rich_ai_task_report_result` 回写：`taskId` 使用上面的唯一标识，`agentId` 必须为 `Rich·Codex`，写明问题分析、处理结果、后续事项，并把 `statusAfter` 设为 `needs_review`（界面显示为“处理完成”）。",
      "5. 回写结果必须包含 Git 提交信息，以及是否部署 App（默认“未部署”）。",
      "",
      "现在开始处理该 Bug。",
    ].join("\n");
    openBoundCodex({ projectId: "__general__", deliverableId: "__general__", deliverableTitle: "Rich BUG 任务", executionTaskId: task.id, initialConversationTitle: `BUG · ${task.title.slice(0, 56)}`, initialPrompt: prompt });
  };
  const reviewTask = async (task: AiManagedTask, action: "resolve" | "continue") => {
    const next = action === "resolve" ? await api.resolveAiManagedTask(task.id) : await api.continueAiManagedTask(task.id);
    setListedTasks(current => current.map(item => item.id === task.id ? next : item));
    if (action !== "continue") return;
    openBoundCodex({ projectId: "__general__", deliverableId: "__general__", deliverableTitle: "Rich BUG 任务", executionTaskId: next.id, initialConversationTitle: `BUG · ${task.title.slice(0, 56)}`, initialPrompt: [`# 继续处理 Rich BUG`, "", `- 原始 Bug 任务 ID：${task.id}`, `- 延续任务 ID：${next.id}`, "- 此任务继承原 Bug 的描述、截图、分析和处理结果。先调用 rich_ai_task_get 读取延续任务，再继续修复并回写结果。"].join("\n") });
  };
  useEffect(() => {
    if (!open || !selectedMode) return;
    const onSave = (event: KeyboardEvent) => {
      if (!event.metaKey || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void saveDraft();
    };
    window.addEventListener("keydown", onSave);
    return () => window.removeEventListener("keydown", onSave);
  }, [open, selectedMode, saving, text, draftId, composer.isUploading]);

  if (!open) return null;
  const selectedModeItem = modes.find(item => item.id === selectedMode);
  const modeColor = listMode ? "#37b86b" : selectedMode === "bug_fix" ? "#ef5350" : "#7f8b90";
  const search = text.trim().toLocaleLowerCase();
  const visibleTasks = listedTasks.filter(task => task.status !== "resolved" && (!search || `${taskTypeLabel[task.sceneId]} ${task.title} ${taskStatusLabel[task.status]}`.toLocaleLowerCase().includes(search)));
  return <div className={`ai-task-capture${capturing ? " is-capturing" : ""}`} role="dialog" aria-modal="true" aria-label="登记 AI 任务">
    <section className="ai-task-capture__window" style={{ left: frame.x, top: frame.y, width: frame.width, height: "auto", minHeight: 0, maxHeight: "calc(100vh - 24px)" }}>
      <header className="ai-task-capture__titlebar" onPointerDown={beginMove}>
        <button type="button" title="点击重新定位" onClick={() => setFrozenLocation(location)} style={{ border: 0, padding: 0, background: "transparent", color: "inherit", font: "inherit", cursor: "pointer" }}>定位 · {taskLocation}</button>
        {selectedMode && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className="ai-task-capture__action" aria-label="截取当前界面" title="截取当前界面" onClick={() => void attachScreenshot()}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8h8v8H8z" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="ai-task-capture__action" aria-label={saving ? "正在登记" : "登记任务"} title={saving ? "正在登记" : "登记任务"} disabled={!text.replace(/^\s*#(?:BUG|需求|任务|改造)：\s*/, "").replace(/^\/\w+\s*/, "").trim() || saving || composer.isUploading} onClick={() => void submit()}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5v6a5 5 0 0 0 5 5h9m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        }
      </header>
      <div className="ai-task-capture__input-wrap" style={{ marginBottom: selectedMode || listMode ? 14 : 0 }}>
        <textarea ref={inputRef} autoFocus style={{ minHeight: 0, height: 56, borderColor: selectedMode || listMode ? modeColor : undefined }} value={text} onChange={event => update(event.target.value)} onPaste={event => {
          if (!selectedMode) return;
          const images = Array.from(event.clipboardData.items).flatMap(item => {
            if (!item.type.startsWith("image/")) return [];
            const file = item.getAsFile();
            return file ? [file] : [];
          });
          if (!images.length) return;
          event.preventDefault();
          images.forEach(image => void composer.attach(image));
        }} onKeyDown={confirmSlashMode} onFocus={() => setSuggestionsOpen(/^\s*\/\w*$/.test(text))} placeholder={listMode ? "搜索未结束的 AI 任务…" : "描述你要登记的任务…"} />
        {(selectedModeItem || listMode) && <span style={{ position: "absolute", zIndex: 1, left: 14, bottom: -13, border: `1px solid ${modeColor}`, borderRadius: 4, padding: "2px 8px", background: modeColor, color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: ".06em", lineHeight: 1.35 }}>{listMode ? listCommand.label : selectedModeItem?.label}</span>}
        {suggestionsOpen && <div className="ai-task-capture__suggestions" style={{ position: "static", marginTop: 8 }}>{[...modes, listCommand].filter(item => item.token.startsWith(text.trimStart().toLowerCase()) || text.trim() === "/").map(item => <button key={item.token} type="button" onMouseDown={event => { event.preventDefault(); "id" in item ? selectMode(item as typeof modes[number]) : selectListMode(); }}><b>{item.label}</b><span>{item.description}</span><kbd>{item.token}</kbd></button>)}</div>}
      </div>
      {listMode && <div style={{ marginTop: 18, borderTop: "1px solid #30383c" }}>
        <div style={{ display: "grid", gridTemplateColumns: "72px 150px minmax(0, 1fr) 150px 142px 92px", gap: 12, padding: "10px 4px 7px", color: "#89969b", fontSize: 12 }}><span>类型</span><span>定位</span><span>任务</span><span>状态</span><span>操作</span><span>执行人</span></div>
        {listLoading ? <p style={{ margin: "16px 0", color: "#99a5aa" }}>正在加载任务清单…</p> : visibleTasks.length ? visibleTasks.map(task => {
          const expanded = expandedTaskId === task.id;
          return <article key={task.id} title={task.status === "draft" ? "双击继续编辑暂存任务" : task.status === "ready" ? "双击调整并重新发布任务" : undefined} onClick={() => setExpandedTaskId(current => current === task.id ? undefined : task.id)} onDoubleClick={() => restoreEditableTask(task)} style={{ display: "grid", gridTemplateColumns: "72px 150px minmax(0, 1fr) 150px 142px 92px", gap: 12, alignItems: expanded ? "start" : "center", padding: "13px 4px", borderBottom: "1px solid #293034", cursor: "pointer" }}><b style={{ color: task.sceneId === "bug_fix" ? "#ff6269" : task.status === "draft" ? "#d7aa55" : "#68d891", fontSize: 12, letterSpacing: ".06em" }}>{taskTypeLabel[task.sceneId]}</b><small style={{ overflow: "hidden", color: "#aab6ba", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{taskPageLocation(task)}</small><span style={{ overflow: expanded ? "visible" : "hidden", color: "#eef3f4", fontWeight: 600, textOverflow: expanded ? undefined : "ellipsis", whiteSpace: expanded ? "normal" : "nowrap", overflowWrap: expanded ? "anywhere" : undefined }}>{task.title}</span>{task.status === "ready" && task.sceneId === "bug_fix" ? <span ref={executorPickerTaskId === task.id ? executorPickerRef : undefined} style={{ position: "relative" }}><button type="button" onClick={event => { event.stopPropagation(); setExecutorPickerTaskId(current => current === task.id ? undefined : task.id); }} style={{ border: 0, padding: 0, background: "transparent", color: "#9de0ae", font: "inherit", cursor: "pointer" }}>待认领</button>{executorPickerTaskId === task.id && <span style={{ position: "absolute", zIndex: 3, top: 24, left: 0, width: 164, border: "1px solid #4f5d62", borderRadius: 9, padding: 6, background: "#202426", boxShadow: "0 12px 28px #000a" }}><button type="button" onClick={event => { event.stopPropagation(); assignRichCodex(task); }} style={{ width: "100%", border: 0, borderRadius: 6, padding: "9px 10px", background: "transparent", color: "#eef4f5", font: "inherit", textAlign: "left", cursor: "pointer" }}>Rich · Codex</button></span>}</span> : <small style={{ color: task.status === "draft" ? "#d7aa55" : "#aab6ba" }}>{taskStatusLabel[task.status]}</small>}<span>{task.sceneId === "bug_fix" && task.status === "needs_review" && <span style={{ display: "flex", gap: 7 }}><button type="button" aria-label="验收完成" title="验收完成" onClick={event => { event.stopPropagation(); void reviewTask(task, "resolve"); }} style={{ width: 28, height: 28, border: "1px solid #39c979", borderRadius: "50%", padding: 0, background: "transparent", color: "#43df8b", fontSize: 17, fontWeight: 800, cursor: "pointer" }}>✓</button><button type="button" aria-label="继续处理" title="继续处理" onClick={event => { event.stopPropagation(); void reviewTask(task, "continue"); }} style={{ width: 28, height: 28, border: "1px solid #7b8790", borderRadius: "50%", padding: 0, background: "transparent", color: "#d4dbe0", fontSize: 17, fontWeight: 800, cursor: "pointer" }}>↻</button></span>}</span><small style={{ overflow: "hidden", color: "#aab6ba", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.claimedBy ?? "—"}</small></article>;
        }) : <p style={{ margin: "16px 0", color: "#99a5aa" }}>没有符合条件的未结束 AI 任务。</p>}
      </div>}
      {composer.attachments.length > 0 && <div className="ai-task-capture__images" style={{ marginTop: 16 }}>{composer.attachments.map(item => <figure key={item.clientId}><button type="button" className={`ai-task-capture__preview${editing?.clientId === item.clientId ? " is-selected" : ""}`} onClick={() => editing?.clientId === item.clientId ? editorRef.current?.save() : setEditing({ clientId: item.clientId, source: item.previewUrl })}><img src={item.previewUrl} alt="任务截图，点击编辑并再次点击保存" /></button><button type="button" className="ai-task-capture__remove" aria-label="删除截图" title="删除截图" onClick={() => detachAttachment(item.clientId)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button></figure>)}</div>}
      {editing && <ScreenshotEditor ref={editorRef} source={editing.source} onSave={file => void replaceAttachment(file)} />}
    </section>
  </div>;
}
