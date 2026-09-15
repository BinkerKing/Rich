import { useEffect, useState } from "react";
import type { Element } from "@ke/domain";
import { api, type ProjectManagementSummary, type ProjectModuleItem } from "../../../api/client.js";
import { Button } from "../../../ui/index.js";
import {
  EnvironmentModuleCard,
  EnvironmentServerDetailModal,
  ProjectField,
  ProjectModuleEditorShell,
  ProjectRichTextEditor,
  ProjectTextField,
  arrayRecords,
  parseJsonArray,
  recordValue,
  textValue,
} from "../ProjectManagementModules.js";

export function EnvironmentsSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [environments, setEnvironments] = useState<ProjectModuleItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedServer, setSelectedServer] = useState<{ server: Record<string, unknown>; module: Record<string, unknown>; environment: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void api.listProjectManagementModuleItems(project.id, "environments")
      .then(next => {
        if (cancelled) return;
        setEnvironments(next);
        setSelectedId(current => current || next[0]?.id || "");
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [project.id]);

  const selected = environments.find(env => env.id === selectedId) ?? environments[0];
  const original = recordValue(selected?.content.original);
  const modules = arrayRecords(original.modules);
  const connections = arrayRecords(original.connections);
  const serverCount = modules.reduce((sum, module) => sum + arrayRecords(module.servers).length, 0);
  const count = summary?.modules.find(module => module.key === "environments")?.count ?? environments.length;
  const selectedTitle = textValue(original, "name") || textValue(original, "title") || selected?.title || "环境配置";
  const beginEdit = () => {
    if (!selected) return;
    setDraft({ ...original, title: selectedTitle, name: selectedTitle });
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
        subtitle: textValue(draft, "type") || selected.subtitle,
        content: { ...selected.content, original: { ...original, ...draft, name: title, title } },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "environments");
      setEnvironments(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded && !error) return null;
  if (!error && environments.length === 0) return <p className="prj-pm-unconfigured">暂未配置。</p>;

  return (
    <div className="prj-pm-env prj-pm-legacy-skin">
      {error && <div className="prj-pm-error">{error}</div>}

      <div className="env-title-row">
        <div className="prj-pm-env__tabs env-title-tabs">
          {environments.map(env => (
            <button
              key={env.id}
              type="button"
              className={`prj-pm-title-choice${selected?.id === env.id ? " is-active" : ""}`}
              onClick={() => {
                setSelectedId(env.id);
                setEditing(false);
              }}>
              <strong>{textValue(env.content.original, "name") || env.title}</strong>
              {env.subtitle && <span>{env.subtitle}</span>}
            </button>
          ))}
        </div>
        {selected && (
          <div className="env-title-tools">
            <div className="env-mini-stat"><strong>{count}</strong><span>环境</span></div>
            <div className="env-mini-stat"><strong>{editing ? arrayRecords(draft.modules).reduce((sum, module) => sum + arrayRecords(module.servers).length, 0) : serverCount}</strong><span>服务器</span></div>
            <div className="env-mini-stat"><strong>{editing ? arrayRecords(draft.connections).length : connections.length}</strong><span>连接</span></div>
            {editing ? (
              <>
                <Button variant="secondary" className={`env-mode-toggle env-mode-toggle--compact${busy ? " is-saving" : ""}`} onClick={() => void save()} disabled={busy}>{busy ? "保存中" : "保存"}</Button>
                <Button variant="secondary" className="env-mode-toggle env-mode-toggle--compact" onClick={() => setEditing(false)} disabled={busy}>取消</Button>
              </>
            ) : (
              <Button variant="secondary" className="env-mode-toggle env-mode-toggle--compact" onClick={beginEdit}>编辑</Button>
            )}
          </div>
        )}
      </div>

      {selected ? (
        editing ? (
          <div className="env-workspace">
            <section className="panel env-edit-head">
              <div className="env-banner-main">
                <label>
                  <span>环境名称</span>
                  <input className="env-title-input" value={textValue(draft, "name") || textValue(draft, "title")} onChange={event => onDraftEnvChange(draft, setDraft, { name: event.target.value, title: event.target.value })} />
                </label>
                <label>
                  <span>环境说明</span>
                  <textarea value={textValue(draft, "description")} onChange={event => onDraftEnvChange(draft, setDraft, { description: event.target.value })} />
                </label>
              </div>
            </section>
            <section className="panel env-page-head">
              <div className="env-section-head">
                <div>
                  <h3>模块与服务器</h3>
                  <p>编辑模式下保留原始结构，后续可以继续升级成逐项编辑。</p>
                </div>
              </div>
              <ProjectField label="模块与服务器 JSON">
                <textarea value={JSON.stringify(arrayRecords(draft.modules), null, 2)} onChange={event => onDraftEnvChange(draft, setDraft, { modules: parseJsonArray(event.target.value) })} />
              </ProjectField>
            </section>
            <section className="panel env-connection-panel">
              <div className="env-section-head">
                <div>
                  <h3>连接关系</h3>
                  <p>来源、目标、端口、用途都按旧工具表格结构保存。</p>
                </div>
              </div>
              <ProjectField label="连接关系 JSON">
                <textarea value={JSON.stringify(arrayRecords(draft.connections), null, 2)} onChange={event => onDraftEnvChange(draft, setDraft, { connections: parseJsonArray(event.target.value) })} />
              </ProjectField>
            </section>
          </div>
        ) : <div className="env-workspace">
          <section className="module-grid env-module-grid">
            {modules.length === 0 ? <div className="panel env-empty-panel">当前环境还没有服务器模块。</div> : modules.map((module, index) => (
              <EnvironmentModuleCard
                key={textValue(module, "id") || textValue(module, "name")}
                module={module}
                index={index}
                environmentName={selectedTitle}
                onServerClick={(server) => setSelectedServer({ server, module, environment: selectedTitle })}
              />
            ))}
          </section>

          <section className="panel env-connection-panel">
            <div className="env-section-head">
              <div>
                <h3>连接关系</h3>
                <p>展示应用、数据库、前置机、可信区组件之间的端口和用途。</p>
              </div>
            </div>
            {connections.length === 0 ? (
              <div className="prj-pm-empty">当前环境还没有连接关系。</div>
            ) : (
              <div className="env-connection-table">
                <div className="env-connection-header">
                  <span>来源模块</span><span>来源服务器</span><span>目标模块</span><span>目标服务器</span><span>端口</span><span>用途说明</span>
                </div>
                {connections.map((connection, index) => (
                  <div className="env-connection-row" key={`${textValue(connection, "from")}-${textValue(connection, "to")}-${index}`}>
                    <strong>{textValue(connection, "fromModule") || textValue(connection, "from")}</strong>
                    <span>{textValue(connection, "from")}</span>
                    <strong>{textValue(connection, "toModule") || textValue(connection, "to")}</strong>
                    <span>{textValue(connection, "to")}</span>
                    <code>{textValue(connection, "port") || "-"}</code>
                    <p>{textValue(connection, "purpose") || textValue(connection, "note")}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : <div className="prj-pm-empty">还没有环境配置数据。</div>}

      {selectedServer && (
        <EnvironmentServerDetailModal
          server={selectedServer.server}
          module={selectedServer.module}
          environment={selectedServer.environment}
          onClose={() => setSelectedServer(null)}
        />
      )}
    </div>
  );
}

function onDraftEnvChange(
  current: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void,
  patch: Record<string, unknown>,
) {
  onChange({ ...current, ...patch });
}

function EnvironmentEditor({
  projectId,
  draft,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  projectId: string;
  draft: Record<string, unknown>;
  busy: boolean;
  onChange: (next: Record<string, unknown>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <ProjectModuleEditorShell title="编辑环境配置" busy={busy} onSave={onSave} onCancel={onCancel}>
      <div className="prj-pm-editor-grid">
        <ProjectTextField label="环境名称" value={textValue(draft, "title")} onChange={value => onChange({ ...draft, title: value })} />
        <ProjectTextField label="环境类型" value={textValue(draft, "type")} onChange={value => onChange({ ...draft, type: value })} />
      </div>
      <ProjectField label="环境说明">
        <ProjectRichTextEditor projectId={`${projectId}-environment`} value={textValue(draft, "description")} onChange={description => onChange({ ...draft, description })} />
      </ProjectField>
      <ProjectField label="模块与服务器">
        <textarea value={JSON.stringify(arrayRecords(draft.modules), null, 2)} onChange={event => onChange({ ...draft, modules: parseJsonArray(event.target.value) })} />
      </ProjectField>
      <ProjectField label="连接关系">
        <textarea value={JSON.stringify(arrayRecords(draft.connections), null, 2)} onChange={event => onChange({ ...draft, connections: parseJsonArray(event.target.value) })} />
      </ProjectField>
    </ProjectModuleEditorShell>
  );
}
