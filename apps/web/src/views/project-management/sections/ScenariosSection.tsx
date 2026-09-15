import { useEffect, useState } from "react";
import type { Element } from "@ke/domain";
import { api, type ProjectManagementSummary, type ProjectModuleItem } from "../../../api/client.js";
import { Button } from "../../../ui/index.js";
import { ScenarioDetail, getScenarios, recordValue, scenarioMarkerClass, scenarioToDraft, splitLines, textValue } from "../ProjectManagementModules.js";

export function ScenariosSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [groups, setGroups] = useState<ProjectModuleItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftScenarios, setDraftScenarios] = useState<ScenarioDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = () => api.listProjectManagementModuleItems(project.id, "scenarios").then(next => {
    setGroups(next);
    const firstGroup = next[0];
    const firstScenario = getScenarios(firstGroup)[0];
    setSelectedGroupId(current => current || firstGroup?.id || "");
    setSelectedScenarioId(current => current || textValue(firstScenario, "id"));
  });

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void reload()
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [project.id]);

  const selectedGroup = groups.find(group => group.id === selectedGroupId) ?? groups[0];
  const selectedGroupOriginal = recordValue(selectedGroup?.content.original);
  const scenarios = getScenarios(selectedGroup);
  const selectedScenario = scenarios.find(scenario => textValue(scenario, "id") === selectedScenarioId) ?? scenarios[0];
  const count = groups.reduce((sum, group) => sum + getScenarios(group).length, 0);
  const groupCount = summary?.modules.find(module => module.key === "scenarios")?.count ?? groups.length;
  const beginEdit = (group: ProjectModuleItem) => {
    setSelectedGroupId(group.id);
    setDraftTitle(group.title);
    setDraftScenarios(getScenarios(group).map(scenarioToDraft));
    setEditing(true);
  };
  const createGroup = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProjectManagementModuleItem(project.id, "scenarios", {
        title: "新场景分组",
        sortOrder: groups.length,
        content: { sourceKey: "scenarioGroups", original: { id: `scenario-group-${Date.now()}`, title: "新场景分组", scenarios: [] } },
      });
      await reload();
      beginEdit(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const deleteGroup = async () => {
    if (!selectedGroup || !window.confirm(`删除场景分组「${selectedGroup.title}」？`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteProjectManagementModuleItem(project.id, selectedGroup.id);
      await reload();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const saveGroup = async () => {
    if (!selectedGroup) return;
    const title = draftTitle.trim() || "未命名分组";
    setBusy(true);
    setError(null);
    try {
      const scenariosPayload = draftScenarios.map((scenario, index) => ({
        ...scenario,
        id: scenario.id || `scenario-${Date.now()}-${index}`,
        sceneNo: scenario.sceneNo || `场景${index + 1}`,
        steps: splitLines(scenario.stepsText),
        checks: splitLines(scenario.checksText),
        tips: splitLines(scenario.tipsText),
        images: splitLines(scenario.imagesText).map(name => ({ name })),
      }));
      await api.updateProjectManagementModuleItem(project.id, selectedGroup.id, {
        title,
        content: {
          ...selectedGroup.content,
          original: {
            ...selectedGroupOriginal,
            title,
            scenarios: scenariosPayload,
          },
        },
      });
      await reload();
      setSelectedScenarioId(scenariosPayload[0]?.id || "");
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded && !error) return null;
  if (!error && groups.length === 0) return <p className="prj-pm-unconfigured">暂未配置。</p>;

  return (
    <div className="prj-pm-scenarios prj-pm-scenarios-skin">
      {error && <div className="prj-pm-error">{error}</div>}
      <section className="scenario-toolbar">
        <div className={`scenario-tabs${editing ? " is-editing" : ""}`}>
          {groups.map(group => {
            const groupScenarios = getScenarios(group);
            const isActive = selectedGroup?.id === group.id;
            return editing ? (
              <div key={group.id} className={`scenario-group-pill${isActive ? " is-active" : ""}`}>
                <button
                  type="button"
                  className="scenario-group-switch"
                  aria-label={`切换到 ${group.title}`}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setSelectedScenarioId(textValue(groupScenarios[0], "id"));
                    beginEdit(group);
                  }}
                />
                <span>{group.title}</span>
                <strong>{groupScenarios.length}</strong>
              </div>
            ) : (
              <button
                key={group.id}
                type="button"
                className={`scenario-group-title${isActive ? " is-active" : ""}`}
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setSelectedScenarioId(textValue(groupScenarios[0], "id"));
                }}>
                {group.title}
              </button>
            );
          })}
          {editing && <Button variant="secondary" className="scenario-group-add" onClick={() => void createGroup()} disabled={busy}>+ 新增分组</Button>}
        </div>
        <div className="scenario-toolbar-meta">
          <span>{groupCount} 分组</span>
          <span>{count} 场景</span>
          {selectedGroup && !editing && <Button variant="secondary" className="scenario-edit-toggle" onClick={() => beginEdit(selectedGroup)}>编辑</Button>}
          {selectedGroup && editing && <Button variant="secondary" className="scenario-edit-toggle is-saving" onClick={() => void saveGroup()} disabled={busy}>保存</Button>}
          {selectedGroup && editing && <Button variant="danger" className="scenario-edit-toggle is-danger" onClick={() => void deleteGroup()} disabled={busy}>删除分组</Button>}
        </div>
      </section>

      <section className="scenario-workbench">
        <aside className="scenario-index">
          {groups.map(group => {
            const groupScenarios = getScenarios(group);
            const isOpen = selectedGroup?.id === group.id;
            return (
              <div key={group.id} className="scenario-index-group">
                <button
                  type="button"
                  className={`scenario-index-title${isOpen ? " is-active" : ""}`}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setSelectedScenarioId(textValue(groupScenarios[0], "id"));
                  }}>
                  <strong>{group.title}</strong>
                  <span>{groupScenarios.length}</span>
                </button>
                <div className="scenario-index-list">
                  {editing && isOpen && (
                    <Button
                      variant="secondary"
                      className="scenario-add-item"
                      onClick={() => onAddDraftScenario(draftScenarios, setDraftScenarios)}>
                      + 新增场景
                    </Button>
                  )}
                  {groupScenarios.map(scenario => {
                    const scenarioId = textValue(scenario, "id") || textValue(scenario, "title");
                    const markerClass = scenarioMarkerClass(textValue(scenario, "markerColor"));
                    return (
                      <button
                        key={scenarioId}
                        type="button"
                        className={`scenario-index-item${markerClass ? ` has-marker ${markerClass}` : ""}${scenarioId === textValue(selectedScenario, "id") ? " is-active" : ""}`}
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setSelectedScenarioId(scenarioId);
                        }}>
                        <span>{textValue(scenario, "sceneNo") || "场景"}</span>
                        <strong>{textValue(scenario, "title") || "未命名场景"}</strong>
                      </button>
                    );
                  })}
                  {groupScenarios.length === 0 && <p className="empty-note">暂无场景</p>}
                </div>
              </div>
            );
          })}
        </aside>

        <article className="scenario-detail">
          {selectedGroup && editing ? (
            <ScenarioGroupEditor
              title={draftTitle}
              scenarios={draftScenarios}
              busy={busy}
              onTitleChange={setDraftTitle}
              onScenariosChange={setDraftScenarios}
              onSave={() => void saveGroup()}
              onCancel={() => setEditing(false)}
            />
          ) : selectedScenario ? <ScenarioDetail scenario={selectedScenario} groupTitle={selectedGroup?.title} projectId={project.id} /> : (
            <div className="scenario-empty-detail">还没有场景手册数据。</div>
          )}
        </article>
      </section>
    </div>
  );
}

interface ScenarioDraft {
  id: string;
  sceneNo: string;
  title: string;
  goal: string;
  entry: string;
  stepsText: string;
  checksText: string;
  tipsText: string;
  imagesText: string;
}

function onAddDraftScenario(scenarios: ScenarioDraft[], onScenariosChange: (items: ScenarioDraft[]) => void) {
  onScenariosChange([...scenarios, {
    id: `scenario-${Date.now()}`,
    sceneNo: `场景${scenarios.length + 1}`,
    title: "新场景",
    goal: "",
    entry: "",
    stepsText: "",
    checksText: "",
    tipsText: "",
    imagesText: "",
  }]);
}

function ScenarioGroupEditor({
  title,
  scenarios,
  busy,
  onTitleChange,
  onScenariosChange,
  onSave,
  onCancel,
}: {
  title: string;
  scenarios: ScenarioDraft[];
  busy: boolean;
  onTitleChange: (value: string) => void;
  onScenariosChange: (items: ScenarioDraft[]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const updateScenario = (index: number, patch: Partial<ScenarioDraft>) => {
    onScenariosChange(scenarios.map((scenario, i) => i === index ? { ...scenario, ...patch } : scenario));
  };
  return (
    <div className="prj-pm-scenarios__editor">
      <header>
        <h3>编辑场景分组</h3>
        <div>
          <Button variant="secondary" className="prj-btn-link" onClick={onCancel} disabled={busy}>取消</Button>
          <Button variant="secondary" className="prj-btn-primary" onClick={onSave} disabled={busy}>保存</Button>
        </div>
      </header>
      <label>
        <span>分组名称</span>
        <input value={title} onChange={event => onTitleChange(event.target.value)} />
      </label>
      <div className="prj-pm-scenarios__editor-list">
        {scenarios.map((scenario, index) => (
          <section key={`${scenario.id}-${index}`}>
            <div className="prj-pm-scenarios__editor-scene-head">
              <strong>{scenario.sceneNo || `场景${index + 1}`}</strong>
              <Button variant="danger" className="prj-btn-link prj-btn-danger" onClick={() => onScenariosChange(scenarios.filter((_, i) => i !== index))}>删除</Button>
            </div>
            <div className="prj-pm-scenarios__editor-grid">
              <label>
                <span>编号</span>
                <input value={scenario.sceneNo} onChange={event => updateScenario(index, { sceneNo: event.target.value })} />
              </label>
              <label>
                <span>名称</span>
                <input value={scenario.title} onChange={event => updateScenario(index, { title: event.target.value })} />
              </label>
            </div>
            <label>
              <span>场景</span>
              <textarea value={scenario.goal} onChange={event => updateScenario(index, { goal: event.target.value })} />
            </label>
            <label>
              <span>入口</span>
              <textarea value={scenario.entry} onChange={event => updateScenario(index, { entry: event.target.value })} />
            </label>
            <label>
              <span>操作步骤</span>
              <textarea value={scenario.stepsText} onChange={event => updateScenario(index, { stepsText: event.target.value })} />
            </label>
            <label>
              <span>检查项</span>
              <textarea value={scenario.checksText} onChange={event => updateScenario(index, { checksText: event.target.value })} />
            </label>
            <label>
              <span>注意事项</span>
              <textarea value={scenario.tipsText} onChange={event => updateScenario(index, { tipsText: event.target.value })} />
            </label>
            <label>
              <span>截图名称</span>
              <textarea value={scenario.imagesText} onChange={event => updateScenario(index, { imagesText: event.target.value })} />
            </label>
          </section>
        ))}
      </div>
      <Button
        variant="secondary"
        className="prj-btn-link"
        onClick={() => onAddDraftScenario(scenarios, onScenariosChange)}>
        新增场景
      </Button>
    </div>
  );
}
