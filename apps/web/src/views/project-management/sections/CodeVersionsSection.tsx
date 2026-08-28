import { useEffect, useState } from "react";
import type { Element } from "@ke/domain";
import { api, type ProjectManagementSummary, type ProjectModuleItem } from "../../../api/client.js";
import { CodeVersionCard, CodeVersionsEditor, arrayRecords, recordValue, textValue } from "../ProjectManagementModules.js";

export function CodeVersionsSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [apps, setApps] = useState<ProjectModuleItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void api.listProjectManagementModuleItems(project.id, "codeVersions")
      .then(next => {
        if (cancelled) return;
        setApps(next);
        setSelectedId(current => current || next[0]?.id || "");
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [project.id]);

  const selected = apps.find(app => app.id === selectedId) ?? apps[0];
  const original = recordValue(selected?.content.original);
  const versions = arrayRecords(original.versions);
  const versionCount = apps.reduce((sum, app) => sum + arrayRecords(recordValue(app.content.original).versions).length, 0);
  const count = summary?.modules.find(module => module.key === "codeVersions")?.count ?? apps.length;
  const beginEdit = () => {
    if (!selected) return;
    setDraft({ ...original, title: selected.title });
    setEditing(true);
  };
  const save = async () => {
    if (!selected) return;
    const title = textValue(draft, "name") || textValue(draft, "title") || selected.title;
    setBusy(true);
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, selected.id, {
        title,
        content: { ...selected.content, original: { ...original, ...draft, name: title } },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "codeVersions");
      setApps(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded && !error) return null;
  if (!error && apps.length === 0) return <p className="prj-pm-unconfigured">暂未配置。</p>;

  return (
    <div className="prj-pm-code">
      <section className="prj-pm-code__head">
        <div>
          <p className="prj-pm-eyebrow">Application Versions</p>
          <h3>代码版本</h3>
          <p>按应用记录版本号、发布时间、上线时间、升级路线和升级内容，后续可继续扩展版本审批与上线关联。</p>
        </div>
        <div className="prj-pm-code__stats">
          <span><b>{count}</b>应用</span>
          <span><b>{versionCount}</b>版本</span>
        </div>
      </section>

      {error && <div className="prj-pm-error">{error}</div>}

      <div className="prj-pm-code__layout">
        <aside className="prj-pm-panel prj-pm-code__apps">
          {apps.map(app => {
            const appOriginal = recordValue(app.content.original);
            const appVersions = arrayRecords(appOriginal.versions);
            return (
              <button
                key={app.id}
                type="button"
                className={selected?.id === app.id ? "is-active" : ""}
                onClick={() => setSelectedId(app.id)}>
                <strong>{app.title}</strong>
                {textValue(appOriginal, "description") && <p>{textValue(appOriginal, "description")}</p>}
                <span>{appVersions.length} 个版本</span>
              </button>
            );
          })}
        </aside>

        <section className="prj-pm-panel prj-pm-code__detail">
          {selected ? editing ? (
            <CodeVersionsEditor
              projectId={project.id}
              draft={draft}
              busy={busy}
              onChange={setDraft}
              onSave={() => void save()}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <article>
              <header>
                <div>
                  <p>应用版本历史</p>
                  <h3>{selected.title}</h3>
                </div>
                <div className="prj-pm-inline-actions">
                  <span>{versions.length} 个版本</span>
                  <button type="button" className="prj-btn-link" onClick={beginEdit}>编辑</button>
                </div>
              </header>
              {textValue(original, "description") && (
                <section className="prj-pm-code__app-desc">
                  <strong>应用组件</strong>
                  <p>{textValue(original, "description")}</p>
                </section>
              )}
              {versions.length === 0 ? <div className="prj-pm-empty">当前应用还没有版本记录。</div> : (
                <div className="prj-pm-code__timeline">
                  {versions.map((version, index) => <CodeVersionCard key={textValue(version, "id") || `${index}`} version={version} index={index} />)}
                </div>
              )}
            </article>
          ) : <div className="prj-pm-empty">还没有代码版本数据。</div>}
        </section>
      </div>
    </div>
  );
}
