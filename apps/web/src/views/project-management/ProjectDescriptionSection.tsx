import { useEffect, useState } from "react";
import { api, type ProjectDescription } from "../../api/client.js";
import { ProjectRichTextEditor } from "./ProjectManagementModules.js";

export function ProjectDescriptionSection({ projectId }: { projectId: string }) {
  const [description, setDescription] = useState<ProjectDescription | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDescription(null);
    setEditing(false);
    setError(null);
    void api.getProjectDescription(projectId)
      .then(next => {
        if (cancelled) return;
        setDescription(next);
        setDraft(next.html);
      })
      .catch(errorValue => {
        if (!cancelled) setError(errorValue instanceof Error ? errorValue.message : String(errorValue));
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const beginEdit = () => {
    setDraft(description?.html ?? "");
    setEditing(true);
    setError(null);
  };
  const cancelEdit = () => {
    setDraft(description?.html ?? "");
    setEditing(false);
    setError(null);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.saveProjectDescription(projectId, draft);
      setDescription(saved);
      setDraft(saved.html);
      setEditing(false);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : String(errorValue));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`prj-pm-description${editing ? " is-editing" : ""}`}>
      <header className="prj-pm-description__head">
        <div>
          <h2>项目说明</h2>
          <p>记录项目背景、架构、运行方式和重要约束，供项目成员与 AI 快速了解上下文。</p>
        </div>
        <div className="prj-pm-description__actions">
          {description?.updatedAt && <small>最后保存：{formatProjectDescriptionTime(description.updatedAt)}</small>}
          {editing ? <>
            <button type="button" className="prj-btn-link" onClick={cancelEdit} disabled={busy}>取消</button>
            <button type="button" className="prj-btn-primary" onClick={() => void save()} disabled={busy}>{busy ? "保存中…" : "保存"}</button>
          </> : (
            <button type="button" className="prj-btn-primary" onClick={beginEdit}>{description?.text ? "编辑" : "开始填写"}</button>
          )}
        </div>
      </header>

      {error && <div className="prj-pm-error">{error}</div>}
      <section className="prj-pm-description__body">
        {description === null && !error ? <div className="prj-pm-empty">正在读取项目说明…</div> : editing ? (
          <ProjectRichTextEditor projectId={`${projectId}-description`} value={draft} onChange={setDraft} />
        ) : description?.text ? (
          <article className="prj-pm-description__document workflow-rich-content" dangerouslySetInnerHTML={{ __html: description.html }} />
        ) : (
          <div className="prj-pm-description__empty">
            <strong>还没有项目说明</strong>
            <p>可以自由记录项目背景、业务目标、技术架构、数据库、启动方式、当前进度及注意事项。</p>
            <button type="button" className="prj-btn-primary" onClick={beginEdit}>填写项目说明</button>
          </div>
        )}
      </section>
    </div>
  );
}

function formatProjectDescriptionTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}
