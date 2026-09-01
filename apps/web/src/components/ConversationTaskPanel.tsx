import { useEffect, useMemo, useState } from "react";
import { api, type ProjectModuleItem } from "../api/client.js";
import "./ConversationTaskPanel.css";

export interface ConversationTaskEvidence { id: string; role: "user" | "assistant"; content: string }

export function ConversationTaskPanel({ conversationId, projects, messages, onClose }: {
  conversationId: string;
  projects: Array<{ id: string; title: string }>;
  messages: ConversationTaskEvidence[];
  onClose(): void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [deliverables, setDeliverables] = useState<ProjectModuleItem[]>([]);
  const [deliverableId, setDeliverableId] = useState("");
  const [executor, setExecutor] = useState<"hermes" | "multica">("hermes");
  const [instructions, setInstructions] = useState("");
  const [criteria, setCriteria] = useState("");
  const [selected, setSelected] = useState(() => new Set(messages.slice(-4).map(message => message.id)));
  const [preview, setPreview] = useState<{ confirmationToken: string; request: Record<string, unknown> } | null>(null);
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) { setDeliverables([]); setDeliverableId(""); return; }
    let cancelled = false;
    void api.listProjectManagementModuleItems(projectId, "deliverables", undefined, true)
      .then(items => { if (!cancelled) { setDeliverables(items); setDeliverableId(items[0]?.id ?? ""); } })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { cancelled = true; };
  }, [projectId]);

  const selectedIds = useMemo(() => messages.filter(message => selected.has(message.id)).map(message => message.id), [messages, selected]);
  const canPreview = Boolean(projectId && deliverableId && instructions.trim() && selectedIds.length > 0 && !busy);

  async function createPreview() {
    if (!canPreview) return;
    setBusy(true); setError("");
    try {
      setPreview(await api.previewConversationTask(conversationId, {
        scenario: "deliverable_analysis", target: { projectId, deliverableId }, executor, profile: "analysis",
        instructions: instructions.trim(), selectedMessageIds: selectedIds,
        acceptanceCriteria: criteria.split("\n").map(item => item.trim()).filter(Boolean),
      }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!preview || busy) return;
    setBusy(true); setError("");
    try { setResult(await api.publishConversationTask(conversationId, preview.confirmationToken)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  return <div className="conversation-task-shade" role="dialog" aria-modal="true" aria-label="转为结构化任务">
    <section className="conversation-task-panel">
      <header><div><small>STRUCTURED HANDOFF</small><h2>转为正式任务</h2><p>只冻结你勾选的对话证据，确认后进入 Rich 任务生命周期。</p></div><button type="button" onClick={onClose} aria-label="关闭">×</button></header>
      {result ? <div className="conversation-task-result"><strong>任务已创建</strong><code>{result.id}</code><span>{result.status}</span><button type="button" onClick={onClose}>完成</button></div> : <>
        <div className="conversation-task-grid">
          <label>项目<select value={projectId} onChange={event => { setProjectId(event.target.value); setPreview(null); }}><option value="">请选择项目</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
          <label>交付物<select value={deliverableId} onChange={event => { setDeliverableId(event.target.value); setPreview(null); }}><option value="">请选择交付物</option>{deliverables.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label>执行者<select value={executor} onChange={event => { setExecutor(event.target.value as "hermes" | "multica"); setPreview(null); }}><option value="hermes">Hermes</option><option value="multica">Multica</option></select></label>
        </div>
        <label className="conversation-task-wide">任务要求<textarea value={instructions} onChange={event => { setInstructions(event.target.value); setPreview(null); }} placeholder="说明要分析什么、形成什么产物" /></label>
        <label className="conversation-task-wide">验收标准<textarea value={criteria} onChange={event => { setCriteria(event.target.value); setPreview(null); }} placeholder="每行一条，可选" /></label>
        <fieldset><legend>对话证据 <span>{selectedIds.length} 条</span></legend><div className="conversation-task-evidence">{messages.slice(-12).map(message => <label key={message.id}><input type="checkbox" checked={selected.has(message.id)} onChange={() => { setSelected(current => { const next = new Set(current); next.has(message.id) ? next.delete(message.id) : next.add(message.id); return next; }); setPreview(null); }} /><span><small>{message.role === "user" ? "你" : "Rich"}</small>{message.content.slice(0, 180)}</span></label>)}</div></fieldset>
        {preview && <div className="conversation-task-preview"><strong>冻结预览已生成</strong><span>项目、交付物要求、材料目录与 {selectedIds.length} 条对话证据将在创建时固定。</span></div>}
        {error && <p className="conversation-task-error">{error}</p>}
        <footer><button type="button" className="secondary" onClick={onClose}>取消</button>{preview ? <button type="button" disabled={busy} onClick={() => void publish()}>确认发布</button> : <button type="button" disabled={!canPreview} onClick={() => void createPreview()}>生成冻结预览</button>}</footer>
      </>}
    </section>
  </div>;
}
