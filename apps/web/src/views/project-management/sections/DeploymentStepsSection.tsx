import { useEffect, useState } from "react";
import type { Element } from "@ke/domain";
import { api, type ProjectManagementSummary, type ProjectModuleItem } from "../../../api/client.js";
import { Button } from "../../../ui/index.js";
import { DeploymentStepDetail, DeploymentStepEditor, arrayRecords, deploymentSheetOf, recordValue, textValue } from "../ProjectManagementModules.js";

type DictionaryTreeDragEvent = { dataTransfer: DataTransfer; preventDefault: () => void };

export function ProjectDeploymentStepsSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [items, setItems] = useState<ProjectModuleItem[]>([]);
  const [environmentItems, setEnvironmentItems] = useState<ProjectModuleItem[]>([]);
  const [release, setRelease] = useState("");
  const [sheet, setSheet] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draggedStepId, setDraggedStepId] = useState("");
  const [draggedReleaseName, setDraggedReleaseName] = useState("");
  const [draggedSheetName, setDraggedSheetName] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void api.listProjectManagementModuleItems(project.id, "deploymentSteps")
      .then(next => {
        if (cancelled) return;
        setItems(next);
        const firstOriginal = recordValue(next[0]?.content.original);
        setRelease(current => current || textValue(firstOriginal, "release") || "首次部署");
        setSheet(current => current || deploymentSheetOf(firstOriginal));
        setSelectedId(current => current || next[0]?.id || "");
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    void api.listProjectManagementModuleItems(project.id, "environments")
      .then(next => { if (!cancelled) setEnvironmentItems(next); })
      .catch(() => { if (!cancelled) setEnvironmentItems([]); });
    return () => { cancelled = true; };
  }, [project.id]);

  const releases = [...new Set(items.map(item => textValue(item.content.original, "release") || "首次部署"))];
  const activeRelease = release || releases[0] || "首次部署";
  const releaseItems = items.filter(item => (textValue(item.content.original, "release") || "首次部署") === activeRelease);
  const sheets = [...new Set(releaseItems.map(item => deploymentSheetOf(recordValue(item.content.original))))];
  const activeSheet = sheet && sheets.includes(sheet) ? sheet : sheets[0] || "";
  const selectedVersionSteps = releaseItems.filter(item => deploymentSheetOf(recordValue(item.content.original)) === activeSheet);
  const selected = selectedVersionSteps.find(item => item.id === selectedId) ?? selectedVersionSteps[0];
  const selectedOriginal = recordValue(selected?.content.original);
  const checklistTotal = releaseItems.reduce((sum, item) => sum + arrayRecords(recordValue(item.content.original).checklist).length, 0);
  const count = summary?.modules.find(module => module.key === "deploymentSteps")?.count ?? items.length;
  const loadDraft = (item?: ProjectModuleItem) => {
    if (!item) return;
    const original = recordValue(item.content.original);
    setSelectedId(item.id);
    setDraft({ ...original, title: item.title });
  };
  const beginEdit = () => {
    if (!selected) return;
    loadDraft(selected);
    setEditing(true);
  };
  const save = async () => {
    if (!selected) return;
    const title = textValue(draft, "phase") || textValue(draft, "title") || selected.title;
    setBusy(true);
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, selected.id, {
        title,
        subtitle: textValue(draft, "sheetName") || selected.subtitle,
        content: { ...selected.content, original: { ...selectedOriginal, ...draft, phase: title } },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "deploymentSteps");
      setItems(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const createDeploymentStep = async (targetSheet = activeSheet || "部署步骤", phase = "新部署区块") => {
    const targetRelease = activeRelease || "首次部署";
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProjectManagementModuleItem(project.id, "deploymentSteps", {
        title: phase,
        subtitle: targetSheet,
        sortOrder: items.length,
        content: {
          sourceKey: "deploymentSteps",
          original: {
            id: `deployment-${Date.now()}`,
            release: targetRelease,
            sheetName: targetSheet,
            version: targetSheet,
            phase,
            target: "",
            environment: "",
            executionHtml: "",
            executionText: "",
            checklist: [],
            serverIdsByEnv: {},
            steps: [],
          },
        },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "deploymentSteps");
      setItems(next);
      setRelease(targetRelease);
      setSheet(targetSheet);
      setSelectedId(created.id);
      setDraft(recordValue(created.content.original));
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const createDeploymentArea = async () => {
    const name = `新区域 ${sheets.length + 1}`;
    await createDeploymentStep(name, "新区域主题");
  };
  const persistDeploymentOrder = async (nextIds: string[]) => {
    setItems(nextIds.map(id => items.find(item => item.id === id)).filter((item): item is ProjectModuleItem => Boolean(item)));
    try {
      await api.reorderProjectManagementModuleItems(project.id, "deploymentSteps", nextIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      const next = await api.listProjectManagementModuleItems(project.id, "deploymentSteps");
      setItems(next);
    }
  };
  const toggleChecklistItem = async (index: number) => {
    if (!selected) return;
    const selectedOriginal = recordValue(selected.content.original);
    const checklist = arrayRecords(selectedOriginal.checklist);
    const nextChecklist = checklist.map((row, rowIndex) => rowIndex === index ? { ...row, done: !Boolean(row.done) } : row);
    setError(null);
    try {
      const updated = await api.updateProjectManagementModuleItem(project.id, selected.id, {
        content: { ...selected.content, original: { ...selectedOriginal, checklist: nextChecklist } },
      });
      setItems(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const reorderDeploymentGroups = async (names: string[], dragged: string, before: string, scopedItems: ProjectModuleItem[], groupOf: (item: ProjectModuleItem) => string) => {
    if (!editing || !dragged || dragged === before) return;
    const from = names.indexOf(dragged);
    const to = names.indexOf(before);
    if (from < 0 || to < 0) return;
    const ordered = [...names];
    const [moving] = ordered.splice(from, 1);
    ordered.splice(to, 0, moving);
    const scopedIds = new Set(scopedItems.map(item => item.id));
    const orderedScopedIds = ordered.flatMap(name => scopedItems.filter(item => groupOf(item) === name).map(item => item.id));
    let index = 0;
    const nextIds = items.map(item => scopedIds.has(item.id) ? orderedScopedIds[index++] : item.id);
    await persistDeploymentOrder(nextIds);
    setDraggedReleaseName("");
    setDraggedSheetName("");
  };
  const reorderDeploymentSteps = async (draggedId: string, beforeId: string) => {
    if (!editing || !draggedId || draggedId === beforeId) return;
    const current = [...selectedVersionSteps];
    const from = current.findIndex(item => item.id === draggedId);
    const to = current.findIndex(item => item.id === beforeId);
    if (from < 0 || to < 0) return;
    const [moving] = current.splice(from, 1);
    current.splice(to, 0, moving);
    const selectedIds = new Set(selectedVersionSteps.map(item => item.id));
    let index = 0;
    const nextIds = items.map(item => selectedIds.has(item.id) ? current[index++].id : item.id);
    setDraggedStepId("");
    await persistDeploymentOrder(nextIds);
  };

  if (!loaded && !error) return null;
  if (!error && items.length === 0) return <p className="prj-pm-unconfigured">暂未配置。</p>;

  return (
    <div className={`deployment-workspace prj-pm-legacy-skin${items.length === 0 ? " is-empty" : ""}${editing ? " is-editing" : ""}`}>
      {error && <div className="prj-pm-error">{error}</div>}

      {items.length === 0 ? (
        <>
          <section className="deployment-title-row">
            <div className="deployment-title-tabs" />
            <div className="deployment-title-actions">
              <Button variant="secondary" className={`deployment-mode-toggle${editing ? " is-saving" : ""}`} onClick={() => setEditing(!editing)}>{editing ? "完成" : "编辑"}</Button>
            </div>
          </section>
          <section className="panel"><p className="empty-note">暂无部署步骤。</p></section>
        </>
      ) : (
        <>
          <section className="deployment-title-row deployment-release-row">
            <div className="deployment-title-tabs deployment-release-tabs">
              {releases.map(name => {
                const currentReleaseItems = items.filter(item => (textValue(item.content.original, "release") || "首次部署") === name);
                const releaseSheets = [...new Set(currentReleaseItems.map(item => deploymentSheetOf(recordValue(item.content.original))))];
                const active = activeRelease === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`deployment-title-tab deployment-release-tab${active ? " is-active" : ""}`}
                    draggable={editing}
                    onDragStart={() => setDraggedReleaseName(name)}
                    onDragOver={event => { if (editing) event.preventDefault(); }}
                    onDrop={event => { event.preventDefault(); void reorderDeploymentGroups(releases, draggedReleaseName, name, items, item => textValue(item.content.original, "release") || "首次部署"); }}
                    aria-pressed={active}
                    onClick={() => {
                      const first = currentReleaseItems[0];
                      const firstOriginal = recordValue(first?.content.original);
                      setRelease(name);
                      setSheet(deploymentSheetOf(firstOriginal));
                      setSelectedId(first?.id || "");
                      if (editing) loadDraft(first);
                    }}>
                    <span>版本</span>
                    <strong>{name}</strong>
                    <small>{releaseSheets.length} 个 Sheet · {currentReleaseItems.length} 个区块</small>
                  </button>
                );
              })}
            </div>
            <div className="deployment-title-actions">
              <span className="deployment-count-note">{count} 区块 · {checklistTotal} 检查</span>
              <Button variant="secondary" className={`deployment-mode-toggle${editing ? " is-saving" : ""}`} onClick={() => {
                if (editing) setEditing(false);
                else beginEdit();
              }}>{editing ? "完成" : "编辑"}</Button>
              {editing && <>
                <Button variant="secondary" onClick={() => void createDeploymentArea()} disabled={busy}>+ 区域</Button>
                <Button variant="secondary" onClick={() => void createDeploymentStep()} disabled={busy}>+ 主题</Button>
              </>}
            </div>
          </section>

          <section className="deployment-title-row deployment-sheet-row">
            <div className="deployment-title-tabs">
              {sheets.map(name => {
                const versionSteps = releaseItems.filter(item => deploymentSheetOf(recordValue(item.content.original)) === name);
                const active = activeSheet === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`deployment-title-tab${active ? " is-active" : ""}`}
                    draggable={editing}
                    onDragStart={() => setDraggedSheetName(name)}
                    onDragOver={event => { if (editing) event.preventDefault(); }}
                    onDrop={event => { event.preventDefault(); void reorderDeploymentGroups(sheets, draggedSheetName, name, releaseItems, item => deploymentSheetOf(recordValue(item.content.original))); }}
                    aria-pressed={active}
                    onClick={() => {
                      setSheet(name);
                      setSelectedId(versionSteps[0]?.id || "");
                      if (editing) loadDraft(versionSteps[0]);
                    }}>
                    <span>Sheet</span>
                    <strong>{name}</strong>
                    <small>{versionSteps.length} 个区块</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="deployment-layout">
            <aside className="deployment-sidebar">
              <div className="deployment-sidebar-head">
                <strong>{activeSheet || "部署目录"}</strong>
                <span>{selectedVersionSteps.length} 个区块</span>
              </div>
              <div className="deployment-menu">
                <section className="deployment-version-menu">
                  {selectedVersionSteps.map((item, index) => {
                    const original = recordValue(item.content.original);
                    return (
                      <article
                        key={item.id}
                        className={`deployment-step-nav${selected?.id === item.id ? " is-active" : ""}${editing ? " is-editable" : ""}`}
                        draggable={editing}
                        onDragStart={() => setDraggedStepId(item.id)}
                        onDragOver={event => { if (editing) event.preventDefault(); }}
                        onDrop={event => { event.preventDefault(); void reorderDeploymentSteps(draggedStepId, item.id); }}
                        onDragEnd={() => setDraggedStepId("")}>
                        <button
                          className="deployment-step-main"
                          type="button"
                          onClick={() => {
                            if (editing) loadDraft(item);
                            else setSelectedId(item.id);
                          }}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{textValue(original, "phase") || item.title || "未命名模块"}</strong>
                          <small>{textValue(original, "sourceType") === "excel-sheet" ? `${textValue(original, "rowCount") || arrayRecords(original.steps).length} 行记录` : textValue(original, "target") || "未填写说明"}</small>
                        </button>
                      </article>
                    );
                  })}
                </section>
              </div>
            </aside>

            <section className="deployment-detail">
              {selected ? (
                editing ? (
                  <DeploymentStepEditor
                    projectId={project.id}
                    draft={draft}
                    busy={busy}
                    onChange={setDraft}
                    onSave={() => void save()}
                    onCancel={() => setEditing(false)}
                  />
                ) : <DeploymentStepDetail item={selected} environments={environmentItems} onToggleChecklist={index => void toggleChecklistItem(index)} />
              ) : <div className="prj-pm-empty">请选择部署模块。</div>}
            </section>
          </section>
        </>
      )}
    </div>
  );
}
