import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import type { Element } from "@ke/domain";
import { api, type ProjectManagementSummary, type ProjectModuleItem } from "../../../api/client.js";
import { MonitoringCard, ProjectRichTextEditor, arrayRecords, recordValue, textValue } from "../ProjectManagementModules.js";

type DictionaryTreeDragEvent = { dataTransfer: DataTransfer; preventDefault: () => void };

export function MonitoringSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [sections, setSections] = useState<ProjectModuleItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftItems, setDraftItems] = useState<Array<{ name: string; detail: string; check: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = () => api.listProjectManagementModuleItems(project.id, "monitoring").then(next => {
    setSections(next);
    setSelectedId(current => current || next[0]?.id || "");
  });

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void reload()
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [project.id]);

  const selected = sections.find(section => section.id === selectedId) ?? sections[0];
  const selectedOriginal = recordValue(selected?.content.original);
  const items = arrayRecords(selectedOriginal.items);
  const itemCount = sections.reduce((sum, section) => sum + arrayRecords(recordValue(section.content.original).items).length, 0);
  const count = summary?.modules.find(module => module.key === "monitoring")?.count ?? sections.length;
  const beginEdit = (section: ProjectModuleItem) => {
    const original = recordValue(section.content.original);
    setSelectedId(section.id);
    setDraftTitle(section.title);
    setDraftItems(arrayRecords(original.items).map(item => ({
      name: textValue(item, "name"),
      detail: textValue(item, "detail"),
      check: textValue(item, "check"),
    })));
    setEditing(true);
  };
  const saveMonitoring = async () => {
    if (!selected) return;
    const title = draftTitle.trim() || "未命名分组";
    setBusy(true);
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, selected.id, {
        title,
        content: {
          ...selected.content,
          original: {
            ...selectedOriginal,
            title,
            items: draftItems.filter(item => item.name.trim() || item.detail.trim() || item.check.trim()),
          },
        },
      });
      await reload();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const createSection = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProjectManagementModuleItem(project.id, "monitoring", {
        title: "新监控分组",
        sortOrder: sections.length,
        content: { original: { id: `monitor-${Date.now()}`, title: "新监控分组", items: [] } },
      });
      await reload();
      setSelectedId(created.id);
      beginEdit(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const deleteSection = async () => {
    if (!selected || !window.confirm(`删除监控分组「${selected.title}」？`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteProjectManagementModuleItem(project.id, selected.id);
      await reload();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded && !error) return null;
  if (!error && sections.length === 0) return <p className="prj-pm-unconfigured">暂未配置。</p>;

  return (
    <div className="prj-pm-monitor">
      <section className="prj-pm-monitor__head">
        <div className="prj-pm-workspace-head__identity">
          <Activity aria-hidden="true" />
          <div><h3>监控预警</h3><p>把任务状态、异常预警、资源风险、启停检查沉淀成可追踪的运行保障清单。</p></div>
        </div>
        <div className="prj-pm-monitor__stats">
          <span><b>{count}</b>分组</span>
          <span><b>{itemCount}</b>事项</span>
        </div>
      </section>

      {error && <div className="prj-pm-error">{error}</div>}

      <div className="prj-pm-monitor__actions">
        <button type="button" className="prj-btn-primary" onClick={() => void createSection()} disabled={busy}>新增分组</button>
        {selected && !editing && <button type="button" className="prj-btn-link" onClick={() => beginEdit(selected)}>编辑当前分组</button>}
        {selected && editing && <button type="button" className="prj-btn-link prj-btn-danger" onClick={() => void deleteSection()} disabled={busy}>删除当前分组</button>}
      </div>

      <div className="prj-pm-monitor__layout">
        <aside className="prj-pm-panel prj-pm-monitor__menu">
          {sections.map(section => {
            const original = recordValue(section.content.original);
            const sectionItems = arrayRecords(original.items);
            return (
              <button
                key={section.id}
                type="button"
                className={selected?.id === section.id ? "is-active" : ""}
                onClick={() => setSelectedId(section.id)}>
                <strong>{section.title}</strong>
                <span>{sectionItems.length} 个事项</span>
              </button>
            );
          })}
        </aside>

        <section className="prj-pm-panel prj-pm-monitor__detail">
          {selected && editing ? (
            <MonitoringEditor
              title={draftTitle}
              items={draftItems}
              busy={busy}
              onTitleChange={setDraftTitle}
              onItemsChange={setDraftItems}
              onSave={() => void saveMonitoring()}
              onCancel={() => setEditing(false)}
            />
          ) : selected ? (
            <article>
              <header>
                <div>
                  <p>运行保障</p>
                  <h3>{selected.title}</h3>
                </div>
                <div className="prj-pm-inline-actions">
                  <span>{items.length} 项</span>
                  <button type="button" className="prj-btn-link" onClick={() => beginEdit(selected)}>编辑</button>
                </div>
              </header>

              {items.length === 0 ? <div className="prj-pm-empty">当前分组还没有监控项。</div> : (
                <div className="prj-pm-monitor__grid">
                  {items.map((item, index) => <MonitoringCard key={`${textValue(item, "name")}-${index}`} item={item} index={index} />)}
                </div>
              )}
            </article>
          ) : <div className="prj-pm-empty">还没有监控预警数据。</div>}
        </section>
      </div>
    </div>
  );
}
function MonitoringEditor({
  title,
  items,
  busy,
  onTitleChange,
  onItemsChange,
  onSave,
  onCancel,
}: {
  title: string;
  items: Array<{ name: string; detail: string; check: string }>;
  busy: boolean;
  onTitleChange: (value: string) => void;
  onItemsChange: (items: Array<{ name: string; detail: string; check: string }>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const updateItem = (index: number, patch: Partial<{ name: string; detail: string; check: string }>) => {
    onItemsChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  };
  return (
    <div className="prj-pm-monitor__editor">
      <header>
        <h3>编辑监控分组</h3>
        <div>
          <button type="button" className="prj-btn-link" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className="prj-btn-primary" onClick={onSave} disabled={busy}>保存</button>
        </div>
      </header>
      <label>
        <span>分组名称</span>
        <input value={title} onChange={event => onTitleChange(event.target.value)} />
      </label>
      <div className="prj-pm-monitor__editor-list">
        {items.map((item, index) => (
          <section key={index}>
            <div className="prj-pm-monitor__editor-item-head">
              <strong>事项 {index + 1}</strong>
              <button type="button" className="prj-btn-link prj-btn-danger" onClick={() => onItemsChange(items.filter((_, i) => i !== index))}>删除</button>
            </div>
            <label>
              <span>名称</span>
              <input value={item.name} onChange={event => updateItem(index, { name: event.target.value })} />
            </label>
            <label>
              <span>关注内容</span>
              <ProjectRichTextEditor value={item.detail} projectId={`monitor-detail-${index}`} onChange={detail => updateItem(index, { detail })} />
            </label>
            <label>
              <span>检查方式</span>
              <ProjectRichTextEditor value={item.check} projectId={`monitor-check-${index}`} onChange={check => updateItem(index, { check })} />
            </label>
          </section>
        ))}
      </div>
      <button
        type="button"
        className="prj-btn-link"
        onClick={() => onItemsChange([...items, { name: "新监控项", detail: "", check: "" }])}>
        新增监控项
      </button>
    </div>
  );
}
