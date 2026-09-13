import { useEffect, useRef, useState } from "react";
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

function ScreenshotEditor({ source, onSave, onClose }: { source: string; onSave: (file: File) => void; onClose: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tool, setTool] = useState<"box" | "text">("box");
  const [noteText, setNoteText] = useState("请查看这里");
  const [ready, setReady] = useState(false);
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Box>();

  const point = (event: React.MouseEvent<HTMLDivElement>) => {
    const img = image.current!;
    const rect = img.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (img.naturalWidth / rect.width), y: (event.clientY - rect.top) * (img.naturalHeight / rect.height) };
  };
  const pointerDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ready) return;
    const p = point(event);
    if (tool === "text") {
      if (noteText.trim()) setNotes(prev => [...prev, { ...p, text: noteText.trim() }]);
      return;
    }
    drawing.current = p;
  };
  const pointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!drawing.current) return;
    const p = point(event);
    setDraft({ x: Math.min(drawing.current.x, p.x), y: Math.min(drawing.current.y, p.y), width: Math.abs(p.x - drawing.current.x), height: Math.abs(p.y - drawing.current.y) });
  };
  const pointerUp = () => {
    if (draft && draft.width > 4 && draft.height > 4) setBoxes(prev => [...prev, draft]);
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
    boxes.forEach(box => ctx.strokeRect(box.x, box.y, box.width, box.height));
    ctx.font = `${Math.max(18, canvas.width / 48)}px sans-serif`;
    notes.forEach(note => {
      const pad = Math.max(6, canvas.width / 160);
      const width = ctx.measureText(note.text).width + pad * 2;
      const height = Math.max(28, canvas.width / 30);
      ctx.fillStyle = "#ef5350";
      ctx.fillRect(note.x, note.y - height, width, height);
      ctx.fillStyle = "#fff";
      ctx.fillText(note.text, note.x + pad, note.y - pad);
    });
    canvas.toBlob(blob => { if (blob) onSave(new File([blob], "annotated-screenshot.png", { type: "image/png" })); }, "image/png");
  };
  const percent = (value: number, total: number) => `${(value / total) * 100}%`;

  return <div className="ai-task-editor" role="dialog" aria-modal="true" aria-label="编辑任务截图" onClick={onClose}>
    <section onClick={event => event.stopPropagation()}>
      <header><strong>标注截图</strong><button type="button" aria-label="关闭" onClick={onClose}>×</button></header>
      <div className="ai-task-editor__tools">
        <button type="button" className={tool === "box" ? "is-active" : ""} onClick={() => setTool("box")}>画框</button>
        <button type="button" className={tool === "text" ? "is-active" : ""} onClick={() => setTool("text")}>文字</button>
        {tool === "text" && <input value={noteText} onChange={event => setNoteText(event.target.value)} aria-label="标注文字" />}
        <button type="button" onClick={() => { setBoxes([]); setNotes([]); }}>清除标注</button>
      </div>
      <p>{tool === "box" ? "在图片上拖拽即可画框。" : "输入文字后，点击图片添加注释。"}</p>
      <div className="ai-task-editor__canvas" style={{ position: "relative", display: "inline-block", minHeight: 0, background: "#fff" }} onMouseDown={pointerDown} onMouseMove={pointerMove} onMouseUp={pointerUp} onMouseLeave={pointerUp}>
        {!ready && <span>正在载入截图…</span>}
        <img ref={image} style={{ display: "block", maxWidth: "100%", maxHeight: "58vh" }} src={source} alt="待标注截图" onLoad={() => setReady(true)} />
        {ready && [...boxes, ...(draft ? [draft] : [])].map((box, index) => <i key={`box-${index}`} className="ai-task-editor__box" style={{ position: "absolute", boxSizing: "border-box", border: "3px solid #ef5350", pointerEvents: "none", left: percent(box.x, image.current!.naturalWidth), top: percent(box.y, image.current!.naturalHeight), width: percent(box.width, image.current!.naturalWidth), height: percent(box.height, image.current!.naturalHeight) }} />)}
        {ready && notes.map((note, index) => <b key={`note-${index}`} className="ai-task-editor__note" style={{ position: "absolute", padding: "5px 8px", background: "#ef5350", color: "#fff", font: "14px/1.2 sans-serif", pointerEvents: "none", whiteSpace: "nowrap", left: percent(note.x, image.current!.naturalWidth), top: percent(note.y, image.current!.naturalHeight) }}>{note.text}</b>)}
      </div>
      <footer><button type="button" onClick={onClose}>取消</button><button type="button" className="primary" disabled={!ready} onClick={save}>保存标注</button></footer>
    </section>
  </div>;
}

export function AiTaskCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<AiManagedTask["sceneId"]>("bug_fix");
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [editing, setEditing] = useState<{ clientId: string; source: string }>();
  const [frame, setFrame] = useState<CaptureFrame>(readFrame);
  const picker = useRef<HTMLInputElement>(null);
  const autoAttachedBug = useRef(false);
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
    setText(value => value.startsWith(item.token) ? value : `${item.token} ${value}`.trimEnd());
    setSuggestionsOpen(false);
    if (item.id === "bug_fix" && !autoAttachedBug.current) {
      autoAttachedBug.current = true;
      void attachScreenshot();
    }
  };
  const update = (value: string) => {
    setText(value);
    const show = /^\s*\/\w*$/.test(value);
    setSuggestionsOpen(show);
    const hit = modes.find(item => value.trimStart().startsWith(item.token));
    if (hit) setMode(hit.id);
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
    const content = text.replace(/^\/(bug|requirement|task|improve)\s*/i, "").trim();
    if (!content || composer.isUploading) return;
    setSaving(true);
    try {
      await api.createAiManagedTask({ sceneId: mode, title: content.slice(0, 80), input: { text: `页面定位：${location}\n\n${content}`, images: composer.getAttachmentRefs().map(item => ({ id: item.id, label: "任务截图", mime: item.mime })), materials: [] }, payload: { page: [location] }, contextSummary: content.slice(0, 2000) });
      composer.clear(); setText(""); setOpen(false); setAppView("aiTaskManagement");
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return <div className={`ai-task-capture${capturing ? " is-capturing" : ""}`} role="dialog" aria-modal="true" aria-label="登记 AI 任务">
    <section className="ai-task-capture__window" style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}>
      <header className="ai-task-capture__titlebar" onPointerDown={beginMove}><span>AI 任务登记</span></header>
      <div className="ai-task-capture__input-wrap">
        <textarea autoFocus value={text} onChange={event => update(event.target.value)} onFocus={() => setSuggestionsOpen(/^\s*\/\w*$/.test(text))} placeholder="描述你要登记的任务…" />
        {suggestionsOpen && <div className="ai-task-capture__suggestions">{modes.filter(item => item.token.startsWith(text.trimStart().toLowerCase()) || text.trim() === "/").map(item => <button key={item.id} type="button" onMouseDown={event => { event.preventDefault(); selectMode(item); }}><b>{item.label}</b><span>{item.description}</span><kbd>{item.token}</kbd></button>)}</div>}
      </div>
      <div className="ai-task-capture__context"><span>定位 · {location}</span><span>{composer.attachments.length ? `${composer.attachments.length} 张截图` : "输入 /bug 自动截图"}</span></div>
      {composer.attachments.length > 0 && <div className="ai-task-capture__images">{composer.attachments.map(item => <figure key={item.clientId}><button type="button" className="ai-task-capture__preview" onClick={() => setEditing({ clientId: item.clientId, source: item.previewUrl })}><img src={item.previewUrl} alt="任务截图，点击编辑" /></button><button type="button" className="ai-task-capture__remove" aria-label="删除截图" onClick={() => composer.detach(item.clientId)}>×</button><figcaption>点击截图标注</figcaption></figure>)}</div>}
      <footer><input ref={picker} type="file" accept="image/*" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void composer.attach(file); event.currentTarget.value = ""; }} /><button type="button" onClick={() => picker.current?.click()}>添加图片</button><button type="button" onClick={() => void attachScreenshot()}>截取当前界面</button><button type="button" className="primary" disabled={!text.replace(/^\/\w+\s*/, "").trim() || saving || composer.isUploading} onClick={() => void submit()}>{saving ? "登记中…" : "登记任务"}</button></footer>
      <span className="ai-task-capture__resize" aria-label="调整窗口大小" onPointerDown={event => beginMove(event, true)} />
    </section>
    {editing && <ScreenshotEditor source={editing.source} onSave={file => void replaceAttachment(file)} onClose={() => setEditing(undefined)} />}
  </div>;
}
