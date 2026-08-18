import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store.js";
import "./RikingProjectsView.css";

type RikingLaunchMethod = "jar" | "tomcat" | "command" | "remote";
type RikingProjectLocation = "local" | "server";
type RikingProjectStatus = "stopped" | "starting" | "running" | "error" | "unknown";

interface RikingProject {
  id: string;
  name: string;
  location: RikingProjectLocation;
  launchMethod: RikingLaunchMethod;
  status: RikingProjectStatus;
  projectPath: string;
  jarPath: string;
  tomcatPath: string;
  startupScript: string;
  shutdownScript: string;
  customCommand: string;
  appUrl: string;
  logPath: string;
  db: {
    type: string;
    host: string;
    port: string;
    database: string;
    username: string;
    note: string;
  };
  login: {
    url: string;
    username: string;
    passwordHint: string;
    note: string;
  };
  remote: {
    host: string;
    user: string;
    port: string;
    projectPath: string;
    startCommand: string;
    stopCommand: string;
    logCommand: string;
  };
  createdAt: string;
  updatedAt: string;
  lastStartedAt?: string;
  lastError?: string;
}

const blankProject = (): RikingProject => ({
  id: "",
  name: "未命名 Riking 项目",
  location: "local",
  launchMethod: "tomcat",
  status: "stopped",
  projectPath: "",
  jarPath: "",
  tomcatPath: "",
  startupScript: "",
  shutdownScript: "",
  customCommand: "",
  appUrl: "",
  logPath: "",
  db: { type: "", host: "", port: "", database: "", username: "", note: "" },
  login: { url: "", username: "", passwordHint: "", note: "" },
  remote: { host: "", user: "", port: "22", projectPath: "", startCommand: "", stopCommand: "", logCommand: "" },
  createdAt: "",
  updatedAt: "",
});

const statusLabel: Record<RikingProjectStatus, string> = {
  stopped: "已停止",
  starting: "启动中",
  running: "运行中",
  error: "异常",
  unknown: "未知",
};

const methodLabel: Record<RikingLaunchMethod, string> = {
  jar: "Jar 包",
  tomcat: "Tomcat",
  command: "自定义命令",
  remote: "服务器命令",
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "请求失败");
  return body as T;
}

export function RikingProjectsView() {
  const setAppView = useStore((state) => state.setAppView);
  const [projects, setProjects] = useState<RikingProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<RikingProject>(() => blankProject());
  const [logs, setLogs] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const hasSelected = Boolean(draft.id);

  const loadProjects = async (preferId?: string) => {
    setLoading(true);
    try {
      const data = await requestJson<{ projects: RikingProject[] }>("/api/riking-projects");
      setProjects(data.projects);
      const nextId = preferId || selectedId || data.projects[0]?.id || "";
      setSelectedId(nextId);
      const nextProject = data.projects.find((project) => project.id === nextId) ?? data.projects[0] ?? blankProject();
      setDraft(nextProject);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      setDraft(selectedProject);
      setMessage("");
    }
  }, [selectedProject]);

  const refreshLogs = async () => {
    if (!draft.id) {
      setLogs("");
      return;
    }
    try {
      const data = await requestJson<{ logs: string; error?: string }>(`/api/riking-projects/${draft.id}/logs?lines=240`);
      setLogs(data.logs || data.error || "暂无日志内容");
    } catch (error) {
      setLogs(error instanceof Error ? error.message : "读取日志失败");
    }
  };

  useEffect(() => {
    void refreshLogs();
    if (!draft.id) return;
    const timer = window.setInterval(() => {
      void refreshLogs();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [draft.id, draft.logPath, draft.remote.logCommand]);

  const update = <K extends keyof RikingProject>(key: K, value: RikingProject[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateGroup = <G extends "db" | "login" | "remote", K extends keyof RikingProject[G]>(
    group: G,
    key: K,
    value: RikingProject[G][K],
  ) => {
    setDraft((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  };

  const startNew = () => {
    const project = blankProject();
    setSelectedId("");
    setDraft(project);
    setLogs("");
    setEditing(true);
    setMessage("正在新建启动项，保存后写入本地数据文件。");
  };

  const saveProject = async () => {
    setSaving(true);
    try {
      const payload = JSON.stringify(draft);
      const data = draft.id
        ? await requestJson<{ project: RikingProject }>(`/api/riking-projects/${draft.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: payload,
          })
        : await requestJson<{ project: RikingProject }>("/api/riking-projects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload,
      });
      setMessage("已保存到本地数据文件");
      setEditing(false);
      await loadProjects(data.project.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async () => {
    if (!draft.id) return;
    if (!window.confirm(`删除启动项「${draft.name}」？`)) return;
    try {
      await requestJson<{ ok: true }>(`/api/riking-projects/${draft.id}`, { method: "DELETE" });
      setMessage("已删除启动项");
      setSelectedId("");
      await loadProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    }
  };

  const startProject = async () => {
    if (!draft.id) return;
    try {
      setMessage("正在启动项目...");
      await requestJson<{ ok: true; pid?: number }>(`/api/riking-projects/${draft.id}/start`, { method: "POST" });
      await loadProjects(draft.id);
      setMessage("启动命令已发出");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "启动失败");
      await loadProjects(draft.id);
    }
  };

  const stopProject = async () => {
    if (!draft.id) return;
    try {
      await requestJson<{ ok: true }>(`/api/riking-projects/${draft.id}/stop`, { method: "POST" });
      await loadProjects(draft.id);
      setMessage("停止命令已发出");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "停止失败");
    }
  };

  const openApp = () => {
    if (!draft.appUrl) return;
    const target = `rich://open-external?url=${encodeURIComponent(draft.appUrl)}`;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const copyText = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`已复制${label}`);
    } catch {
      setMessage("复制失败，可以手动选中文本复制。");
    }
  };

  return (
    <div className="riking-projects-view">
      <header className="rkp-header">
        <div>
          <h1>Riking 项目</h1>
          <p>本地与服务器项目运行看板，重点看状态、入口、日志和连接信息。</p>
        </div>
      </header>

      <div className="rkp-command-bar">
        <button className="rkp-ghost" onClick={() => setAppView("apps")}>← 应用中心</button>
        <button onClick={() => void loadProjects()} disabled={loading}>刷新</button>
        <button className="rkp-primary" onClick={startProject} disabled={!hasSelected}>一键启动</button>
        <button onClick={stopProject} disabled={!hasSelected}>停止</button>
        <button onClick={openApp} disabled={!draft.appUrl}>打开应用</button>
        <button onClick={refreshLogs} disabled={!hasSelected}>刷新日志</button>
        <button onClick={() => setEditing((value) => !value)}>{editing ? "收起编辑" : "编辑配置"}</button>
        <button className="rkp-primary" onClick={startNew}>+ 新增项目</button>
      </div>

      <main className="rkp-layout">
        <aside className="rkp-sidebar">
          <div className="rkp-sidebar-title">
            <span>启动项</span>
            <strong>{projects.length}</strong>
          </div>
          <div className="rkp-project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`rkp-project-card ${project.id === selectedId ? "is-active" : ""}`}
                onClick={() => setSelectedId(project.id)}
              >
                <span className={`rkp-dot is-${project.status}`} />
                <strong>{project.name}</strong>
                <small>{methodLabel[project.launchMethod]} · {project.location === "local" ? "本地" : "服务器"}</small>
                <em>{statusLabel[project.status]}</em>
              </button>
            ))}
            {projects.length === 0 && <div className="rkp-empty">还没有启动项，可以先新增一个。</div>}
          </div>
        </aside>

        <section className="rkp-detail">
          <div className="rkp-detail-top">
            <div>
              <span className={`rkp-status is-${draft.status}`}>{statusLabel[draft.status]}</span>
              <h2>{draft.name || "未命名 Riking 项目"}</h2>
              <p>{methodLabel[draft.launchMethod]} · {draft.location === "local" ? "本地项目" : "服务器项目"}</p>
              {draft.lastStartedAt && <p>最近启动：{new Date(draft.lastStartedAt).toLocaleString()}</p>}
              {draft.lastError && <p className="rkp-error">异常：{draft.lastError}</p>}
            </div>
            <div className="rkp-status-board">
              <div><strong>{statusLabel[draft.status]}</strong><span>运行状态</span></div>
              <div><strong>{methodLabel[draft.launchMethod]}</strong><span>启动方式</span></div>
              <div><strong>{draft.location === "local" ? "本地" : "服务器"}</strong><span>项目位置</span></div>
            </div>
          </div>

          <div className="rkp-overview-grid">
            <button className="rkp-display-card" onClick={() => copyText(draft.appUrl, "应用链接")} disabled={!draft.appUrl}>
              <span>应用入口</span>
              <strong>{draft.appUrl || "未配置"}</strong>
              <em>点击复制链接</em>
            </button>
            <button className="rkp-display-card" onClick={() => copyText(draft.projectPath, "项目路径")} disabled={!draft.projectPath}>
              <span>项目路径</span>
              <strong>{draft.projectPath || "未配置"}</strong>
              <em>点击复制路径</em>
            </button>
            <button className="rkp-display-card" onClick={() => copyText(draft.logPath, "日志路径")} disabled={!draft.logPath}>
              <span>日志路径</span>
              <strong>{draft.logPath || "未配置"}</strong>
              <em>点击复制路径</em>
            </button>
            <div className="rkp-display-card">
              <span>容器 / 命令</span>
              <strong>{draft.tomcatPath || draft.jarPath || draft.customCommand || draft.remote.startCommand || "未配置"}</strong>
              <em>{methodLabel[draft.launchMethod]}</em>
            </div>
          </div>

          <div className="rkp-info-grid">
            <section>
              <h3>数据库连接信息</h3>
              <div className="rkp-read-list">
                <p><span>类型</span>{draft.db.type || "未配置"}</p>
                <p><span>地址</span>{[draft.db.host, draft.db.port].filter(Boolean).join(":") || "未配置"}</p>
                <p><span>库名</span>{draft.db.database || "未配置"}</p>
                <p><span>用户</span>{draft.db.username || "未配置"}</p>
                {draft.db.note && <p className="rkp-note"><span>说明</span>{draft.db.note}</p>}
              </div>
            </section>

            <section>
              <h3>登录应用信息</h3>
              <div className="rkp-read-list">
                <p><span>地址</span>{draft.login.url || draft.appUrl || "未配置"}</p>
                <p><span>账号</span>{draft.login.username || "未配置"}</p>
                <p><span>密码提示</span>{draft.login.passwordHint || "未配置"}</p>
                {draft.login.note && <p className="rkp-note"><span>说明</span>{draft.login.note}</p>}
              </div>
            </section>

            <section>
              <h3>服务器启动配置</h3>
              <div className="rkp-read-list">
                <p><span>SSH</span>{draft.remote.host ? `${draft.remote.user || "-"}@${draft.remote.host}:${draft.remote.port || "22"}` : "本地项目"}</p>
                <p><span>远程路径</span>{draft.remote.projectPath || "未配置"}</p>
                <p><span>启动</span>{draft.remote.startCommand || draft.startupScript || draft.customCommand || "未配置"}</p>
                <p><span>停止</span>{draft.remote.stopCommand || draft.shutdownScript || "未配置"}</p>
              </div>
            </section>
          </div>

          {editing && (
            <section className="rkp-edit-panel">
              <div className="rkp-edit-heading">
                <h3>编辑配置</h3>
                <div>
                  <button onClick={saveProject} disabled={saving}>{saving ? "保存中" : "保存配置"}</button>
                  <button className="rkp-danger" onClick={deleteProject} disabled={!hasSelected}>删除项目</button>
                </div>
              </div>

              <div className="rkp-form-grid">
                <label>
                  <span>项目名称</span>
                  <input value={draft.name} onChange={(event) => update("name", event.target.value)} />
                </label>
                <label>
                  <span>项目位置</span>
                  <select value={draft.location} onChange={(event) => update("location", event.target.value as RikingProjectLocation)}>
                    <option value="local">本地</option>
                    <option value="server">服务器</option>
                  </select>
                </label>
                <label>
                  <span>启动方式</span>
                  <select value={draft.launchMethod} onChange={(event) => update("launchMethod", event.target.value as RikingLaunchMethod)}>
                    <option value="tomcat">Tomcat</option>
                    <option value="jar">Jar 包</option>
                    <option value="command">自定义命令</option>
                    <option value="remote">服务器命令</option>
                  </select>
                </label>
                <label>
                  <span>应用链接</span>
                  <input value={draft.appUrl} onChange={(event) => update("appUrl", event.target.value)} placeholder="http://localhost:18081/oauth" />
                </label>
                <label className="rkp-wide">
                  <span>项目路径</span>
                  <input value={draft.projectPath} onChange={(event) => update("projectPath", event.target.value)} />
                </label>
                <label>
                  <span>Jar 包路径</span>
                  <input value={draft.jarPath} onChange={(event) => update("jarPath", event.target.value)} />
                </label>
                <label>
                  <span>Tomcat 路径</span>
                  <input value={draft.tomcatPath} onChange={(event) => update("tomcatPath", event.target.value)} />
                </label>
                <label>
                  <span>启动脚本</span>
                  <input value={draft.startupScript} onChange={(event) => update("startupScript", event.target.value)} />
                </label>
                <label>
                  <span>停止脚本</span>
                  <input value={draft.shutdownScript} onChange={(event) => update("shutdownScript", event.target.value)} />
                </label>
                <label className="rkp-wide">
                  <span>自定义启动命令</span>
                  <input value={draft.customCommand} onChange={(event) => update("customCommand", event.target.value)} />
                </label>
                <label className="rkp-wide">
                  <span>日志路径</span>
                  <input value={draft.logPath} onChange={(event) => update("logPath", event.target.value)} />
                </label>
              </div>

              <div className="rkp-edit-groups">
                <section>
                  <h4>数据库</h4>
                  <div className="rkp-form-grid is-compact">
                    <input value={draft.db.type} onChange={(event) => updateGroup("db", "type", event.target.value)} placeholder="数据库类型" />
                    <input value={draft.db.host} onChange={(event) => updateGroup("db", "host", event.target.value)} placeholder="Host / IP" />
                    <input value={draft.db.port} onChange={(event) => updateGroup("db", "port", event.target.value)} placeholder="端口" />
                    <input value={draft.db.database} onChange={(event) => updateGroup("db", "database", event.target.value)} placeholder="库名" />
                    <input value={draft.db.username} onChange={(event) => updateGroup("db", "username", event.target.value)} placeholder="用户名" />
                    <textarea value={draft.db.note} onChange={(event) => updateGroup("db", "note", event.target.value)} placeholder="说明、连接串、注意事项" />
                  </div>
                </section>
                <section>
                  <h4>登录</h4>
                  <div className="rkp-form-grid is-compact">
                    <input value={draft.login.url} onChange={(event) => updateGroup("login", "url", event.target.value)} placeholder="登录地址" />
                    <input value={draft.login.username} onChange={(event) => updateGroup("login", "username", event.target.value)} placeholder="账号" />
                    <input value={draft.login.passwordHint} onChange={(event) => updateGroup("login", "passwordHint", event.target.value)} placeholder="密码提示，不建议存明文" />
                    <textarea value={draft.login.note} onChange={(event) => updateGroup("login", "note", event.target.value)} placeholder="登录说明、角色、验证码等" />
                  </div>
                </section>
                <section>
                  <h4>远程</h4>
                  <div className="rkp-form-grid is-compact">
                    <input value={draft.remote.host} onChange={(event) => updateGroup("remote", "host", event.target.value)} placeholder="服务器 IP / 域名" />
                    <input value={draft.remote.user} onChange={(event) => updateGroup("remote", "user", event.target.value)} placeholder="SSH 用户" />
                    <input value={draft.remote.port} onChange={(event) => updateGroup("remote", "port", event.target.value)} placeholder="SSH 端口" />
                    <input value={draft.remote.projectPath} onChange={(event) => updateGroup("remote", "projectPath", event.target.value)} placeholder="远程项目路径" />
                    <textarea value={draft.remote.startCommand} onChange={(event) => updateGroup("remote", "startCommand", event.target.value)} placeholder="远程启动命令" />
                    <textarea value={draft.remote.stopCommand} onChange={(event) => updateGroup("remote", "stopCommand", event.target.value)} placeholder="远程停止命令" />
                    <textarea value={draft.remote.logCommand} onChange={(event) => updateGroup("remote", "logCommand", event.target.value)} placeholder="远程日志命令，例如 tail -n 200 /path/app.log" />
                  </div>
                </section>
              </div>
            </section>
          )}

          <section className="rkp-log-panel">
            <div>
              <h3>实时日志</h3>
              <span>{draft.logPath || draft.remote.logCommand || "未配置日志来源"}</span>
            </div>
            <pre>{logs || "配置日志路径后，这里会展示最近日志。"}</pre>
          </section>

          {message && <div className="rkp-toast">{message}</div>}
        </section>
      </main>
    </div>
  );
}
