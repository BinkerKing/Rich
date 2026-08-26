import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import type { DeploymentStepContent, Element, ProjectContent } from "@ke/domain";
import { useStore } from "../state/store.js";
import {
  api,
  type ProjectFolderNode,
  type ProjectFolderScanResult,
  type ProjectManagementSummary,
} from "../api/client.js";
import { TopologyCanvas } from "./TopologyCanvas.js";
import {
  AutomationSection,
  CodeVersionsSection,
  DictionarySection,
  EnvironmentsSection,
  MonitoringSection,
  ProjectDeploymentStepsSection,
  ProjectDescriptionSection,
  ProjectManagementSearchBar,
  PROJECT_MANAGEMENT_SECTIONS,
  ScenariosSection,
  TodosSection,
  WorkflowSection,
  type ProjectManagementSection,
} from "./project-management/index.js";

interface Props { projectId: string }

export function ProjectWorkspace({ projectId }: Props): ReactNode {
  const project = useStore(s => s.elements.get(projectId));
  const [section, setSection] = useState<ProjectManagementSection>(() => loadProjectManagementWorkspaceSection(projectId));
  const [summary, setSummary] = useState<ProjectManagementSummary | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);

  useEffect(() => {
    setSection(loadProjectManagementWorkspaceSection(projectId));
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void api.getProjectManagementSummary(projectId)
      .then(next => { if (!cancelled) setSummary(next); })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [projectId]);

  if (!project) {
    return (
      <div className="prj-ws">
        <header className="prj-ws__head">
          <span className="prj-ws__title">项目不存在</span>
        </header>
        <div className="prj-ws__empty">找不到 id={projectId}。可能已被删除。</div>
      </div>
    );
  }

  const c = (project.content ?? {}) as ProjectContent;
  const statusLabel = c.status === "archived" ? "已归档"
                    : c.status === "paused" ? "暂停"
                    : "进行中";
  const toggleWindowMaximize = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("button, a, input, textarea, select, [role='button'], [role='tab'], [contenteditable='true']")) return;
    window.location.href = "rich://window/toggle-maximize";
  };
  const selectSection = (next: ProjectManagementSection) => {
    setSection(next);
    saveProjectManagementWorkspaceSection(projectId, next);
  };
  const openDictionaryMapping = (tableId: string, systemId?: string) => {
    saveDictionaryMappingTarget(project.id, tableId, systemId);
    selectSection("dictionary");
  };

  return (
    <div className="prj-ws">
      <header className="prj-ws__head" onDoubleClick={toggleWindowMaximize}>
        <div className="prj-ws__project-title" aria-label="当前项目">
          <span className="prj-ws__title">{project.title}</span>
          <span className={`prj-ws__status prj-ws__status--${c.status ?? "active"}`}>{statusLabel}</span>
          {c.owner && <span className="prj-ws__owner">· {c.owner}</span>}
        </div>
        <nav className="prj-ws__nav" role="tablist" aria-label="项目管理菜单">
          {PROJECT_MANAGEMENT_SECTIONS.map(s => (
            <button key={s.id} type="button" role="tab"
              aria-label={s.label}
              title={s.label}
              data-section={s.id}
              aria-selected={section === s.id}
              className={`prj-ws__nav-btn${section === s.id ? " is-active" : ""}`}
              onClick={() => selectSection(s.id)}>
              <span className="prj-ws__nav-icon" aria-hidden="true">{s.icon}</span>
              <span className="prj-ws__nav-label">{s.label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`prj-ws__nav-btn prj-ws__nav-btn--search${searchVisible ? " is-active" : ""}`}
            data-section="globalSearch"
            aria-label="全局搜索"
            title="全局搜索"
            onClick={() => {
              setSearchVisible(value => !value);
              setSearchFocusSignal(value => value + 1);
            }}>
            <span className="prj-ws__nav-icon" aria-hidden="true">⌕</span>
            <span className="prj-ws__nav-label">全局搜索</span>
          </button>
        </nav>
        <div className={`prj-ws__head-search${searchVisible ? " is-open" : ""}`}>
          <ProjectManagementSearchBar
            projectId={project.id}
            onJump={selectSection}
            autoFocusSignal={searchFocusSignal}
          />
        </div>
      </header>

      <div className="prj-ws__main">
        <div className="prj-ws__body">
          {section === "description" && <ProjectDescriptionSection projectId={project.id} />}
          {section === "dictionary" && <DictionarySection project={project} summary={summary} />}
          {section === "automation" && <AutomationSection projectId={project.id} onOpenMapping={openDictionaryMapping} />}
          {section === "workflow" && <WorkflowSection project={project} summary={summary} />}
          {section === "scenarios" && <ScenariosSection project={project} summary={summary} />}
          {section === "environments" && <EnvironmentsSection project={project} summary={summary} />}
          {section === "deploymentSteps" && <ProjectDeploymentStepsSection project={project} summary={summary} />}
          {section === "monitoring" && <MonitoringSection project={project} summary={summary} />}
          {section === "codeVersions" && <CodeVersionsSection project={project} summary={summary} />}
          {section === "todos" && <TodosSection project={project} summary={summary} />}
          {section === "folder" && <FolderSection project={project} />}
        </div>
      </div>
    </div>
  );
}

function projectManagementWorkspaceSectionKey(projectId: string) {
  return `rich-project-management-section:${projectId}`;
}

function loadProjectManagementWorkspaceSection(projectId: string): ProjectManagementSection {
  if (typeof window === "undefined") return "dictionary";
  try {
    const saved = window.localStorage.getItem(projectManagementWorkspaceSectionKey(projectId));
    const valid = new Set(PROJECT_MANAGEMENT_SECTIONS.map(section => section.id));
    return saved && valid.has(saved as ProjectManagementSection) ? saved as ProjectManagementSection : "dictionary";
  } catch {
    return "dictionary";
  }
}

function saveProjectManagementWorkspaceSection(projectId: string, section: ProjectManagementSection) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(projectManagementWorkspaceSectionKey(projectId), section);
  } catch {
    // Workspace memory is a UI convenience; the current section still works without persistence.
  }
}

function saveDictionaryMappingTarget(projectId: string, tableId: string, systemId?: string) {
  if (typeof window === "undefined") return;
  try {
    const workspaceKey = `rich-project-dictionary-workspace:${projectId}`;
    const current = JSON.parse(window.localStorage.getItem(workspaceKey) ?? "{}") as Record<string, unknown>;
    const openTableTitleIds = Array.isArray(current.openTableTitleIds)
      ? current.openTableTitleIds.filter((id): id is string => typeof id === "string")
      : [];
    const expandedSystemIds = Array.isArray(current.expandedSystemIds)
      ? current.expandedSystemIds.filter((id): id is string => typeof id === "string")
      : [];
    window.localStorage.setItem(workspaceKey, JSON.stringify({
      ...current,
      selectedTableId: tableId,
      selectedSystemId: systemId || (typeof current.selectedSystemId === "string" ? current.selectedSystemId : ""),
      openTableTitleIds: Array.from(new Set([...openTableTitleIds, tableId])),
      expandedSystemIds: systemId ? Array.from(new Set([...expandedSystemIds, systemId])) : expandedSystemIds,
    }));
    const viewsKey = `rich-project-dictionary-table-views:${projectId}`;
    const views = JSON.parse(window.localStorage.getItem(viewsKey) ?? "{}") as Record<string, unknown>;
    window.localStorage.setItem(viewsKey, JSON.stringify({ ...views, [tableId]: "mapping" }));
  } catch {
    // Mapping navigation still switches to the dictionary when local UI memory is unavailable.
  }
}

// ── 概览 section ────────────────────────────────────────────────
function OverviewSection({ project }: { project: Element }) {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ProjectContent> & { title?: string }>({});

  const c = (project.content ?? {}) as ProjectContent;

  // 统计：直接子元 + 通过 child 关系递归（项目实战的 group 层这里不存在，直接子就够）
  const stats = useMemo(() => {
    const childIds = relations.filter(r => r.kind === "child" && r.from === project.id).map(r => r.to);
    const children = childIds.map(id => elements.get(id)).filter((e): e is Element => !!e);
    const todos = children.filter(c => c.type === "dev-task");
    const todosDone = todos.filter(t => t.status === "done").length;
    const todosDoing = todos.filter(t => t.status === "doing").length;
    const releases = children.filter(c => c.type === "version-release");
    const reports = children.filter(c => c.type === "report")
      .sort((a, b) => (b.metadata.updatedAt ?? "").localeCompare(a.metadata.updatedAt ?? ""));
    const envs = children.filter(c => c.type === "deployment-env");
    return {
      envs, envCount: envs.length,
      repoCount: children.filter(c => c.type === "repo").length,
      todoTotal: todos.length, todosDone, todosDoing,
      releases, releaseCount: releases.length,
      reports,
      faqCount: children.filter(c => c.type === "faq").length,
    };
  }, [project.id, elements, relations]);

  const latestRelease = stats.releases.length > 0
    ? [...stats.releases].sort((a, b) => {
        const aAt = (a.content as { releasedAt?: string })?.releasedAt ?? "";
        const bAt = (b.content as { releasedAt?: string })?.releasedAt ?? "";
        return bAt.localeCompare(aAt);
      })[0]
    : null;

  function startEdit() {
    setDraft({
      title: project.title,
      description: c.description ?? "",
      status: c.status ?? "active",
      owner: c.owner ?? "",
      localFolder: c.localFolder ?? "",
      startedAt: c.startedAt ?? "",
      launchedAt: c.launchedAt ?? "",
    });
    setEditing(true);
  }
  async function save() {
    const { title, ...contentPatch } = draft;
    try {
      // 合并旧 content + 新字段，保留 reportSchedule 等没编辑的字段
      const nextContent: ProjectContent = { ...c, ...contentPatch };
      // 清掉空字符串字段，避免数据库里塞一堆 ""
      for (const k of Object.keys(nextContent) as Array<keyof ProjectContent>) {
        if (nextContent[k] === "") delete (nextContent as Record<string, unknown>)[k];
      }
      await api.patchElement(project.id, {
        title: title?.trim() || project.title,
        content: nextContent,
      });
      await hydrate();
      setEditing(false);
    } catch (e) {
      window.alert(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="prj-overview">
      {/* 项目目录卡 —— 单独抽出来，因为 AI 整理 / 报告生成 / 部署步骤都依赖这个路径 */}
      <ProjectFolderCard project={project} />

      {/* 项目信息卡 */}
      <section className="prj-card-block">
        <header className="prj-card-block__head">
          <h3>项目信息</h3>
          {!editing && <button className="prj-btn-link" onClick={startEdit}>✎ 编辑</button>}
        </header>

        {!editing ? (
          <>
            {c.description && <p className="prj-overview__desc">{c.description}</p>}
            <dl className="prj-overview__meta">
              {c.owner && (<><dt>负责人</dt><dd>{c.owner}</dd></>)}
              {c.localFolder && (<><dt>本地目录</dt><dd><code>{c.localFolder}</code></dd></>)}
              {c.startedAt && (<><dt>启动日</dt><dd>{c.startedAt}</dd></>)}
              {c.launchedAt && (<><dt>上线日</dt><dd>{c.launchedAt}</dd></>)}
            </dl>
            {!c.description && !c.owner && !c.localFolder && (
              <div className="prj-empty-line">还没填项目信息。点「✎ 编辑」补完。</div>
            )}
          </>
        ) : (
          <div className="prj-form">
            <label><span>项目名</span>
              <input type="text" value={draft.title ?? ""}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
            </label>
            <label><span>状态</span>
              <select value={draft.status ?? "active"}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value as ProjectContent["status"] }))}>
                <option value="active">进行中</option>
                <option value="paused">暂停</option>
                <option value="archived">已归档</option>
              </select>
            </label>
            <label className="prj-form__wide"><span>项目简介</span>
              <textarea rows={3} value={draft.description ?? ""}
                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="一句话讲清楚这是什么项目 / 给谁用 / 当前阶段" />
            </label>
            <label><span>负责人</span>
              <input type="text" value={draft.owner ?? ""}
                onChange={e => setDraft(d => ({ ...d, owner: e.target.value }))} />
            </label>
            <label><span>本地目录</span>
              <input type="text" value={draft.localFolder ?? ""}
                onChange={e => setDraft(d => ({ ...d, localFolder: e.target.value }))}
                placeholder="/Users/.../Project/X" />
            </label>
            <label><span>启动日</span>
              <input type="date" value={draft.startedAt ?? ""}
                onChange={e => setDraft(d => ({ ...d, startedAt: e.target.value }))} />
            </label>
            <label><span>上线日</span>
              <input type="date" value={draft.launchedAt ?? ""}
                onChange={e => setDraft(d => ({ ...d, launchedAt: e.target.value }))} />
            </label>
            <div className="prj-form__actions prj-form__wide">
              <button className="prj-btn-link" onClick={() => setEditing(false)}>取消</button>
              <button className="prj-btn-primary" onClick={() => void save()}>保存</button>
            </div>
          </div>
        )}
      </section>

      {/* KPI 6 卡 */}
      <section className="prj-kpi-row">
        <KPI icon="🚀" label="部署环境" primary={`${stats.envCount}`}
          sub={stats.envs.length > 0 ? stats.envs.map(e => (e.content as { envName?: string })?.envName ?? "?").join(" / ") : "未配置"} />
        <KPI icon="🌿" label="代码仓库" primary={`${stats.repoCount}`}
          sub={stats.repoCount > 0 ? "已登记" : "未登记"} />
        <KPI icon="✅" label="待办" primary={`${stats.todosDone}/${stats.todoTotal}`}
          sub={stats.todosDoing > 0 ? `进行中 ${stats.todosDoing}` : stats.todoTotal === 0 ? "无待办" : `完成率 ${Math.round((stats.todosDone / stats.todoTotal) * 100)}%`} />
        <KPI icon="📦" label="发布版本" primary={latestRelease ? (latestRelease.content as { version?: string })?.version ?? "?" : "—"}
          sub={latestRelease ? `${stats.releaseCount} 次发布` : "还没发布"} />
        <KPI icon="💬" label="业务答疑" primary={`${stats.faqCount}`}
          sub={stats.faqCount > 0 ? "已沉淀" : "未沉淀"} />
        <KPI icon="📰" label="报告" primary={`${stats.reports.length}`}
          sub={stats.reports[0] ? `最近：${stats.reports[0].metadata.updatedAt.slice(0, 10)}` : "未生成"} />
      </section>

      {/* 最近报告 */}
      {stats.reports.length > 0 && (
        <section className="prj-card-block">
          <header className="prj-card-block__head">
            <h3>最近报告</h3>
          </header>
          <ul className="prj-recent-reports">
            {stats.reports.slice(0, 3).map(r => (
              <li key={r.id} className="prj-recent-report">
                <span className="prj-recent-report__title">{r.title}</span>
                <time>{r.metadata.updatedAt.slice(0, 10)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── 项目目录卡 ───────────────────────────────────────────────────
function ProjectFolderCard({ project }: { project: Element }) {
  const hydrate = useStore(s => s.hydrate);
  const c = (project.content ?? {}) as ProjectContent;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.localFolder ?? "");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  async function save() {
    const next = draft.trim();
    try {
      await api.patchElement(project.id, {
        content: { ...c, localFolder: next || undefined },
      });
      await hydrate();
      setEditing(false);
    } catch (e) {
      window.alert(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function copyPath() {
    if (!c.localFolder) return;
    try {
      await navigator.clipboard.writeText(c.localFolder);
      setCopyMsg("已复制");
      window.setTimeout(() => setCopyMsg(null), 1600);
    } catch {
      setCopyMsg("复制失败");
    }
  }

  function openInFinder() {
    if (!c.localFolder) return;
    // 在 Electron 主进程的 setWindowOpenHandler 里：file:// URL 走 shell.openExternal，
    // macOS 上等价于 Finder 打开。如果用户禁用了 window.open（很少），就回退到剪贴板。
    try {
      window.open(`file://${c.localFolder}`);
    } catch {
      void copyPath();
    }
  }

  return (
    <section className="prj-folder-card">
      <header className="prj-folder-card__head">
        <h3>📁 项目目录</h3>
        <span className="prj-folder-card__hint">
          AI 整理 / 自动写日报 / 部署步骤生成都用这个路径
        </span>
      </header>

      {!editing ? (
        c.localFolder ? (
          <div className="prj-folder-card__body">
            <code className="prj-folder-card__path" title={c.localFolder}>{c.localFolder}</code>
            <div className="prj-folder-card__actions">
              <button className="prj-btn-link" onClick={() => void copyPath()}>
                {copyMsg ?? "📋 复制"}
              </button>
              <button className="prj-btn-link" onClick={openInFinder}>🗂 在 Finder 打开</button>
              <button className="prj-btn-link" onClick={() => { setDraft(c.localFolder ?? ""); setEditing(true); }}>✎ 改</button>
            </div>
          </div>
        ) : (
          <div className="prj-folder-card__empty">
            <span>还没配置项目目录。</span>
            <button className="prj-btn-primary" onClick={() => { setDraft(""); setEditing(true); }}>
              + 配置
            </button>
          </div>
        )
      ) : (
        <div className="prj-folder-card__edit">
          <input type="text" autoFocus
            placeholder="/Users/你/Documents/项目目录"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setEditing(false);
            }} />
          <button className="prj-btn-primary" onClick={() => void save()}>保存</button>
          <button className="prj-btn-link" onClick={() => setEditing(false)}>取消</button>
        </div>
      )}
    </section>
  );
}

function KPI({ icon, label, primary, sub }: { icon: string; label: string; primary: string; sub: string }) {
  return (
    <div className="prj-kpi">
      <div className="prj-kpi__head">
        <span className="prj-kpi__icon">{icon}</span>
        <span className="prj-kpi__label">{label}</span>
      </div>
      <div className="prj-kpi__primary">{primary}</div>
      <div className="prj-kpi__sub">{sub}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//                    📁 文件夹 section
// ═══════════════════════════════════════════════════════════════
// 三块：
//   1. 绑定文件夹（路径未配时显示 CTA；已配时显示路径 + 改）
//   2. 扫描 & 树视图（fs.walk 当前目录，展示前 N 层）
//   3. 推荐目录模板（一键 mkdir 建立 00-启动 / 01-项目管理 / ... 这套结构）
//   ─ AI 整理（建议 + 移动）留下一批

const RECOMMENDED_STRUCTURE: Array<{ path: string; desc: string }> = [
  { path: "00-启动",                      desc: "SOW、启动会议、解决方案等合同前期文档" },
  { path: "01-项目管理",                  desc: "项目计划 / 日报 / 周报 / 会议纪要" },
  { path: "01-项目管理/日报",             desc: "" },
  { path: "01-项目管理/周报",             desc: "" },
  { path: "01-项目管理/发文",             desc: "对外发文、通知、函件及回执" },
  { path: "02-架构与分析",                desc: "需求范围、产品文档" },
  { path: "02-架构与分析/需求范围",       desc: "" },
  { path: "02-架构与分析/产品文档",       desc: "" },
  { path: "03-Mapping",                   desc: "数据映射模板（当前生效版本 + _archive 历史版本）" },
  { path: "03-Mapping/_archive",          desc: "" },
  { path: "04-环境与部署",                desc: "按环境分目录" },
  { path: "04-环境与部署/_docs",          desc: "" },
  { path: "04-环境与部署/dev",            desc: "" },
  { path: "04-环境与部署/staging",        desc: "" },
  { path: "04-环境与部署/prod",           desc: "" },
  { path: "04-环境与部署/升级步骤",       desc: "" },
  { path: "05-流程配置",                  desc: "" },
  { path: "05-流程配置/_archive",         desc: "" },
  { path: "06-版本管理",                  desc: "" },
  { path: "07-联调与测试",                desc: "" },
  { path: "07-联调与测试/SQL脚本",        desc: "" },
  { path: "07-联调与测试/测试数据",       desc: "测试文件、构造数据与测试结果" },
  { path: "08-培训与交付",                desc: "" },
  { path: "09-银行材料",                  desc: "银行提供的规范、模板、样例及往来材料" },
  { path: "99-未分类",                    desc: "暂无法归类的文件先放这里，后续再整理" },
];

type ProjectContentWithFolderScan = ProjectContent & {
  lastFolderScan?: ProjectFolderScanResult;
};
type ServerRole = "front" | "app" | "database" | "vip" | "router";
type CredentialKind = "ssh" | "db" | "web" | "api" | "other";
type FirewallStatus = "open" | "pending" | "blocked" | "unknown";

const SERVER_ROLE_OPTIONS: Array<{ value: ServerRole; label: string }> = [
  { value: "front", label: "前置机" },
  { value: "app", label: "应用服务器" },
  { value: "database", label: "数据库" },
  { value: "vip", label: "虚拟VIP" },
  { value: "router", label: "路由" },
];
const CREDENTIAL_KIND_OPTIONS: Array<{ value: CredentialKind; label: string }> = [
  { value: "ssh", label: "SSH" },
  { value: "db", label: "数据库" },
  { value: "web", label: "Web" },
  { value: "api", label: "API" },
  { value: "other", label: "其他" },
];
const FIREWALL_OPTIONS: Array<{ value: FirewallStatus; label: string }> = [
  { value: "unknown", label: "未确认" },
  { value: "open", label: "已放通" },
  { value: "pending", label: "申请中" },
  { value: "blocked", label: "被拦截" },
];

function serverRoleLabel(role: string | undefined): string {
  return SERVER_ROLE_OPTIONS.find(o => o.value === role)?.label ?? "未设置";
}

function isProjectFolderScanResult(value: unknown): value is ProjectFolderScanResult {
  if (!value || typeof value !== "object") return false;
  const scan = value as Partial<ProjectFolderScanResult>;
  return typeof scan.rootPath === "string"
    && typeof scan.scannedAt === "string"
    && typeof scan.totalFiles === "number"
    && typeof scan.totalDirs === "number"
    && typeof scan.totalSize === "number"
    && Array.isArray(scan.extStats)
    && !!scan.root
    && typeof scan.root === "object";
}

function savedFolderScan(content: ProjectContent, folder: string): ProjectFolderScanResult | null {
  const scan = (content as ProjectContentWithFolderScan).lastFolderScan;
  if (!isProjectFolderScanResult(scan)) return null;
  if (!folder || scan.rootPath !== folder) return null;
  return scan;
}

function FolderSection({ project }: { project: Element }) {
  const hydrate = useStore(s => s.hydrate);
  const c = (project.content ?? {}) as ProjectContentWithFolderScan;
  const folder = c.localFolder ?? "";

  const [bindEditing, setBindEditing] = useState(false);
  const [bindDraft, setBindDraft] = useState(folder);

  const [scan, setScan] = useState<ProjectFolderScanResult | null>(() => savedFolderScan(c, folder));
  const [scanBusy, setScanBusy] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);

  const [creatingDirs, setCreatingDirs] = useState(false);
  const [createResult, setCreateResult] = useState<string | null>(null);

  const [selectedDirs, setSelectedDirs] = useState<Set<string>>(
    new Set(RECOMMENDED_STRUCTURE.map(s => s.path)),
  );

  useEffect(() => {
    setBindDraft(folder);
    setScan(savedFolderScan(c, folder));
    setScanErr(null);
  }, [project.id, folder, c.lastFolderScan]);

  async function saveBind() {
    const next = bindDraft.trim();
    try {
      const nextContent: ProjectContentWithFolderScan = { ...c, localFolder: next || undefined };
      if (next !== folder) delete nextContent.lastFolderScan;
      await api.patchElement(project.id, {
        content: nextContent,
      });
      await hydrate();
      setBindEditing(false);
    } catch (e) {
      window.alert(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function runScan() {
    if (!folder) return;
    setScanBusy(true); setScanErr(null);
    try {
      const result = await api.scanProjectFolder(project.id, 4);
      setScan(result);
      await api.patchElement(project.id, {
        content: { ...c, lastFolderScan: result },
      });
      await hydrate();
    } catch (e) {
      setScanErr(e instanceof Error ? e.message : String(e));
    } finally {
      setScanBusy(false);
    }
  }

  function toggleDir(p: string) {
    setSelectedDirs(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  async function createSelected() {
    if (!folder) return;
    const paths = Array.from(selectedDirs);
    if (paths.length === 0) {
      window.alert("请至少选一个目录");
      return;
    }
    if (!window.confirm(`将在 ${folder} 下创建 ${paths.length} 个目录（已存在的会跳过）。继续？`)) return;
    setCreatingDirs(true); setCreateResult(null);
    try {
      const r = await api.mkdirsInProjectFolder(project.id, paths);
      setCreateResult(`✓ 已建 ${r.created.length} 个目录；跳过 ${r.skipped.length} 个${r.skipped.length > 0 ? `（${r.skipped.map(s => s.path).slice(0, 3).join(", ")}…）` : ""}`);
      // 建完自动重扫一次
      void runScan();
    } catch (e) {
      setCreateResult(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreatingDirs(false);
    }
  }

  return (
    <div className="prj-folder-section">
      {/* —— 1. 绑定 —— */}
      <section className="prj-folder-section__bind">
        <header>
          <h3>📁 绑定项目目录</h3>
        </header>
        {!bindEditing ? (
          folder ? (
            <div className="prj-folder-section__bind-row">
              <code>{folder}</code>
              <button className="prj-btn-link" onClick={() => { setBindDraft(folder); setBindEditing(true); }}>✎ 改路径</button>
            </div>
          ) : (
            <div className="prj-folder-section__bind-empty">
              <span>这个项目还没绑定本地目录。绑定后才能扫描 / 建结构 / AI 整理。</span>
              <button className="prj-btn-primary" onClick={() => { setBindDraft(""); setBindEditing(true); }}>+ 绑定文件夹</button>
            </div>
          )
        ) : (
          <div className="prj-folder-section__bind-edit">
            <input type="text" autoFocus
              placeholder="/Users/你/Documents/项目目录"
              value={bindDraft}
              onChange={e => setBindDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") void saveBind();
                if (e.key === "Escape") setBindEditing(false);
              }} />
            <button className="prj-btn-primary" onClick={() => void saveBind()}>保存</button>
            <button className="prj-btn-link" onClick={() => setBindEditing(false)}>取消</button>
          </div>
        )}
      </section>

      {/* —— 2. 当前目录扫描 —— */}
      <section className="prj-folder-section__scan">
        <header className="prj-folder-section__row-head">
          <h3>🔍 当前结构</h3>
          <div>
            <button className="prj-btn-primary" disabled={!folder || scanBusy} onClick={() => void runScan()}>
              {scanBusy ? "扫描中…" : scan ? "刷新结构" : "扫描"}
            </button>
          </div>
        </header>
        {!folder && <div className="prj-folder-section__empty">先绑定项目目录</div>}
        {scanErr && <div className="prj-folder-section__err">⚠ {scanErr}</div>}
        {folder && !scan && !scanBusy && !scanErr && (
          <div className="prj-folder-section__empty">还没有扫描记录，点右上角「扫描」后会自动记住。</div>
        )}
        {scan && (
          <>
            <div className="prj-folder-section__stats">
              <span>📁 {scan.totalDirs} 目录</span>
              <span>📄 {scan.totalFiles} 文件</span>
              <span>💾 {formatBytes(scan.totalSize)}</span>
              {scan.warnings.length > 0 && <span className="prj-folder-section__warn">⚠ {scan.warnings.length} 警告</span>}
              <span className="prj-folder-section__time">扫于 {new Date(scan.scannedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="prj-folder-section__tree">
              <FolderTree node={scan.root} depth={0} />
            </div>
            {scan.extStats.length > 0 && (
              <div className="prj-folder-section__ext-stats">
                <span>文件类型 Top {scan.extStats.length}：</span>
                {scan.extStats.map(s => (
                  <span key={s.ext} className="prj-folder-section__ext-chip">
                    {s.ext} <strong>{s.count}</strong>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* —— 3. 推荐结构 —— */}
      <section className="prj-folder-section__template">
        <header className="prj-folder-section__row-head">
          <h3>🪜 推荐目录结构</h3>
          <div className="prj-folder-section__template-actions">
            <span className="prj-folder-section__hint">勾选要建的目录，已存在的会跳过</span>
            <button className="prj-btn-link" onClick={() => setSelectedDirs(new Set(RECOMMENDED_STRUCTURE.map(s => s.path)))}>全选</button>
            <button className="prj-btn-link" onClick={() => setSelectedDirs(new Set())}>清空</button>
            <button className="prj-btn-primary"
              disabled={!folder || creatingDirs || selectedDirs.size === 0}
              onClick={() => void createSelected()}>
              {creatingDirs ? "创建中…" : `创建选中 (${selectedDirs.size})`}
            </button>
          </div>
        </header>
        {createResult && <div className="prj-folder-section__create-result">{createResult}</div>}
        <ul className="prj-folder-section__template-list">
          {RECOMMENDED_STRUCTURE.map(item => {
            const depth = item.path.split("/").length - 1;
            const checked = selectedDirs.has(item.path);
            return (
              <li key={item.path}
                className={`prj-folder-section__template-row${checked ? " is-checked" : ""}`}
                style={{ paddingLeft: `${depth * 18 + 6}px` }}>
                <label>
                  <input type="checkbox" checked={checked} onChange={() => toggleDir(item.path)} />
                  <span className="prj-folder-section__template-name">{item.path.split("/").pop()}</span>
                  {item.desc && <span className="prj-folder-section__template-desc">— {item.desc}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {/* —— 4. AI 整理（下一批） —— */}
      <section className="prj-folder-section__ai">
        <h3>🤖 AI 整理 <span className="prj-folder-section__hint">下一批接入</span></h3>
        <p>扫描当前结构 → AI 分析问题 → 给出 dry-run 重组方案 → 你确认后一键 mv。</p>
        <button className="prj-btn-link" disabled>⏳ 待接入</button>
      </section>
    </div>
  );
}

function FolderTree({ node, depth }: { node: ProjectFolderNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);   // 默认展开根 + 一级
  const isDir = node.kind === "dir";
  return (
    <div className="prj-tree-node">
      <div className="prj-tree-row" style={{ paddingLeft: `${depth * 18 + 4}px` }}>
        {isDir ? (
          <button
            className="prj-tree-toggle"
            onClick={() => setOpen(o => !o)}
            disabled={(node.children?.length ?? 0) === 0}
          >{(node.children?.length ?? 0) === 0 ? "·" : open ? "▾" : "▸"}</button>
        ) : (
          <span className="prj-tree-toggle prj-tree-toggle--leaf">·</span>
        )}
        <span className={`prj-tree-name prj-tree-name--${node.kind}`}>
          {isDir ? "📁" : extIcon(node.ext)} {node.name || "(根目录)"}
        </span>
        <span className="prj-tree-meta">
          {isDir
            ? `${node.children?.length ?? 0} 项 · ${formatBytes(node.size)}`
            : formatBytes(node.size)}
        </span>
        {node.truncated && <span className="prj-tree-truncated">(已截断)</span>}
      </div>
      {isDir && open && node.children && (
        <div>
          {node.children.map(c => <FolderTree key={c.path} node={c} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

function extIcon(ext: string | undefined): string {
  switch (ext) {
    case ".md":   return "📝";
    case ".pdf":  return "📕";
    case ".doc": case ".docx": return "📘";
    case ".xls": case ".xlsx": return "📗";
    case ".ppt": case ".pptx": return "📙";
    case ".sql":  return "🗃";
    case ".html": return "🌐";
    case ".png": case ".jpg": case ".jpeg": case ".gif": case ".webp": return "🖼";
    case ".zip": case ".tar": case ".gz": return "📦";
    default: return "📄";
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ═══════════════════════════════════════════════════════════════
//                    🚀 部署 section
// ═══════════════════════════════════════════════════════════════
// 数据布局：
//   project
//     └─ deployment-env (SIT / UAT / PRE-PROD / PROD ...)
//         ├─ group "前置机集群" / "可信区-应用集群" / ...    ← 模块容器
//         │   ├─ server  (IP / port / hostname / OS / notes)
//         │   │   └─ credential                              ← 凭证挂服务器下
//         │   └─ ...
//         └─ connection (fromServerId / toServerId / port / firewall) ← 跨服务器关系
// UI:
//   ─ 环境 tab 横排（PROD / UAT / ...）+ "+ 新环境"
//   ─ 选中环境后：模块分组卡片墙 (每个模块一个外框，内含服务器卡)
//   ─ 点服务器卡 → 右侧 drawer：详情 + 凭证 mask/toggle + 涉及它的连接列表
//   ─ 底部：本环境所有服务器一张表（IP/端口/模块/组件）

const ENV_NAME_LABELS: Record<string, { label: string; tone: string }> = {
  prod:     { label: "PROD 生产",      tone: "danger" },
  staging:  { label: "STAGING 预发",   tone: "warn" },
  "pre-prod": { label: "PRE-PROD",    tone: "warn" },
  uat:      { label: "UAT 验收",       tone: "info" },
  sit:      { label: "SIT 集成测试",   tone: "info" },
  dev:      { label: "DEV 开发",       tone: "neutral" },
};

function envLabel(envName: string): { label: string; tone: string } {
  const key = envName.toLowerCase();
  return ENV_NAME_LABELS[key] ?? { label: envName, tone: "neutral" };
}

function DeploySection({ project }: { project: Element }) {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);

  // 项目下的所有 deployment-env
  const envs = useMemo(() => {
    const childIds = relations
      .filter(r => r.kind === "child" && r.from === project.id)
      .map(r => r.to);
    return childIds
      .map(id => elements.get(id))
      .filter((e): e is Element => !!e && e.type === "deployment-env")
      .sort((a, b) => {
        // PROD 在最右（最近生产），DEV 在最左
        const orderOf = (n: string) => {
          const k = n.toLowerCase();
          if (k === "dev") return 0;
          if (k === "sit") return 1;
          if (k === "uat") return 2;
          if (k === "staging" || k === "pre-prod") return 3;
          if (k === "prod") return 4;
          return 5;
        };
        const an = (a.content as { envName?: string })?.envName ?? "";
        const bn = (b.content as { envName?: string })?.envName ?? "";
        return orderOf(an) - orderOf(bn);
      });
  }, [project.id, elements, relations]);

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const activeEnvId = selectedEnvId && envs.some(e => e.id === selectedEnvId)
    ? selectedEnvId
    : envs[0]?.id ?? null;
  const activeEnv = activeEnvId ? elements.get(activeEnvId) : null;

  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [addingEnv, setAddingEnv] = useState(false);
  const [envDraft, setEnvDraft] = useState("");
  const [envBusy, setEnvBusy] = useState(false);

  async function createEnv() {
    const name = envDraft.trim().toLowerCase();
    if (!name) return;
    setEnvBusy(true);
    try {
      const r = await api.createElement({
        title: name.toUpperCase(),
        type: "deployment-env",
        parentId: project.id,
      });
      await api.patchElement(r.element.id, {
        content: { envName: name.toLowerCase() },
      });
      await hydrate();
      setSelectedEnvId(r.element.id);
      setEnvDraft("");
      setAddingEnv(false);
    } catch (e) {
      window.alert(`创建失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEnvBusy(false);
    }
  }

  function cancelCreateEnv() {
    setAddingEnv(false);
    setEnvDraft("");
  }

  const envCreateForm = (
    <div className="prj-deploy__env-add-form">
      <input
        type="text"
        autoFocus
        placeholder="环境名，如 prod / uat / sit"
        value={envDraft}
        onChange={e => setEnvDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") void createEnv();
          if (e.key === "Escape") cancelCreateEnv();
        }}
      />
      <button type="button" className="prj-btn-primary" disabled={envBusy || !envDraft.trim()} onClick={() => void createEnv()}>
        {envBusy ? "保存中…" : "保存"}
      </button>
      <button type="button" className="prj-btn-link" onClick={cancelCreateEnv}>取消</button>
    </div>
  );

  if (envs.length === 0) {
    return (
      <div className="prj-deploy">
        <div className="prj-deploy__empty">
          <h3>还没有部署环境</h3>
          <p>新建一个环境（PROD / UAT / SIT ...），然后在里面挂模块和服务器。</p>
          {!addingEnv ? (
            <button className="prj-btn-primary" onClick={() => setAddingEnv(true)}>+ 新建环境</button>
          ) : envCreateForm}
        </div>
      </div>
    );
  }

  return (
    <div className="prj-deploy">
      {/* 环境 tab */}
      <nav className="prj-deploy__envs" role="tablist">
        {envs.map(env => {
          const en = (env.content as { envName?: string })?.envName ?? env.title;
          const { label, tone } = envLabel(en);
          return (
            <button key={env.id} type="button" role="tab"
              aria-selected={env.id === activeEnvId}
              className={`prj-deploy__env-tab prj-deploy__env-tab--${tone}${env.id === activeEnvId ? " is-active" : ""}`}
              onClick={() => setSelectedEnvId(env.id)}>
              {label}
            </button>
          );
        })}
        {!addingEnv ? (
          <button type="button" className="prj-deploy__env-add" onClick={() => setAddingEnv(true)}>
            + 新环境
          </button>
        ) : envCreateForm}
      </nav>

      {/* 当前环境主体 */}
      {activeEnv && (
        <EnvBody env={activeEnv} onPickServer={setSelectedServerId} project={project} />
      )}

      {/* 服务器详情 drawer */}
      {selectedServerId && (
        <ServerDrawer
          serverId={selectedServerId}
          envId={activeEnvId!}
          onClose={() => setSelectedServerId(null)}
        />
      )}
    </div>
  );
}

function deployStepContent(element: Element): DeploymentStepContent {
  const c = (element.content ?? {}) as Partial<DeploymentStepContent>;
  return {
    environment: c.environment?.trim() || "通用",
    version: c.version?.trim() || "v1.0",
    phase: c.phase?.trim() || element.title,
    target: c.target,
    source: c.source,
    steps: Array.isArray(c.steps) ? c.steps : [],
    checklist: Array.isArray(c.checklist) ? c.checklist : [],
    importedAt: c.importedAt,
  };
}

function DeployStepsSection({ project }: { project: Element }) {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);
  const [selectedEnv, setSelectedEnv] = useState<string>("");
  const [selectedVersion, setSelectedVersion] = useState<string>("");

  const deploymentSteps = useMemo(() => {
    const childIds = relations.filter(r => r.kind === "child" && r.from === project.id).map(r => r.to);
    return childIds
      .map(id => elements.get(id))
      .filter((e): e is Element => !!e && e.type === "deployment-step")
      .sort((a, b) => {
        const ac = deployStepContent(a);
        const bc = deployStepContent(b);
        return `${ac.environment}|${ac.version}|${ac.phase}|${a.title}`.localeCompare(`${bc.environment}|${bc.version}|${bc.phase}|${b.title}`, "zh-Hans-CN");
      });
  }, [project.id, elements, relations]);

  const environments = useMemo(() => {
    return Array.from(new Set(deploymentSteps.map(step => deployStepContent(step).environment)));
  }, [deploymentSteps]);
  const activeEnv = selectedEnv && environments.includes(selectedEnv) ? selectedEnv : environments[0] ?? "";
  const versions = useMemo(() => {
    return Array.from(new Set(deploymentSteps
      .filter(step => deployStepContent(step).environment === activeEnv)
      .map(step => deployStepContent(step).version)));
  }, [activeEnv, deploymentSteps]);
  const activeVersion = selectedVersion && versions.includes(selectedVersion) ? selectedVersion : versions[0] ?? "";
  const visibleSteps = useMemo(() => deploymentSteps.filter(step => {
    const c = deployStepContent(step);
    return c.environment === activeEnv && c.version === activeVersion;
  }), [activeEnv, activeVersion, deploymentSteps]);

  const totals = useMemo(() => {
    let checkTotal = 0;
    let checkDone = 0;
    let commandTotal = 0;
    for (const step of visibleSteps) {
      const c = deployStepContent(step);
      checkTotal += c.checklist.length;
      checkDone += c.checklist.filter(item => item.done).length;
      commandTotal += c.steps.length;
    }
    return { checkTotal, checkDone, commandTotal };
  }, [visibleSteps]);

  async function toggleChecklist(step: Element, itemId: string) {
    const c = deployStepContent(step);
    const next: DeploymentStepContent = {
      ...c,
      checklist: c.checklist.map(item => item.id === itemId ? { ...item, done: !item.done } : item),
    };
    await api.patchElement(step.id, { content: next });
    await hydrate();
  }

  if (deploymentSteps.length === 0) {
    return (
      <div className="prj-deploy-steps">
        <div className="prj-deploy__empty">
          <h3>还没有部署步骤</h3>
          <p>这里会按环境和版本沉淀每次部署 checklist。环境服务器信息在“环境配置”里维护。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prj-deploy-steps">
      <header className="prj-deploy-steps__head">
        <div>
          <h3>部署步骤</h3>
          <p>按环境和版本拆分；每次部署先勾 checklist，再按步骤执行和验收。</p>
        </div>
        <div className="prj-deploy-steps__stats">
          <span>{visibleSteps.length} 阶段</span>
          <span>{totals.commandTotal} 步骤</span>
          <span>{totals.checkDone}/{totals.checkTotal} Check</span>
        </div>
      </header>

      <nav className="prj-deploy__envs" role="tablist" aria-label="部署环境">
        {environments.map(env => (
          <button key={env} type="button" role="tab"
            aria-selected={env === activeEnv}
            className={`prj-deploy__env-tab${env === activeEnv ? " is-active" : ""}`}
            onClick={() => { setSelectedEnv(env); setSelectedVersion(""); }}>
            {env}
          </button>
        ))}
      </nav>

      <nav className="prj-deploy-steps__versions" role="tablist" aria-label="部署版本">
        {versions.map(version => (
          <button key={version} type="button" role="tab"
            aria-selected={version === activeVersion}
            className={`prj-deploy-steps__version${version === activeVersion ? " is-active" : ""}`}
            onClick={() => setSelectedVersion(version)}>
            {version}
          </button>
        ))}
      </nav>

      <section className="prj-deploy-steps__grid">
        {visibleSteps.map(step => {
          const c = deployStepContent(step);
          const done = c.checklist.filter(item => item.done).length;
          return (
            <article key={step.id} className="prj-deploy-step-card">
              <header className="prj-deploy-step-card__head">
                <div>
                  <h4>{c.phase || step.title}</h4>
                  <p>{c.target || step.subtitle || "通用部署阶段"}</p>
                </div>
                <span>{done}/{c.checklist.length}</span>
              </header>
              {c.source && <div className="prj-deploy-step-card__source">来源：{c.source}</div>}

              <div className="prj-deploy-step-card__checks">
                {c.checklist.map(item => (
                  <label key={item.id} className={item.done ? "is-done" : ""}>
                    <input
                      type="checkbox"
                      checked={!!item.done}
                      onChange={() => void toggleChecklist(step, item.id)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <details className="prj-deploy-step-card__details">
                <summary>查看执行步骤 · {c.steps.length} 项</summary>
                <ol>
                  {c.steps.map(item => (
                    <li key={`${step.id}-${item.n}`}>
                      <div className="prj-deploy-step-card__line">
                        {item.actor && <span>{item.actor}</span>}
                        <strong>{item.action}</strong>
                      </div>
                      {item.command && <pre>{item.command}</pre>}
                      {item.check && <p>检查：{item.check}</p>}
                      {item.notes && <p>备注：{item.notes}</p>}
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          );
        })}
      </section>
    </div>
  );
}

// ── 单环境主体 ──────────────────────────────────────────────────
function EnvBody({ env, onPickServer, project: _project }: {
  env: Element; onPickServer: (id: string) => void; project: Element;
}) {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);
  const c = (env.content ?? {}) as { envName?: string; description?: string; publicUrl?: string; attention?: string };
  const [view, setView] = useState<"cards" | "topology">("cards");
  const [addingModule, setAddingModule] = useState(false);
  const [moduleDraft, setModuleDraft] = useState("");
  const [moduleSubtitleDraft, setModuleSubtitleDraft] = useState("");
  const [moduleBusy, setModuleBusy] = useState(false);

  // 模块 (group) 列表
  const modules = useMemo(() => {
    const childIds = relations.filter(r => r.kind === "child" && r.from === env.id).map(r => r.to);
    return childIds
      .map(id => elements.get(id))
      .filter((e): e is Element => !!e && e.type === "group");
  }, [env.id, elements, relations]);

  // 所有服务器 = 模块的子元，type=server
  const allServers = useMemo(() => {
    const out: Array<{ server: Element; module: Element }> = [];
    for (const m of modules) {
      const sChildIds = relations.filter(r => r.kind === "child" && r.from === m.id).map(r => r.to);
      for (const id of sChildIds) {
        const s = elements.get(id);
        if (s && s.type === "server") out.push({ server: s, module: m });
      }
    }
    return out;
  }, [modules, elements, relations]);

  // 环境下所有 connection
  const connections = useMemo(() => {
    const childIds = relations.filter(r => r.kind === "child" && r.from === env.id).map(r => r.to);
    return childIds
      .map(id => elements.get(id))
      .filter((e): e is Element => !!e && e.type === "connection");
  }, [env.id, elements, relations]);

  async function addModule() {
    const name = moduleDraft.trim();
    if (!name) return;
    setModuleBusy(true);
    try {
      await api.createElement({ title: name, subtitle: moduleSubtitleDraft.trim() || undefined, type: "group", parentId: env.id });
      await hydrate();
      setModuleDraft("");
      setModuleSubtitleDraft("");
      setAddingModule(false);
    } catch (e) {
      window.alert(`失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setModuleBusy(false);
    }
  }

  async function addServer(moduleId: string, title: string, ip: string, serverRole: ServerRole) {
    try {
      const r = await api.createElement({ title, type: "server", parentId: moduleId });
      await api.patchElement(r.element.id, { content: { ip, serverRole } });
      await hydrate();
    } catch (e) {
      window.alert(`失败: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }

  return (
    <>
      {/* 环境信息 banner */}
      <section className="prj-deploy__env-banner">
        <div>
          {c.description && <p className="prj-deploy__env-desc">{c.description}</p>}
          {c.publicUrl && <p>公网入口: <code>{c.publicUrl}</code></p>}
          {c.attention && (
            <details className="prj-deploy__env-attention">
              <summary>⚠ 部署注意事项</summary>
              <pre>{c.attention}</pre>
            </details>
          )}
        </div>
        <div className="prj-deploy__env-stats">
          <span>📦 {modules.length} 模块</span>
          <span>🖥 {allServers.length} 服务器</span>
          <span>🔗 {connections.length} 连接</span>
        </div>
      </section>

      {/* 视图切换 */}
      <div className="prj-deploy__view-toggle" role="tablist">
        <button type="button" role="tab" aria-selected={view === "cards"}
          className={`prj-deploy__view-tab${view === "cards" ? " is-active" : ""}`}
          onClick={() => setView("cards")}>📊 卡片视图</button>
        <button type="button" role="tab" aria-selected={view === "topology"}
          className={`prj-deploy__view-tab${view === "topology" ? " is-active" : ""}`}
          onClick={() => setView("topology")}>🗺 拓扑视图</button>
      </div>

      {view === "cards" && (
        <>
          {/* 模块网格 */}
          <section className="prj-deploy__modules">
            {modules.map(m => {
              const moduleServers = allServers.filter(s => s.module.id === m.id).map(s => s.server);
              return (
                <ModuleCard key={m.id} module={m} servers={moduleServers}
                  onPickServer={onPickServer}
                  onAddServer={(title, ip, serverRole) => addServer(m.id, title, ip, serverRole)} />
              );
            })}
            {!addingModule ? (
              <button type="button" className="prj-deploy__module-add" onClick={() => setAddingModule(true)}>
                + 新模块
              </button>
            ) : (
              <div className="prj-deploy__module-add-form">
                <input
                  type="text"
                  autoFocus
                  placeholder="模块名（例：前置机集群）"
                  value={moduleDraft}
                  onChange={e => setModuleDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") void addModule();
                    if (e.key === "Escape") { setAddingModule(false); setModuleDraft(""); setModuleSubtitleDraft(""); }
                  }}
                />
                <input
                  type="text"
                  placeholder="备注（例：Nginx + keepalived）"
                  value={moduleSubtitleDraft}
                  onChange={e => setModuleSubtitleDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") void addModule();
                    if (e.key === "Escape") { setAddingModule(false); setModuleDraft(""); setModuleSubtitleDraft(""); }
                  }}
                />
                <div>
                  <button type="button" className="prj-btn-primary" disabled={moduleBusy || !moduleDraft.trim()} onClick={() => void addModule()}>
                    {moduleBusy ? "保存中…" : "保存"}
                  </button>
                  <button type="button" className="prj-btn-link" onClick={() => { setAddingModule(false); setModuleDraft(""); setModuleSubtitleDraft(""); }}>取消</button>
                </div>
              </div>
            )}
          </section>

          {/* 服务器全表 */}
          <ServersTable env={env} servers={allServers} onPick={onPickServer} />
        </>
      )}

      {view === "topology" && (
        <TopologyCanvas
          envId={env.id}
          modules={modules}
          servers={allServers}
          connections={connections}
          onPickServer={onPickServer}
          onReload={() => void hydrate()}
        />
      )}
    </>
  );
}

function ModuleCard({ module, servers, onPickServer, onAddServer }: {
  module: Element; servers: Element[]; onPickServer: (id: string) => void; onAddServer: (title: string, ip: string, serverRole: ServerRole) => Promise<void>;
}) {
  const hydrate = useStore(s => s.hydrate);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [ip, setIp] = useState("");
  const [serverRole, setServerRole] = useState<ServerRole>("app");
  const [busy, setBusy] = useState(false);
  const [editingField, setEditingField] = useState<"title" | "subtitle" | null>(null);
  const [moduleTitleDraft, setModuleTitleDraft] = useState(module.title);
  const [moduleSubtitleDraft, setModuleSubtitleDraft] = useState(module.subtitle ?? "");

  useEffect(() => {
    if (editingField) return;
    setModuleTitleDraft(module.title);
    setModuleSubtitleDraft(module.subtitle ?? "");
  }, [editingField, module.title, module.subtitle]);

  async function saveServer() {
    const nextTitle = title.trim();
    const nextIp = ip.trim();
    if (!nextTitle || !nextIp) return;
    setBusy(true);
    try {
      await onAddServer(nextTitle, nextIp, serverRole);
      setTitle("");
      setIp("");
      setServerRole("app");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  async function saveModuleField(field: "title" | "subtitle") {
    const nextTitle = moduleTitleDraft.trim();
    const nextSubtitle = moduleSubtitleDraft.trim();
    if (field === "title" && !nextTitle) {
      setModuleTitleDraft(module.title);
      setEditingField(null);
      return;
    }
    if (nextTitle === module.title && nextSubtitle === (module.subtitle ?? "")) {
      setEditingField(null);
      return;
    }
    try {
      await api.patchElement(module.id, {
        title: nextTitle || module.title,
        subtitle: nextSubtitle || undefined,
      });
      await hydrate();
    } catch (e) {
      window.alert(`保存模块失败: ${e instanceof Error ? e.message : String(e)}`);
      setModuleTitleDraft(module.title);
      setModuleSubtitleDraft(module.subtitle ?? "");
    } finally {
      setEditingField(null);
    }
  }

  return (
    <div className="prj-deploy__module">
      <header className="prj-deploy__module-head">
        <div className="prj-deploy__module-titlebox">
          {editingField === "title" ? (
            <input
              className="prj-deploy__module-edit"
              autoFocus
              value={moduleTitleDraft}
              onChange={e => setModuleTitleDraft(e.target.value)}
              onBlur={() => void saveModuleField("title")}
              onKeyDown={e => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") { setModuleTitleDraft(module.title); setEditingField(null); }
              }}
            />
          ) : (
            <strong onDoubleClick={() => setEditingField("title")} title="双击编辑名称">{module.title}</strong>
          )}
          {editingField === "subtitle" ? (
            <input
              className="prj-deploy__module-edit prj-deploy__module-edit--sub"
              autoFocus
              value={moduleSubtitleDraft}
              onChange={e => setModuleSubtitleDraft(e.target.value)}
              onBlur={() => void saveModuleField("subtitle")}
              onKeyDown={e => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") { setModuleSubtitleDraft(module.subtitle ?? ""); setEditingField(null); }
              }}
            />
          ) : (
            <span className={`prj-deploy__module-sub${module.subtitle ? "" : " is-empty"}`} onDoubleClick={() => setEditingField("subtitle")} title="双击编辑备注">
              {module.subtitle || "双击添加备注"}
            </span>
          )}
        </div>
        <span className="prj-deploy__module-count">{servers.length}</span>
      </header>
      <div className="prj-deploy__server-grid">
        {servers.map(s => <ServerCard key={s.id} server={s} onClick={() => onPickServer(s.id)} />)}
        {!adding ? (
          <button type="button" className="prj-deploy__server-add" onClick={() => setAdding(true)}>+ 服务器</button>
        ) : (
          <div className="prj-deploy__server-add-form">
            <input
              type="text"
              autoFocus
              placeholder="服务器名"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") { setAdding(false); setTitle(""); setIp(""); }
              }}
            />
            <input
              type="text"
              placeholder="IP 地址"
              value={ip}
              onChange={e => setIp(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") void saveServer();
                if (e.key === "Escape") { setAdding(false); setTitle(""); setIp(""); }
              }}
            />
            <select
              value={serverRole}
              onChange={e => setServerRole(e.target.value as ServerRole)}
              aria-label="服务器属性"
            >
              {SERVER_ROLE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div>
              <button type="button" className="prj-btn-primary" disabled={busy || !title.trim() || !ip.trim()} onClick={() => void saveServer()}>
                {busy ? "保存中…" : "保存"}
              </button>
              <button type="button" className="prj-btn-link" onClick={() => { setAdding(false); setTitle(""); setIp(""); setServerRole("app"); }}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ServerCard({ server, onClick }: { server: Element; onClick: () => void }) {
  const c = (server.content ?? {}) as { ip?: string; port?: number; hostname?: string; notes?: string; serverRole?: string };
  return (
    <button type="button" className="prj-deploy__server" onClick={onClick} title={c.notes}>
      <span className="prj-deploy__server-title-row">
        <span className="prj-deploy__server-name">{server.title}</span>
        <span className={`prj-deploy__server-role prj-deploy__server-role--${c.serverRole ?? "unset"}`}>
          {serverRoleLabel(c.serverRole)}
        </span>
      </span>
      <code className="prj-deploy__server-ip">{c.ip ?? "—"}{c.port ? `:${c.port}` : ""}</code>
      {c.hostname && <span className="prj-deploy__server-host">{c.hostname}</span>}
    </button>
  );
}

// ── 服务器详情 drawer ───────────────────────────────────────────
function ServerDrawer({ serverId, envId, onClose }: {
  serverId: string; envId: string; onClose: () => void;
}) {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const hydrate = useStore(s => s.hydrate);
  const server = elements.get(serverId);
  const c = (server?.content ?? {}) as {
    ip?: string; serverRole?: ServerRole; port?: number; hostname?: string; os?: string; region?: string; notes?: string;
  };
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    ip: "",
    port: "",
    hostname: "",
    os: "",
    region: "",
    notes: "",
    serverRole: "app" as ServerRole,
    moduleId: "",
  });
  const [addingCredential, setAddingCredential] = useState(false);
  const [addingConnection, setAddingConnection] = useState(false);

  // 当前 server 的 parent module + 同环境下所有 module
  const currentParentId = useMemo(() => {
    const r = relations.find(r => r.kind === "child" && r.to === serverId);
    return r?.from ?? null;
  }, [relations, serverId]);
  const envModules = useMemo(() => {
    const ids = relations.filter(r => r.kind === "child" && r.from === envId).map(r => r.to);
    return ids.map(id => elements.get(id)).filter((e): e is Element => !!e && e.type === "group");
  }, [relations, envId, elements]);
  const allEnvServers = useMemo(() => {
    const out: Element[] = [];
    for (const m of envModules) {
      const ids = relations.filter(r => r.kind === "child" && r.from === m.id).map(r => r.to);
      for (const id of ids) {
        const el = elements.get(id);
        if (el?.type === "server") out.push(el);
      }
    }
    return out;
  }, [envModules, relations, elements]);

  useEffect(() => {
    if (!server) return;
    setDraft({
      title: server.title,
      ip: c.ip ?? "",
      port: c.port == null ? "" : String(c.port),
      hostname: c.hostname ?? "",
      os: c.os ?? "",
      region: c.region ?? "",
      notes: c.notes ?? "",
      serverRole: c.serverRole ?? "app",
      moduleId: currentParentId ?? "",
    });
    setEditing(false);
  }, [serverId, server, c.ip, c.port, c.hostname, c.os, c.region, c.notes, c.serverRole, currentParentId]);

  function startEdit() {
    try {
      setDraft({
        title: server?.title ?? "",
        ip: c.ip ?? "",
        port: c.port == null ? "" : String(c.port),
        hostname: c.hostname ?? "",
        os: c.os ?? "",
        region: c.region ?? "",
        notes: c.notes ?? "",
        serverRole: c.serverRole ?? "app",
        moduleId: currentParentId ?? "",
      });
      setEditing(true);
    } catch {
      setEditing(true);
    }
  }

  function cancelEdit() {
    setEditing(false);
    if (!server) return;
    setDraft({
      title: server.title,
      ip: c.ip ?? "",
      port: c.port == null ? "" : String(c.port),
      hostname: c.hostname ?? "",
      os: c.os ?? "",
      region: c.region ?? "",
      notes: c.notes ?? "",
      serverRole: c.serverRole ?? "app",
      moduleId: currentParentId ?? "",
    });
  }

  async function saveEdit() {
    if (!server) return;
    const title = draft.title.trim();
    if (!title) {
      window.alert("服务器名不能为空");
      return;
    }
    const portText = draft.port.trim();
    let port: number | undefined;
    if (portText) {
      const parsedPort = Number(portText);
      if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        window.alert("端口必须是 1-65535 的整数");
        return;
      }
      port = parsedPort;
    }
    setSaving(true);
    try {
      const oldContent = (server.content ?? {}) as Record<string, unknown>;
      await api.patchElement(serverId, {
        title,
        content: {
          ...oldContent,
          ip: draft.ip.trim() || undefined,
          port,
          hostname: draft.hostname.trim() || undefined,
          os: draft.os.trim() || undefined,
          region: draft.region.trim() || undefined,
          notes: draft.notes.trim() || undefined,
          serverRole: draft.serverRole,
        },
      });
      if (draft.moduleId && draft.moduleId !== currentParentId) {
        await api.moveElement(serverId, draft.moduleId);
      }
      await hydrate();
      setEditing(false);
    } catch (e) {
      window.alert(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  // 凭证 = server 的子元
  const credentials = useMemo(() => {
    const childIds = relations.filter(r => r.kind === "child" && r.from === serverId).map(r => r.to);
    return childIds.map(id => elements.get(id)).filter((e): e is Element => !!e && e.type === "credential");
  }, [serverId, elements, relations]);

  // 涉及此 server 的所有 connection
  const involvedConnections = useMemo(() => {
    const envChildIds = relations.filter(r => r.kind === "child" && r.from === envId).map(r => r.to);
    return envChildIds
      .map(id => elements.get(id))
      .filter((e): e is Element => !!e && e.type === "connection")
      .filter(e => {
        const cc = e.content as { fromServerId?: string; toServerId?: string };
        return cc.fromServerId === serverId || cc.toServerId === serverId;
      });
  }, [serverId, envId, elements, relations]);

  async function createCredential(draft: CredentialDraft) {
    const label = draft.label.trim();
    if (!label) return;
    const r = await api.createElement({ title: label, type: "credential", parentId: serverId });
    await api.patchElement(r.element.id, {
      content: credentialContentFromDraft(draft),
    });
    await hydrate();
    setAddingCredential(false);
  }

  async function createConnection(draft: ConnectionDraft) {
    const content = connectionContentFromDraft(draft, serverId);
    const r = await api.createElement({ title: connectionTitle(content, allEnvServers), type: "connection", parentId: envId });
    await api.patchElement(r.element.id, { content });
    await hydrate();
    setAddingConnection(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (editing) cancelEdit();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, onClose]);

  if (!server) return null;

  return (
    <div className="prj-drawer-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <aside className="prj-drawer" aria-label="服务器详情" onClick={e => e.stopPropagation()}>
        <header className="prj-drawer__head">
          <div>
            <h3>{server.title}</h3>
            {c.hostname && <code className="prj-drawer__host">{c.hostname}</code>}
          </div>
          <button type="button" className="prj-drawer__close" onClick={onClose}>✕</button>
        </header>
        <div className="prj-drawer__body">
          {/* 基础信息 */}
          <section>
            <div className="prj-drawer__section-head">
              <h4>基础信息</h4>
              {!editing ? (
                <button type="button" className="prj-btn-link prj-drawer__edit-btn" onClick={startEdit}>编辑</button>
              ) : (
                <div className="prj-drawer__actions">
                  <button type="button" className="prj-btn-primary" disabled={saving} onClick={() => void saveEdit()}>
                    {saving ? "保存中…" : "保存"}
                  </button>
                  <button type="button" className="prj-btn-link" disabled={saving} onClick={cancelEdit}>取消</button>
                </div>
              )}
            </div>
            {!editing ? (
              <dl className="prj-drawer__info">
                <dt>IP</dt><dd><code>{c.ip ?? "—"}</code></dd>
                <dt>属性</dt><dd>{serverRoleLabel(c.serverRole)}</dd>
                {c.port != null && (<><dt>端口</dt><dd><code>{c.port}</code></dd></>)}
                {c.hostname && (<><dt>主机名</dt><dd><code>{c.hostname}</code></dd></>)}
                {c.os && (<><dt>OS</dt><dd>{c.os}</dd></>)}
                {c.region && (<><dt>区域</dt><dd>{c.region}</dd></>)}
                <dt>所属模块</dt><dd>{envModules.find(m => m.id === currentParentId)?.title ?? "未分组"}</dd>
                {c.notes && (<><dt>备注</dt><dd className="prj-drawer__notes">{c.notes}</dd></>)}
              </dl>
            ) : (
              <div className="prj-drawer__edit-grid">
                <label>
                  <span>服务器名</span>
                  <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                </label>
                <label>
                  <span>IP</span>
                  <input value={draft.ip} onChange={e => setDraft(d => ({ ...d, ip: e.target.value }))} />
                </label>
                <label>
                  <span>端口</span>
                  <input inputMode="numeric" value={draft.port} onChange={e => setDraft(d => ({ ...d, port: e.target.value }))} />
                </label>
                <label>
                  <span>属性</span>
                  <select value={draft.serverRole} onChange={e => setDraft(d => ({ ...d, serverRole: e.target.value as ServerRole }))}>
                    {SERVER_ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>所属模块</span>
                  <select value={draft.moduleId} onChange={e => setDraft(d => ({ ...d, moduleId: e.target.value }))}>
                    {!currentParentId && <option value="">(未分组)</option>}
                    {envModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </label>
                <label>
                  <span>主机名</span>
                  <input value={draft.hostname} onChange={e => setDraft(d => ({ ...d, hostname: e.target.value }))} />
                </label>
                <label>
                  <span>OS</span>
                  <input value={draft.os} onChange={e => setDraft(d => ({ ...d, os: e.target.value }))} />
                </label>
                <label>
                  <span>区域</span>
                  <input value={draft.region} onChange={e => setDraft(d => ({ ...d, region: e.target.value }))} />
                </label>
                <label className="prj-drawer__edit-grid-full">
                  <span>备注</span>
                  <textarea rows={5} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
                </label>
              </div>
            )}
          </section>

          {/* 凭证 */}
          <section>
            <div className="prj-drawer__section-head">
              <h4>🔐 凭证（{credentials.length}）</h4>
              {!addingCredential && (
                <button type="button" className="prj-btn-link prj-drawer__edit-btn" onClick={() => setAddingCredential(true)}>
                  新增
                </button>
              )}
            </div>
            {addingCredential && (
              <CredentialForm
                mode="create"
                onCancel={() => setAddingCredential(false)}
                onSave={createCredential}
              />
            )}
            {credentials.length === 0 && <div className="prj-drawer__empty">未配置</div>}
            {credentials.map(cred => <CredentialBlock key={cred.id} credential={cred} onSaved={() => void hydrate()} />)}
          </section>

          {/* 连接 */}
          <section>
            <div className="prj-drawer__section-head">
              <h4>🔗 涉及连接（{involvedConnections.length}）</h4>
              {!addingConnection && (
                <button type="button" className="prj-btn-link prj-drawer__edit-btn" onClick={() => setAddingConnection(true)}>
                  新增
                </button>
              )}
            </div>
            {addingConnection && (
              <ConnectionForm
                mode="create"
                thisServerId={serverId}
                servers={allEnvServers}
                onCancel={() => setAddingConnection(false)}
                onSave={createConnection}
              />
            )}
            {involvedConnections.length === 0 && <div className="prj-drawer__empty">无</div>}
            <ul className="prj-drawer__conns">
              {involvedConnections.map(conn => (
                <ConnectionRow
                  key={conn.id}
                  connection={conn}
                  thisServerId={serverId}
                  servers={allEnvServers}
                  onSaved={() => void hydrate()}
                />
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}

interface CredentialDraft {
  kind: CredentialKind;
  label: string;
  username: string;
  password: string;
  privateKey: string;
  url: string;
  notes: string;
}

interface ConnectionDraft {
  direction: "out" | "in";
  otherServerId: string;
  port: string;
  protocol: string;
  purpose: string;
  firewall: FirewallStatus;
  notes: string;
}

function credentialDraftFromElement(credential?: Element): CredentialDraft {
  const c = (credential?.content ?? {}) as Partial<CredentialDraft>;
  return {
    kind: (c.kind === "ssh" || c.kind === "db" || c.kind === "web" || c.kind === "api" || c.kind === "other") ? c.kind : "ssh",
    label: c.label ?? credential?.title ?? "",
    username: c.username ?? "",
    password: c.password ?? "",
    privateKey: c.privateKey ?? "",
    url: c.url ?? "",
    notes: c.notes ?? "",
  };
}

function credentialContentFromDraft(draft: CredentialDraft) {
  return {
    kind: draft.kind,
    label: draft.label.trim(),
    username: draft.username.trim() || undefined,
    password: draft.password || undefined,
    privateKey: draft.privateKey.trim() || undefined,
    url: draft.url.trim() || undefined,
    notes: draft.notes.trim() || undefined,
  };
}

function connectionDraftFromElement(connection: Element | null, thisServerId: string, servers: Element[]): ConnectionDraft {
  const c = (connection?.content ?? {}) as {
    fromServerId?: string; toServerId?: string; port?: number; protocol?: string; purpose?: string; firewall?: string; notes?: string;
  };
  const direction: "out" | "in" = c.toServerId === thisServerId ? "in" : "out";
  const otherServerId = direction === "out" ? c.toServerId : c.fromServerId;
  return {
    direction,
    otherServerId: otherServerId ?? servers.find(s => s.id !== thisServerId)?.id ?? "",
    port: c.port == null ? "" : String(c.port),
    protocol: c.protocol ?? "tcp",
    purpose: c.purpose ?? "",
    firewall: c.firewall === "open" || c.firewall === "pending" || c.firewall === "blocked" || c.firewall === "unknown" ? c.firewall : "unknown",
    notes: c.notes ?? "",
  };
}

function connectionContentFromDraft(draft: ConnectionDraft, thisServerId: string) {
  const port = Number(draft.port.trim());
  if (!draft.otherServerId) throw new Error("请选择对端服务器");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("端口必须是 1-65535 的整数");
  return {
    fromServerId: draft.direction === "out" ? thisServerId : draft.otherServerId,
    toServerId: draft.direction === "out" ? draft.otherServerId : thisServerId,
    port,
    protocol: draft.protocol.trim() || "tcp",
    purpose: draft.purpose.trim() || undefined,
    firewall: draft.firewall,
    notes: draft.notes.trim() || undefined,
  };
}

function connectionTitle(content: { fromServerId: string; toServerId: string; port: number; protocol?: string }, servers: Element[]): string {
  const from = servers.find(s => s.id === content.fromServerId)?.title ?? "来源";
  const to = servers.find(s => s.id === content.toServerId)?.title ?? "目标";
  return `${from} → ${to} ${content.port}/${content.protocol ?? "tcp"}`;
}

function CredentialForm({ mode, initial, onSave, onCancel }: {
  mode: "create" | "edit";
  initial?: CredentialDraft;
  onSave: (draft: CredentialDraft) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CredentialDraft>(initial ?? credentialDraftFromElement());
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!draft.label.trim()) {
      window.alert("凭证名称不能为空");
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } catch (e) {
      window.alert(`保存凭证失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="prj-drawer__inline-form">
      <div className="prj-drawer__edit-grid">
        <label>
          <span>名称</span>
          <input autoFocus value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} />
        </label>
        <label>
          <span>类型</span>
          <select value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value as CredentialKind }))}>
            {CREDENTIAL_KIND_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>账号</span>
          <input value={draft.username} onChange={e => setDraft(d => ({ ...d, username: e.target.value }))} />
        </label>
        <label>
          <span>密码 / Token</span>
          <input value={draft.password} onChange={e => setDraft(d => ({ ...d, password: e.target.value }))} />
        </label>
        <label className="prj-drawer__edit-grid-full">
          <span>URL</span>
          <input value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} />
        </label>
        <label className="prj-drawer__edit-grid-full">
          <span>私钥 / Key</span>
          <textarea rows={4} value={draft.privateKey} onChange={e => setDraft(d => ({ ...d, privateKey: e.target.value }))} />
        </label>
        <label className="prj-drawer__edit-grid-full">
          <span>备注</span>
          <textarea rows={3} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
        </label>
      </div>
      <div className="prj-drawer__form-actions">
        <button type="button" className="prj-btn-primary" disabled={saving || !draft.label.trim()} onClick={() => void submit()}>
          {saving ? "保存中…" : mode === "create" ? "新增凭证" : "保存凭证"}
        </button>
        <button type="button" className="prj-btn-link" disabled={saving} onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function CredentialBlock({ credential, onSaved }: { credential: Element; onSaved: () => void }) {
  const cc = (credential.content ?? {}) as {
    kind?: string; label?: string; username?: string; password?: string; privateKey?: string; url?: string; notes?: string;
  };
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);

  function maskedPwd(p: string): string {
    return p ? "•".repeat(Math.min(p.length, 16)) : "(空)";
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); } catch {}
  }
  async function save(draft: CredentialDraft) {
    await api.patchElement(credential.id, {
      title: draft.label.trim(),
      content: credentialContentFromDraft(draft),
    });
    await onSaved();
    setEditing(false);
  }
  async function remove() {
    if (!window.confirm(`删除凭证「${cc.label ?? credential.title}」？`)) return;
    await api.deleteElement(credential.id);
    onSaved();
  }

  return (
    <div className="prj-drawer__cred">
      {editing ? (
        <CredentialForm
          mode="edit"
          initial={credentialDraftFromElement(credential)}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
      <div className="prj-drawer__cred-head">
        <strong>{cc.label ?? credential.title}</strong>
        <span className="prj-drawer__cred-kind">{cc.kind ?? "?"}</span>
        <button type="button" className="prj-btn-link" onClick={() => setRevealed(v => !v)}
          title={revealed ? "隐藏" : "显示"}>{revealed ? "🙈" : "👁"}</button>
        <button type="button" className="prj-btn-link" onClick={() => setEditing(true)}>编辑</button>
        <button type="button" className="prj-btn-link prj-btn-danger" onClick={() => void remove()}>删除</button>
      </div>
      <dl className="prj-drawer__cred-fields">
        {cc.url && (<><dt>URL</dt><dd>
          <code>{cc.url}</code>
          <button className="prj-btn-link" onClick={() => void copy(cc.url!)}>📋</button>
        </dd></>)}
        {cc.username && (<><dt>账号</dt><dd>
          <code>{cc.username}</code>
          <button className="prj-btn-link" onClick={() => void copy(cc.username!)}>📋</button>
        </dd></>)}
        {cc.password && (<><dt>密码</dt><dd>
          <code>{revealed ? cc.password : maskedPwd(cc.password)}</code>
          {revealed && <button className="prj-btn-link" onClick={() => void copy(cc.password!)}>📋</button>}
        </dd></>)}
        {cc.privateKey && (<><dt>Key</dt><dd>
          <code className="prj-drawer__cred-key">{revealed ? cc.privateKey.slice(0, 80) + (cc.privateKey.length > 80 ? "…" : "") : "•••• (已隐藏)"}</code>
          {revealed && <button className="prj-btn-link" onClick={() => void copy(cc.privateKey!)}>📋</button>}
        </dd></>)}
        {cc.notes && (<><dt>备注</dt><dd>{cc.notes}</dd></>)}
      </dl>
        </>
      )}
    </div>
  );
}

function ConnectionForm({ mode, initial, thisServerId, servers, onSave, onCancel }: {
  mode: "create" | "edit";
  initial?: ConnectionDraft;
  thisServerId: string;
  servers: Element[];
  onSave: (draft: ConnectionDraft) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ConnectionDraft>(initial ?? connectionDraftFromElement(null, thisServerId, servers));
  const [saving, setSaving] = useState(false);
  const otherServers = servers.filter(s => s.id !== thisServerId);

  async function submit() {
    setSaving(true);
    try {
      await onSave(draft);
    } catch (e) {
      window.alert(`保存连接失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="prj-drawer__inline-form">
      <div className="prj-drawer__edit-grid">
        <label>
          <span>方向</span>
          <select value={draft.direction} onChange={e => setDraft(d => ({ ...d, direction: e.target.value as "out" | "in" }))}>
            <option value="out">本服务器 → 对端</option>
            <option value="in">对端 → 本服务器</option>
          </select>
        </label>
        <label>
          <span>对端服务器</span>
          <select value={draft.otherServerId} onChange={e => setDraft(d => ({ ...d, otherServerId: e.target.value }))}>
            <option value="">请选择</option>
            {otherServers.map(s => {
              const c = (s.content ?? {}) as { ip?: string };
              return <option key={s.id} value={s.id}>{s.title}{c.ip ? ` · ${c.ip}` : ""}</option>;
            })}
          </select>
        </label>
        <label>
          <span>端口</span>
          <input inputMode="numeric" value={draft.port} onChange={e => setDraft(d => ({ ...d, port: e.target.value }))} />
        </label>
        <label>
          <span>协议</span>
          <input value={draft.protocol} onChange={e => setDraft(d => ({ ...d, protocol: e.target.value }))} />
        </label>
        <label>
          <span>防火墙</span>
          <select value={draft.firewall} onChange={e => setDraft(d => ({ ...d, firewall: e.target.value as FirewallStatus }))}>
            {FIREWALL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>用途</span>
          <input value={draft.purpose} onChange={e => setDraft(d => ({ ...d, purpose: e.target.value }))} />
        </label>
        <label className="prj-drawer__edit-grid-full">
          <span>备注</span>
          <textarea rows={3} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
        </label>
      </div>
      <div className="prj-drawer__form-actions">
        <button type="button" className="prj-btn-primary" disabled={saving || !draft.otherServerId || !draft.port.trim()} onClick={() => void submit()}>
          {saving ? "保存中…" : mode === "create" ? "新增连接" : "保存连接"}
        </button>
        <button type="button" className="prj-btn-link" disabled={saving} onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function ConnectionRow({ connection, thisServerId, servers, onSaved }: {
  connection: Element; thisServerId: string; servers: Element[]; onSaved: () => void;
}) {
  const elements = useStore(s => s.elements);
  const cc = (connection.content ?? {}) as {
    fromServerId?: string; toServerId?: string; port?: number; protocol?: string;
    purpose?: string; firewall?: string; notes?: string;
  };
  const [editing, setEditing] = useState(false);
  const otherId = cc.fromServerId === thisServerId ? cc.toServerId : cc.fromServerId;
  const direction = cc.fromServerId === thisServerId ? "→" : "←";
  const other = otherId ? elements.get(otherId) : null;
  const otherIp = (other?.content as { ip?: string } | undefined)?.ip;
  const fwClass = cc.firewall ?? "unknown";
  const fwLabel = fwClass === "open" ? "通" : fwClass === "blocked" ? "拦" : fwClass === "pending" ? "申" : "?";
  async function save(draft: ConnectionDraft) {
    const content = connectionContentFromDraft(draft, thisServerId);
    await api.patchElement(connection.id, {
      title: connectionTitle(content, servers),
      content,
    });
    await onSaved();
    setEditing(false);
  }
  async function remove() {
    if (!window.confirm(`删除连接「${connection.title}」？`)) return;
    await api.deleteElement(connection.id);
    onSaved();
  }

  return (
    <li className="prj-drawer__conn">
      {editing ? (
        <ConnectionForm
          mode="edit"
          initial={connectionDraftFromElement(connection, thisServerId, servers)}
          thisServerId={thisServerId}
          servers={servers}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
      <span className={`prj-drawer__conn-fw prj-drawer__conn-fw--${fwClass}`}>{fwLabel}</span>
      <span className="prj-drawer__conn-arrow">{direction}</span>
      <div className="prj-drawer__conn-main">
        <span className="prj-drawer__conn-target">
          {other?.title ?? "?"} {otherIp && <code>{otherIp}</code>}
        </span>
        <span className="prj-drawer__conn-port">:{cc.port}/{cc.protocol ?? "tcp"}</span>
        {cc.purpose && <span className="prj-drawer__conn-purpose">— {cc.purpose}</span>}
        {cc.notes && <span className="prj-drawer__conn-purpose">备注：{cc.notes}</span>}
      </div>
      <div className="prj-drawer__conn-actions">
        <button type="button" className="prj-btn-link" onClick={() => setEditing(true)}>编辑</button>
        <button type="button" className="prj-btn-link prj-btn-danger" onClick={() => void remove()}>删除</button>
      </div>
        </>
      )}
    </li>
  );
}

// ── 底部全表 ────────────────────────────────────────────────────
function ServersTable({ env, servers, onPick }: {
  env: Element;
  servers: Array<{ server: Element; module: Element }>;
  onPick: (id: string) => void;
}) {
  if (servers.length === 0) return null;
  return (
    <section className="prj-deploy__table-wrap">
      <h4>{(env.content as { envName?: string })?.envName?.toUpperCase() ?? env.title} · 服务器清单</h4>
      <table className="prj-deploy__table">
        <thead>
          <tr>
            <th>服务器</th>
            <th>属性</th>
            <th>IP</th>
            <th>端口</th>
            <th>模块</th>
            <th>主机名</th>
            <th>OS</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {servers.map(({ server, module }) => {
            const c = (server.content ?? {}) as { ip?: string; serverRole?: string; port?: number; hostname?: string; os?: string; notes?: string };
            return (
              <tr key={server.id} onClick={() => onPick(server.id)}>
                <td className="prj-deploy__table-name">{server.title}</td>
                <td>
                  <span className={`prj-deploy__server-role prj-deploy__server-role--${c.serverRole ?? "unset"}`}>
                    {serverRoleLabel(c.serverRole)}
                  </span>
                </td>
                <td><code>{c.ip ?? "—"}</code></td>
                <td>{c.port ?? "—"}</td>
                <td>{module.title}</td>
                <td><code>{c.hostname ?? "—"}</code></td>
                <td>{c.os ?? "—"}</td>
                <td className="prj-deploy__table-notes">{c.notes ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// ── 占位 section（批次 2/3 接入）─────────────────────────────────
function PlaceholderSection({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="prj-placeholder">
      <h2>{title}</h2>
      <p>{hint}</p>
    </div>
  );
}
