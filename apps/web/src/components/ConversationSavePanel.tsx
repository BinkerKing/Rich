import { useMemo, useState } from "react";
import { api, type ConversationSaveInput, type ProjectManagementModuleKey } from "../api/client.js";
import type { ConversationTaskEvidence } from "./ConversationTaskPanel.js";
import "./ConversationTaskPanel.css";

const MODULES: Array<{ key: ProjectManagementModuleKey; label: string }> = [
  { key: "requirements", label: "需求" }, { key: "deliverables", label: "交付物" },
  { key: "reports", label: "报告" }, { key: "todos", label: "待办" },
];

export function ConversationSavePanel({ conversationId, projects, messages, onClose }: {
  conversationId: string;
  projects: Array<{ id: string; title: string }>;
  messages: ConversationTaskEvidence[];
  onClose(): void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [moduleKey, setModuleKey] = useState<ProjectManagementModuleKey>("reports");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState(() => messages.slice(-6).map(message => `${message.role === "user" ? "用户" : "Rich"}：${message.content}`).join("\n\n"));
  const [preview, setPreview] = useState<{ confirmationToken: string; action: ConversationSaveInput } | null>(null);
  const [result, setResult] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedProject = useMemo(() => projects.find(project => project.id === projectId), [projectId, projects]);
  const canPreview = Boolean(projectId && title.trim() && content.trim() && !busy);

  async function createPreview() {
    if (!canPreview) return;
    setBusy(true); setError("");
    try {
      setPreview(await api.previewConversationSave(conversationId, {
        destination: { projectId, moduleKey, title: title.trim() },
        content: { text: content.trim(), source: "conversation", conversationId },
      }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!preview || busy) return;
    setBusy(true); setError("");
    try {
      const item = await api.publishConversationSave(conversationId, preview.confirmationToken);
      setResult({ id: item.id, title: item.title });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  return <div className="conversation-task-shade" role="dialog" aria-modal="true" aria-label="保存到 Rich">
    <section className="conversation-task-panel">
      <header><div><small>SAVE TO RICH</small><h2>保存到 Rich</h2><p>明确选择目标，先预览，再确认写入；不会自动回写对话。</p></div><button type="button" onClick={onClose} aria-label="关闭">×</button></header>
      {result ? <div className="conversation-task-result"><strong>已保存到 Rich</strong><span>{result.title}</span><code>{result.id}</code><button type="button" onClick={onClose}>完成</button></div> : <>
        <div className="conversation-task-grid">
          <label>项目<select value={projectId} onChange={event => { setProjectId(event.target.value); setPreview(null); }}><option value="">请选择项目</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
          <label>业务模块<select value={moduleKey} onChange={event => { setModuleKey(event.target.value as ProjectManagementModuleKey); setPreview(null); }}>{MODULES.map(module => <option key={module.key} value={module.key}>{module.label}</option>)}</select></label>
        </div>
        <label className="conversation-task-wide">标题<input value={title} onChange={event => { setTitle(event.target.value); setPreview(null); }} placeholder="为这条内容命名" /></label>
        <label className="conversation-task-wide">保存内容<textarea value={content} onChange={event => { setContent(event.target.value); setPreview(null); }} placeholder="确认要保存的内容" /></label>
        {preview && <div className="conversation-task-preview"><strong>写入预览已生成</strong><span>将保存到「{selectedProject?.title} / {MODULES.find(module => module.key === moduleKey)?.label}」。</span></div>}
        {error && <p className="conversation-task-error">{error}</p>}
        <footer><button type="button" className="secondary" onClick={onClose}>取消</button>{preview ? <button type="button" disabled={busy} onClick={() => void publish()}>确认保存</button> : <button type="button" disabled={!canPreview} onClick={() => void createPreview()}>生成写入预览</button>}</footer>
      </>}
    </section>
  </div>;
}
