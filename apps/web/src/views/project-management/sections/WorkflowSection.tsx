import { useEffect, useState } from "react";
import type { Element } from "@ke/domain";
import { GitBranch, Plus } from "lucide-react";
import { api, type ProjectManagementSummary, type ProjectModuleItem } from "../../../api/client.js";
import { Button } from "../../../ui/index.js";
import {
  WorkflowModal,
  arrayRecords,
  recordValue,
  stringList,
  textValue,
  type WorkflowModalType,
} from "../ProjectManagementModules.js";

export function WorkflowSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [items, setItems] = useState<ProjectModuleItem[]>([]);
  const [modal, setModal] = useState<{ item: ProjectModuleItem; type: WorkflowModalType } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void api.listProjectManagementModuleItems(project.id, "workflow")
      .then(next => {
        if (cancelled) return;
        setItems(next);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [project.id]);

  const beginEdit = (item: ProjectModuleItem) => {
    const original = recordValue(item.content.original);
    setDraft({ ...original, title: textValue(original, "title") || item.title });
    setModal({ item, type: "overview" });
    setEditing(true);
  };
  const save = async () => {
    if (!modal) return;
    const selectedOriginal = recordValue(modal.item.content.original);
    const title = textValue(draft, "title") || modal.item.title;
    setBusy(true);
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, modal.item.id, {
        title,
        subtitle: textValue(draft, "lane") || modal.item.subtitle,
        content: { ...modal.item.content, original: { ...selectedOriginal, ...draft, title } },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "workflow");
      setItems(next);
      setEditing(false);
      setModal(current => {
        if (!current) return null;
        const updated = next.find(item => item.id === current.item.id);
        return updated ? { ...current, item: updated } : null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const createWorkflow = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProjectManagementModuleItem(project.id, "workflow", {
        title: "新流程节点",
        subtitle: "未分组",
        sortOrder: items.length,
        content: {
          sourceKey: "operationFlow",
          original: {
            id: `workflow-${Date.now()}`,
            title: "新流程节点",
            lane: "未分组",
            time: "",
            summary: "",
            summaryHtml: "",
            tasks: [],
            checks: [],
            warnings: [],
            scenarioIds: [],
            serverNamesByEnv: {},
          },
        },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "workflow");
      setItems(next);
      setModal({ item: created, type: "overview" });
      setDraft(recordValue(created.content.original));
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded && !error) return null;
  if (!error && items.length === 0) return <p className="prj-pm-unconfigured">暂未配置。</p>;

  return (
    <div className="workflow">
      <header className="workflow__head">
        <div className="workflow__title">
          <GitBranch aria-hidden="true" />
          <div>
            <h2>作业流程</h2>
          <p>围绕数据准备、加工处理、检查预警、部署和上线运维维护项目的完整作业链路。</p>
          </div>
        </div>
        <div className="workflow__actions">
          <Button variant="secondary" className="workflow__create" onClick={() => void createWorkflow()} disabled={busy}>
            <Plus aria-hidden="true" size={16} />
            {busy ? "处理中..." : "新增流程"}
          </Button>
        </div>
      </header>

      {error && <div className="prj-pm-error">{error}</div>}

      <div className={`workflow-content${items.length === 0 ? " is-empty" : ""}`}>
        {items.length === 0 ? <div className="workflow-empty">还没有作业流程数据。</div> : (
          <div className="workflow-rail">
          {items.map((item, index) => {
            const original = recordValue(item.content.original);
            const tasks = arrayRecords(original.tasks);
            const serverCount = Object.values(recordValue(original.serverNamesByEnv)).reduce<number>((sum, value) => sum + stringList(value).length, 0);
            const scenarioCount = stringList(original.scenarioIds).length;
            const notesCount = stringList(original.checks).length + stringList(original.warnings).length;
            const summaryHtml = textValue(original, "summaryHtml");
            const summaryText = textValue(original, "summary");
            return (
              <article className="workflow-step" key={item.id}>
                <button type="button" className="workflow-order" aria-label={`流程 ${index + 1}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <i>↕</i>
                </button>
                <div className="workflow-step-main">
                  <div className="workflow-step-meta">
                    <span>{textValue(original, "lane") || item.subtitle || "未分组"}</span>
                    {textValue(original, "time") && <time>{textValue(original, "time")}</time>}
                  </div>
                  <button type="button" className="workflow-title" onClick={() => setModal({ item, type: "overview" })}>
                    {textValue(original, "title") || item.title}
                  </button>
                  {summaryHtml ? (
                    <div className="workflow-summary workflow-rich-content" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
                  ) : (
                    <p className="workflow-summary">{summaryText}</p>
                  )}
                </div>
                <div className="workflow-actions">
                  <button type="button" onClick={() => setModal({ item, type: "servers" })}><span>涉及服务器</span><strong>{serverCount}</strong></button>
                  <button type="button" onClick={() => setModal({ item, type: "tasks" })}><span>定时与任务</span><strong>{tasks.length}</strong></button>
                  <button type="button" onClick={() => setModal({ item, type: "scenarios" })}><span>操作场景</span><strong>{scenarioCount}</strong></button>
                  <button type="button" onClick={() => setModal({ item, type: "notes" })}><span>注意事项</span><strong>{notesCount}</strong></button>
                </div>
              </article>
            );
          })}
          </div>
        )}
      </div>

      {modal?.item && (
        <WorkflowModal
          projectId={project.id}
          modal={modal}
          editing={editing}
          draft={draft}
          busy={busy}
          onEdit={() => beginEdit(modal.item)}
          onDraftChange={setDraft}
          onSave={() => void save()}
          onClose={() => {
            setModal(null);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}
