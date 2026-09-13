import { useEffect, useRef, useState } from "react";
import { api, type AiManagedTask } from "../api/client.js";
import { useChatComposer } from "../lib/useChatComposer.js";
import { useStore } from "../state/store.js";
import "./AiTaskCapture.css";

const modes: Array<{ id: AiManagedTask["sceneId"]; token: string; label: string }> = [
  { id: "bug_fix", token: "/bug", label: "Bug 修复" },
  { id: "requirement_analysis", token: "/requirement", label: "需求分析" },
  { id: "deliverable_task", token: "/task", label: "交付任务" },
  { id: "system_improvement", token: "/improve", label: "系统改造" },
];

const viewLabels: Record<string, string> = {
  aiTaskManagement: "AI 任务管理",
  projects: "项目管理",
  deliverables: "交付物",
  taskWorkbench: "任务工作台",
};

export function AiTaskCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<AiManagedTask["sceneId"]>("bug_fix");
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const composer = useChatComposer({ maxAttachments: 4 });
  const appView = useStore(s => s.appView);
  const setAppView = useStore(s => s.setAppView);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("rich:open-ai-task-capture", show);
    return () => window.removeEventListener("rich:open-ai-task-capture", show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const update = (value: string) => {
    setText(value);
    const hit = modes.find(item => value.trimStart().startsWith(item.token));
    if (hit) setMode(hit.id);
  };

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
    }
  };

  const submit = async () => {
    const content = text.replace(/^\/(bug|requirement|task|improve)\s*/i, "").trim();
    if (!content || composer.isUploading) return;
    setSaving(true);
    try {
      await api.createAiManagedTask({
        sceneId: mode,
        title: content.slice(0, 80),
        input: {
          text: `页面定位：${viewLabels[appView] ?? appView}\n\n${content}`,
          images: composer.getAttachmentRefs().map(item => ({ id: item.id, label: "任务截图", mime: item.mime })),
          materials: [],
        },
        payload: { page: [viewLabels[appView] ?? appView] },
        contextSummary: content.slice(0, 2000),
      });
      composer.clear();
      setText("");
      setOpen(false);
      setAppView("aiTaskManagement");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className={`ai-task-capture${capturing ? " is-capturing" : ""}`} role="dialog" aria-modal="true" aria-label="登记 AI 任务" onClick={() => setOpen(false)}>
      <section onClick={event => event.stopPropagation()}>
        <header>
          <div><small>AI TASKS · QUICK CAPTURE</small><h2>登记 AI 任务</h2></div>
          <button type="button" aria-label="关闭" onClick={() => setOpen(false)}>×</button>
        </header>
        <div className="ai-task-capture__modes">
          {modes.map(item => <button key={item.id} type="button" className={mode === item.id ? "is-active" : ""} onClick={() => setMode(item.id)}>{item.token} {item.label}</button>)}
        </div>
        <textarea autoFocus value={text} onChange={event => update(event.target.value)} placeholder="输入任务描述；/bug 可切换 Bug 模式" />
        <p>页面定位：{viewLabels[appView] ?? appView}</p>
        {composer.attachments.length > 0 && <div className="ai-task-capture__images">
          {composer.attachments.map(item => <figure key={item.clientId}><img src={item.previewUrl} alt="任务截图" /><button type="button" onClick={() => composer.detach(item.clientId)}>×</button></figure>)}
        </div>}
        <footer>
          <input ref={picker} type="file" accept="image/*" onChange={event => {
            const file = event.currentTarget.files?.[0];
            if (file) void composer.attach(file);
            event.currentTarget.value = "";
          }} />
          <button type="button" onClick={() => picker.current?.click()}>添加图片</button>
          <button type="button" onClick={() => void attachScreenshot()}>截取当前界面</button>
          <button type="button" className="primary" disabled={!text.trim() || saving || composer.isUploading} onClick={() => void submit()}>{saving ? "登记中…" : "登记任务"}</button>
        </footer>
      </section>
    </div>
  );
}
