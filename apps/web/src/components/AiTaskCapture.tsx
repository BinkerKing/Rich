import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { api, type AiManagedTask } from "../api/client.js";
import { useChatComposer } from "../lib/useChatComposer.js";
import { useStore } from "../state/store.js";
import "./AiTaskCapture.css";

const modes: Array<{ id: AiManagedTask["sceneId"]; token: string; label: string; description: string }> = [
  { id: "bug_fix", token: "/bug", label: "BUG", description: "记录当前页面的 Bug 修复任务" },
  { id: "requirement_analysis", token: "/requirement", label: "需求", description: "登记需求分析任务" },
  { id: "deliverable_task", token: "/task", label: "任务", description: "登记交付任务" },
  { id: "system_improvement", token: "/improve", label: "改造", description: "登记系统改造任务" },
];

const viewLabels: Record<string, string> = { aiTaskManagement: "AI 任务管理", projects: "项目管理", deliverables: "交付物", taskWorkbench: "任务工作台" };
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
  const dragging = useRef<{ kind: "box" | "note"; index: number; start: { x: number; y: number }; origin: Box | Note }>();
  const dragState = useRef<AnnotationState>();
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
      {ready && displayed.notes.map((note, index) => <input key={`note-${index}`} autoFocus={index === displayed.notes.length - 1} value={note.text} aria-label="图片文字标注" onMouseDown={event => startMove(event, "note", index)} onBlur={() => discardEmptyNote(index)} onChange={event => commit({ ...annotations, notes: annotations.notes.map((item, noteIndex) => noteIndex === index ? { ...item, text: event.target.value } : item) })} style={{ position: "absolute", width: `${Math.max(2, note.text.length + 1)}ch`, minWidth: "2ch", border: 0, padding: 0, outline: "none", background: "transparent", color: "#ef5350", font: "600 18px/1.25 sans-serif", textShadow: "0 1px 2px #000", cursor: "move", left: percent(note.x, image.current!.naturalWidth), top: percent(note.y, image.current!.naturalHeight) }} />)}
    </div>
  </section>;
});

export function AiTaskCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<AiManagedTask["sceneId"]>("bug_fix");
  const [selectedMode, setSelectedMode] = useState<AiManagedTask["sceneId"]>();
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [editing, setEditing] = useState<{ clientId: string; source: string }>();
  const [frame, setFrame] = useState<CaptureFrame>(readFrame);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<ScreenshotEditorHandle>(null);
  const openRef = useRef(false);
  const composer = useChatComposer({ maxAttachments: 4 });
  const appView = useStore(s => s.appView);
  const setAppView = useStore(s => s.setAppView);
  const location = viewLabels[appView] ?? appView;

  useEffect(() => {
    openRef.current = open;
  }, [open]);
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
    } finally { setCapturing(false); }
  };
  const selectMode = (item: typeof modes[number]) => {
    setMode(item.id);
    setSelectedMode(item.id);
    setText(value => `#${item.label}：${value.replace(/^\s*(?:#(?:BUG|需求|任务|改造)：)?\s*\/\w*\s*/i, "")}`);
    setSuggestionsOpen(false);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
    if (item.id === "bug_fix" && composer.attachments.length === 0 && !composer.isUploading) {
      void attachScreenshot();
    }
  };
  const update = (value: string) => {
    setText(value);
    const show = /^\s*\/\w*$/.test(value);
    setSuggestionsOpen(show);
    if (!/^\s*#(?:BUG|需求|任务|改造)：/i.test(value)) setSelectedMode(undefined);
    const hit = modes.find(item => value.trimStart().startsWith(item.token));
    if (hit) setMode(hit.id);
  };
  const confirmSlashMode = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || text.trim().toLowerCase() !== "/bug") return;
    event.preventDefault();
    selectMode(modes[0]!);
  };
  const replaceAttachment = async (file: File) => {
    if (!editing) return;
    composer.detach(editing.clientId);
    await composer.attach(file);
    setEditing(undefined);
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
    setSaving(true);
    try {
      await api.createAiManagedTask({ sceneId: mode, title: content.slice(0, 80), input: { text: `页面定位：${location}\n\n${content}`, images: composer.getAttachmentRefs().map(item => ({ id: item.id, label: "任务截图", mime: item.mime })), materials: [] }, payload: { page: [location] }, contextSummary: content.slice(0, 2000) });
      composer.clear(); setText(""); setSelectedMode(undefined); setOpen(false); setAppView("aiTaskManagement");
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return <div className={`ai-task-capture${capturing ? " is-capturing" : ""}`} role="dialog" aria-modal="true" aria-label="登记 AI 任务">
    <section className="ai-task-capture__window" style={{ left: frame.x, top: frame.y, width: frame.width, height: "auto", minHeight: 0, maxHeight: "calc(100vh - 24px)" }}>
      <header className="ai-task-capture__titlebar" onPointerDown={beginMove}>
        <span>定位 · {location}</span>
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
      <div className="ai-task-capture__input-wrap">
        <textarea ref={inputRef} autoFocus style={{ minHeight: 0, height: 56 }} value={text} onChange={event => update(event.target.value)} onKeyDown={confirmSlashMode} onFocus={() => setSuggestionsOpen(/^\s*\/\w*$/.test(text))} placeholder="描述你要登记的任务…" />
        {suggestionsOpen && <div className="ai-task-capture__suggestions" style={{ position: "static", marginTop: 8 }}>{modes.filter(item => item.token.startsWith(text.trimStart().toLowerCase()) || text.trim() === "/").map(item => <button key={item.id} type="button" onMouseDown={event => { event.preventDefault(); selectMode(item); }}><b>{item.label}</b><span>{item.description}</span><kbd>{item.token}</kbd></button>)}</div>}
      </div>
      {composer.attachments.length > 0 && <div className="ai-task-capture__images">{composer.attachments.map(item => <figure key={item.clientId}><button type="button" className="ai-task-capture__preview" onClick={() => editing?.clientId === item.clientId ? editorRef.current?.save() : setEditing({ clientId: item.clientId, source: item.previewUrl })}><img src={item.previewUrl} alt="任务截图，点击编辑并再次点击保存" /></button><button type="button" className="ai-task-capture__remove" aria-label="删除截图" onClick={() => composer.detach(item.clientId)}>×</button><figcaption>点击标注，再次点击保存</figcaption></figure>)}</div>}
      {editing && <ScreenshotEditor ref={editorRef} source={editing.source} onSave={file => void replaceAttachment(file)} />}
    </section>
  </div>;
}
