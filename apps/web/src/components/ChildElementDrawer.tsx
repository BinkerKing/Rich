import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "../state/store.js";
import { api } from "../api/client.js";
import "./ChildElementDrawer.css";

interface Props {
  elementId: string;
  onClose: () => void;
}

/**
 * 侧滑 drawer 编辑子元（concept / case / product-design / step）。
 * 复用 PATCH /api/elements/:id 接口，支持改 title / subtitle / status / content。
 * 删除走 DELETE /api/elements/:id（级联）。
 */
export function ChildElementDrawer({ elementId, onClose }: Props): ReactNode {
  const elements = useStore(s => s.elements);
  const hydrate = useStore(s => s.hydrate);
  const el = elements.get(elementId);

  const [title, setTitle] = useState(el?.title ?? "");
  const [subtitle, setSubtitle] = useState(el?.subtitle ?? "");
  const [contentText, setContentText] = useState(
    typeof el?.content === "string"
      ? el.content
      : JSON.stringify(el?.content ?? {}, null, 2),
  );
  const [status, setStatus] = useState<"todo" | "doing" | "done">(el?.status ?? "todo");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(el?.title ?? "");
    setSubtitle(el?.subtitle ?? "");
    setContentText(
      typeof el?.content === "string"
        ? el.content
        : JSON.stringify(el?.content ?? {}, null, 2),
    );
    setStatus(el?.status ?? "todo");
  }, [el?.id]);

  if (!el) return null;

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      // 尝试 parse content 为 JSON；失败则保持字符串
      let parsedContent: unknown;
      try { parsedContent = JSON.parse(contentText); }
      catch { parsedContent = contentText; }
      await api.patchElement(el.id, {
        title: title.trim() || el.title,
        subtitle: subtitle,
        content: parsedContent,
        ...(el.type === "step" ? { status } : {}),
      });
      await hydrate();
      onClose();
    } catch (e) {
      alert(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!confirm(`确认删除「${el.title}」？此操作不可撤销。`)) return;
    try {
      await api.deleteElement(el.id);
      await hydrate();
      onClose();
    } catch (e) {
      alert(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="ced-back" onClick={onClose}>
      <div className="ced-panel" onClick={e => e.stopPropagation()}>
        <div className="ced-head">
          <div>
            <div className="ced-type">{el.type}</div>
            <input className="ced-title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <button className="ced-close" onClick={onClose}>×</button>
        </div>

        <label className="ced-label">副标题</label>
        <input className="ced-input" value={subtitle}
          onChange={e => setSubtitle(e.target.value)} />

        {el.type === "step" && (
          <>
            <label className="ced-label">状态</label>
            <div className="ced-status">
              {(["todo", "doing", "done"] as const).map(s => (
                <button key={s}
                  className={`ced-chip ${status === s ? "is-active" : ""}`}
                  onClick={() => setStatus(s)}>{s}</button>
              ))}
            </div>
          </>
        )}

        <label className="ced-label">内容（JSON 或纯文本）</label>
        <textarea className="ced-content" rows={14} value={contentText}
          onChange={e => setContentText(e.target.value)} />

        <div className="ced-foot">
          <button className="ced-btn ced-btn--danger" onClick={() => void remove()}>删除</button>
          <div style={{ flex: 1 }} />
          <button className="ced-btn" onClick={onClose}>取消</button>
          <button className="ced-btn is-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
