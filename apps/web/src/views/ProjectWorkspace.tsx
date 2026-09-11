import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import type { DeploymentStepContent, Element, ProjectContent } from "@ke/domain";
import { useStore } from "../state/store.js";
import {
  api,
  type ProjectFolderNode,
  type ProjectFolderScanResult,
  type ProjectModuleItem,
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
  DeliverablesWorkspace,
  ReportsWorkspace,
  DeliveryPlanWorkspace,
  ProjectDashboard,
  ProjectManagementSearchBar,
  PROJECT_MANAGEMENT_SECTIONS,
  ScenariosSection,
  TodosSection,
  TestCenterWorkspace,
  IssuesWorkspace,
  WorkflowSection,
  type ProjectManagementSection,
  type ProjectManagementSearchTarget,
} from "./project-management/index.js";
import { shouldScrollFocusedFolderIntoView } from "./project-management/folderFocus.js";
import { DELIVERABLE_FOCUS_EVENT, DELIVERABLE_ITEM_FOCUS_EVENT, storeDeliverableFocus } from "./project-management/deliverables/DeliverablesModel.js";
import { FlowchartsWorkspace } from "./project-management/flowcharts/FlowchartsWorkspace.js";

interface Props { projectId: string }
type ProjectMenuIconName = ProjectManagementSection | "globalSearch";
type ProjectMenuConfig = {
  order: ProjectManagementSection[];
  hidden: ProjectManagementSection[];
  searchVisible: boolean;
};

const EMPTY_STATE_SECTIONS = new Set<ProjectManagementSection>([
  "workflow", "scenarios", "environments", "deploymentSteps", "monitoring", "codeVersions",
]);

function ProjectMenuIcon({ section }: { section: ProjectMenuIconName }): ReactNode {
  let artwork: ReactNode;
  switch (section) {
    case "dashboard": artwork = <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M4 10h16"/></>; break;
    case "deliveryPlan": artwork = <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 3v4M16 3v4M8 13h3M8 16h7"/></>; break;
    case "deliverables": artwork = <><path d="M4 8h16v11H4zM7 4h10l2 4H5z"/><path d="M8 13h8"/></>; break;
    case "reports": artwork = <><path d="M5 20V5M5 20h15"/><path d="M9 16v-4M13 16V8M17 16v-7"/></>; break;
    case "description": artwork = <><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 11h6M9 15h6"/></>; break;
    case "dictionary": artwork = <><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17M9 4v16M9 13h11"/></>; break;
    case "automation": artwork = <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><path d="m8 7 8 4M8 17l8-4"/></>; break;
    case "workflow": artwork = <><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6.5 8l4.3 8M17.5 8l-4.3 8"/></>; break;
    case "flowcharts": artwork = <><path d="m12 3 6 6-6 6-6-6zM6 15l-3 3M18 15l3 3M3 18h5M16 18h5"/></>; break;
    case "scenarios": artwork = <><path d="M4 5.5A3.5 3.5 0 0 1 8 5h4v14H8a3.5 3.5 0 0 0-4 1zM20 5.5A3.5 3.5 0 0 0 16 5h-4v14h4a3.5 3.5 0 0 1 4 1z"/></>; break;
    case "environments": artwork = <><rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></>; break;
    case "deploymentSteps": artwork = <><path d="M5 4h14v16H5z"/><path d="m8 9 1.5 1.5L12 7M8 15l1.5 1.5L12 13M14 9h2M14 15h2"/></>; break;
    case "monitoring": artwork = <><path d="M3 12h4l2-5 4 10 2-5h6"/><path d="M4 5.5A9 9 0 0 1 20 5.5"/></>; break;
    case "codeVersions": artwork = <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 7v10c0 1.7 1.3 3 3 3h7M6 9c0 2 1.3 3 3 3h7"/></>; break;
    case "todos": artwork = <><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4.5h6M9 11l1.5 1.5L14 9M9 16l1.5 1.5L14 14"/></>; break;
    case "testing": artwork = <><path d="M9 3h6M10 3v6l-4.5 7.4A3 3 0 0 0 8 21h8a3 3 0 0 0 2.5-4.6L14 9V3"/><path d="M8.5 16h7"/></>; break;
    case "issues": artwork = <><path d="M12 3 21 20H3z"/><path d="M12 9v5M12 17h.01"/></>; break;
    case "folder": artwork = <><path d="M3 7h7l2 2h9v10H3z"/><path d="M3 7V5h7l2 2"/></>; break;
    default: artwork = <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{artwork}</svg>;
}

export function ProjectWorkspace({ projectId }: Props): ReactNode {
  const project = useStore(s => s.elements.get(projectId));
  const hydrate = useStore(s => s.hydrate);
  const [section, setSection] = useState<ProjectManagementSection>(() => loadProjectManagementWorkspaceSection(projectId));
  const [summary, setSummary] = useState<ProjectManagementSummary | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [searchAnchorLeft, setSearchAnchorLeft] = useState<number | null>(null);
  const [searchTarget, setSearchTarget] = useState<ProjectManagementSearchTarget | null>(null);
  const [menuConfig, setMenuConfig] = useState<ProjectMenuConfig>(() => loadProjectMenuConfig(projectId));
  const [menuConfigOpen, setMenuConfigOpen] = useState(false);
  const [draggedMenuId, setDraggedMenuId] = useState<ProjectManagementSection | null>(null);
  const [isEditingProjectTitle, setIsEditingProjectTitle] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const workspaceHeaderRef = useRef<HTMLElement | null>(null);
  const menuNavRef = useRef<HTMLElement | null>(null);
  const menuNavDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; dragging: boolean } | null>(null);
  const menuNavSkipClickRef = useRef(false);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuSettingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuSettingsPanelRef = useRef<HTMLElement | null>(null);
  const selectSection = useCallback((next: ProjectManagementSection) => {
    setSection(next);
    saveProjectManagementWorkspaceSection(projectId, next);
  }, [projectId]);
  const startMenuNavDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const nav = event.currentTarget;
    if (event.button !== 0 || nav.scrollWidth <= nav.clientWidth) return;
    menuNavDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: nav.scrollLeft, dragging: false };
    nav.setPointerCapture(event.pointerId);
  };
  const moveMenuNavDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = menuNavDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (!drag.dragging && Math.abs(distance) < 12) return;
    if (!drag.dragging) {
      drag.dragging = true;
      menuNavSkipClickRef.current = true;
      event.currentTarget.classList.add("is-dragging");
    }
    event.currentTarget.scrollLeft = drag.startScrollLeft - distance;
  };
  const endMenuNavDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = menuNavDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.dragging) event.currentTarget.classList.remove("is-dragging");
    menuNavDragRef.current = null;
  };
  const scrollMenuNav = (event: ReactWheelEvent<HTMLElement>) => {
    const nav = event.currentTarget;
    if (nav.scrollWidth <= nav.clientWidth) return;
    const distance = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!distance) return;
    event.preventDefault();
    nav.scrollLeft += distance;
  };
  const skipMenuNavClick = () => {
    if (!menuNavSkipClickRef.current) return false;
    menuNavSkipClickRef.current = false;
    return true;
  };

  useEffect(() => {
    setSection(loadProjectManagementWorkspaceSection(projectId));
    setMenuConfig(loadProjectMenuConfig(projectId));
    setMenuConfigOpen(false);
  }, [projectId]);

  useEffect(() => {
    setProjectTitleDraft(project?.title ?? "");
    setIsEditingProjectTitle(false);
  }, [project?.id, project?.title]);

  useEffect(() => {
    const openDeliverable = (event: Event) => {
      const target = (event as CustomEvent<{ linkedActivityKey?: string }>).detail;
      if (typeof target?.linkedActivityKey === "string") {
        storeDeliverableFocus(projectId, target.linkedActivityKey);
        selectSection("deliverables");
      }
    };
    window.addEventListener(DELIVERABLE_FOCUS_EVENT, openDeliverable);
    return () => window.removeEventListener(DELIVERABLE_FOCUS_EVENT, openDeliverable);
  }, [projectId, selectSection]);

  useEffect(() => {
    const openDeliverableItem = (event: Event) => {
      const target = (event as CustomEvent<{ projectId?: string }>).detail;
      if (target?.projectId === projectId) selectSection("deliverables");
    };
    window.addEventListener(DELIVERABLE_ITEM_FOCUS_EVENT, openDeliverableItem);
    return () => window.removeEventListener(DELIVERABLE_ITEM_FOCUS_EVENT, openDeliverableItem);
  }, [projectId, selectSection]);

  useEffect(() => {
    let cancelled = false;
    void api.getProjectManagementSummary(projectId)
      .then(next => { if (!cancelled) setSummary(next); })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!menuConfigOpen) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuSettingsButtonRef.current?.contains(target) || menuSettingsPanelRef.current?.contains(target)) return;
      setMenuConfigOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuConfigOpen(false);
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, [menuConfigOpen]);

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
  const saveFlowchartIds = async (flowchartIds: string[]) => {
    await api.patchElement(project.id, { content: { ...c, flowchartIds } satisfies ProjectContent });
    await hydrate();
  };
  const saveDeliverableIds = async (deliverableIds: string[]) => {
    await api.patchElement(project.id, { content: { ...c, deliverableIds } satisfies ProjectContent });
    await hydrate();
  };
  const statusLabel = ({ active: "进行中", paused: "已暂停", archived: "已归档" } as const)[c.status ?? "active"];

  const startEditingProjectTitle = () => {
    setProjectTitleDraft(project.title);
    setIsEditingProjectTitle(true);
  };
  const cancelEditingProjectTitle = () => {
    setProjectTitleDraft(project.title);
    setIsEditingProjectTitle(false);
  };
  const saveProjectTitle = async () => {
    const nextTitle = projectTitleDraft.trim();
    if (!nextTitle || nextTitle === project.title) {
      cancelEditingProjectTitle();
      return;
    }
    try {
      await api.patchElement(project.id, { title: nextTitle });
      await hydrate();
      setIsEditingProjectTitle(false);
    } catch (error) {
      window.alert(`项目名称保存失败: ${error instanceof Error ? error.message : String(error)}`);
      cancelEditingProjectTitle();
    }
  };

  const toggleWindowMaximize = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("button, a, input, textarea, select, [role='button'], [role='tab'], [contenteditable='true']")) return;
    (window as Window & { richWindow?: { toggleMaximize: () => void } }).richWindow?.toggleMaximize();
  };
  const updateMenuConfig = (next: ProjectMenuConfig) => {
    const normalized = normalizeProjectMenuConfig(next);
    setMenuConfig(normalized);
    saveProjectMenuConfig(projectId, normalized);
  };
  const visibleSections = menuConfig.order
    .filter(sectionId => !menuConfig.hidden.includes(sectionId))
    .map(sectionId => PROJECT_MANAGEMENT_SECTIONS.find(item => item.id === sectionId))
    .filter((item): item is (typeof PROJECT_MANAGEMENT_SECTIONS)[number] => Boolean(item));
  const toggleSectionVisible = (sectionId: ProjectManagementSection) => {
    const hidden = menuConfig.hidden.includes(sectionId)
      ? menuConfig.hidden.filter(id => id !== sectionId)
      : [...menuConfig.hidden, sectionId];
    updateMenuConfig({ ...menuConfig, hidden });
    if (section === sectionId && hidden.includes(sectionId)) {
      const fallback = menuConfig.order.find(id => !hidden.includes(id));
      if (fallback) selectSection(fallback);
    }
  };
  const moveMenu = (targetId: ProjectManagementSection) => {
    if (!draggedMenuId || draggedMenuId === targetId) return;
    const order = menuConfig.order.filter(id => id !== draggedMenuId);
    order.splice(order.indexOf(targetId), 0, draggedMenuId);
    updateMenuConfig({ ...menuConfig, order });
    setDraggedMenuId(null);
  };
  const openDictionaryMapping = (tableId: string, systemId?: string) => {
    saveDictionaryMappingTarget(project.id, tableId, systemId);
    selectSection("dictionary");
  };
  const navigateSearchResult = (target: ProjectManagementSearchTarget) => {
    setSearchTarget(target);
    selectSection(target.section);
  };
  const toggleSearch = () => {
    setSearchVisible(visible => {
      if (!visible && workspaceHeaderRef.current && searchButtonRef.current) {
        const header = workspaceHeaderRef.current.getBoundingClientRect();
        const button = searchButtonRef.current.getBoundingClientRect();
        setSearchAnchorLeft(Math.min(button.right - header.left + 8, header.width - 280));
      }
      return !visible;
    });
    setSearchFocusSignal(value => value + 1);
  };
  const isUnconfigured = (sectionId: ProjectManagementSection) => {
    if (!summary) return false;
    if (sectionId === "dictionary") {
      const { systems, tables, fields } = summary.dictionary;
      return systems === 0 && tables === 0 && fields === 0;
    }
    return EMPTY_STATE_SECTIONS.has(sectionId)
      && (summary.modules.find(module => module.key === sectionId)?.count ?? 0) === 0;
  };

  return (
    <div className="prj-ws">
      <header ref={workspaceHeaderRef} className="prj-ws__head" onDoubleClick={toggleWindowMaximize}>
        <div className="prj-ws__head-row">
          <div className="prj-ws__project-title" aria-label="当前项目">
          {isEditingProjectTitle ? (
            <input
              className="prj-ws__title-input"
              aria-label="项目名称"
              autoFocus
              value={projectTitleDraft}
              onChange={event => setProjectTitleDraft(event.target.value)}
              onBlur={() => void saveProjectTitle()}
              onKeyDown={event => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") cancelEditingProjectTitle();
              }}
            />
          ) : (
            <span
              className="prj-ws__title"
              title="双击修改项目名称"
              onDoubleClick={event => {
                event.stopPropagation();
                startEditingProjectTitle();
              }}
            >
              {project.title}
            </span>
          )}
          <span className={`prj-ws__status prj-ws__status--${c.status ?? "active"}`}>{statusLabel}</span>
          {c.owner && <span className="prj-ws__owner">· {c.owner}</span>}
          </div>
          <button
            ref={menuSettingsButtonRef}
            type="button"
            className={`prj-ws__menu-settings${menuConfigOpen ? " is-open" : ""}`}
            aria-expanded={menuConfigOpen}
            aria-label="管理项目菜单"
            title="管理项目菜单"
            onClick={() => setMenuConfigOpen(open => !open)}
          >
            ☷
          </button>
        </div>
        <nav ref={menuNavRef} className="prj-ws__nav" role="tablist" aria-label="项目管理菜单" onPointerDown={startMenuNavDrag} onPointerMove={moveMenuNavDrag} onPointerUp={endMenuNavDrag} onPointerCancel={endMenuNavDrag} onWheel={scrollMenuNav}>
          {visibleSections.map(s => (
            <button key={s.id} type="button" role="tab"
              aria-label={s.label}
              title={s.label}
              data-section={s.id}
              aria-selected={section === s.id}
              className={`prj-ws__nav-btn${section === s.id ? " is-active" : ""}${isUnconfigured(s.id) ? " is-unconfigured" : ""}`}
              onClick={() => { if (!skipMenuNavClick()) selectSection(s.id); }}>
              <span className="prj-ws__nav-icon"><ProjectMenuIcon section={s.id}/></span>
              <span className="prj-ws__nav-label">{s.label}</span>
            </button>
          ))}
          {menuConfig.searchVisible && <button
            ref={searchButtonRef}
            type="button"
            className={`prj-ws__nav-btn prj-ws__nav-btn--search${searchVisible ? " is-active" : ""}`}
            data-section="globalSearch"
            aria-label="全局搜索"
            title="全局搜索"
            onClick={() => { if (!skipMenuNavClick()) toggleSearch(); }}>
            <span className="prj-ws__nav-icon"><ProjectMenuIcon section="globalSearch"/></span>
            <span className="prj-ws__nav-label">全局搜索</span>
          </button>}
        </nav>
        {menuConfigOpen && (
          <section ref={menuSettingsPanelRef} className="prj-ws__menu-panel" aria-label="项目菜单设置">
            <header><strong>项目菜单</strong><span>拖拽排序 · 勾选显示</span></header>
            <div className="prj-ws__menu-panel-list">
              {menuConfig.order.map(sectionId => {
                const item = PROJECT_MANAGEMENT_SECTIONS.find(sectionItem => sectionItem.id === sectionId);
                if (!item) return null;
                const visible = !menuConfig.hidden.includes(sectionId);
                return (
                  <label
                    key={sectionId}
                    className={draggedMenuId === sectionId ? "is-dragging" : ""}
                    draggable
                    onDragStart={() => setDraggedMenuId(sectionId)}
                    onDragOver={event => event.preventDefault()}
                    onDrop={() => moveMenu(sectionId)}
                    onDragEnd={() => setDraggedMenuId(null)}
                  >
                    <span className="prj-ws__menu-drag" aria-hidden="true">⠿</span>
                    <input type="checkbox" checked={visible} onChange={() => toggleSectionVisible(sectionId)} />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
            <label className="prj-ws__menu-search-toggle">
              <input type="checkbox" checked={menuConfig.searchVisible} onChange={() => updateMenuConfig({ ...menuConfig, searchVisible: !menuConfig.searchVisible })} />
              <span>全局搜索</span>
              <em>固定在最后</em>
            </label>
            <button type="button" onClick={() => updateMenuConfig(defaultProjectMenuConfig())}>恢复默认</button>
          </section>
        )}
        <div className={`prj-ws__head-search${searchVisible ? " is-open" : ""}`} style={searchAnchorLeft === null ? undefined : { left: `${searchAnchorLeft}px` }}>
          <ProjectManagementSearchBar
            projectId={project.id}
            onNavigate={navigateSearchResult}
            autoFocusSignal={searchFocusSignal}
          />
        </div>
      </header>

      <div className="prj-ws__main">
        <div className="prj-ws__body">
          {section === "dashboard" && <ProjectDashboard projectId={project.id} deliverablesRoot={c.defaultDeliverablesDirectory} onOpenPlan={() => selectSection("deliveryPlan")} />}
          {section === "deliveryPlan" && <DeliveryPlanWorkspace projectId={project.id} projectName={project.title} deliverablesRoot={c.defaultDeliverablesDirectory} />}
          {section === "deliverables" && <DeliverablesWorkspace projectId={project.id} projectRoot={c.localFolder} deliverablesRoot={c.defaultDeliverablesDirectory} deliverableIds={c.deliverableIds} onDeliverableIdsChange={saveDeliverableIds} />}
          {section === "reports" && <ReportsWorkspace projectId={project.id} />}
          {section === "description" && <ProjectDescriptionSection projectId={project.id} />}
          {section === "dictionary" && <DictionarySection project={project} summary={summary} searchTarget={searchTarget?.section === "dictionary" ? searchTarget : null} />}
          {section === "automation" && <AutomationSection projectId={project.id} onOpenMapping={openDictionaryMapping} />}
          {section === "workflow" && <WorkflowSection project={project} summary={summary} />}
          {section === "flowcharts" && <FlowchartsWorkspace key={`${project.id}:${(c.flowchartIds ?? []).join(",")}`} projectId={project.id} flowchartIds={c.flowchartIds ?? []} onFlowchartIdsChange={saveFlowchartIds} focusId={searchTarget?.section === "flowcharts" ? searchTarget.entityId : undefined} embedded />}
          {section === "scenarios" && <ScenariosSection project={project} summary={summary} />}
          {section === "environments" && <EnvironmentsSection project={project} summary={summary} />}
          {section === "deploymentSteps" && <ProjectDeploymentStepsSection project={project} summary={summary} />}
          {section === "monitoring" && <MonitoringSection project={project} summary={summary} />}
          {section === "codeVersions" && <CodeVersionsSection project={project} summary={summary} />}
          {section === "todos" && <TodosSection project={project} summary={summary} />}
          {section === "testing" && <TestCenterWorkspace projectId={project.id} />}
          {section === "issues" && <IssuesWorkspace projectId={project.id} />}
          {section === "folder" && <FolderSection project={project} searchTarget={searchTarget?.section === "folder" ? searchTarget : null} />}
        </div>
      </div>
    </div>
  );
}

function projectManagementWorkspaceSectionKey(projectId: string) {
  return `rich-project-management-section:${projectId}`;
}

function projectMenuConfigKey(projectId: string) {
  return `rich-project-management-menu:${projectId}`;
}

function defaultProjectMenuConfig(): ProjectMenuConfig {
  return { order: PROJECT_MANAGEMENT_SECTIONS.map(section => section.id), hidden: [], searchVisible: true };
}

function normalizeProjectMenuConfig(value: ProjectMenuConfig): ProjectMenuConfig {
  const validIds = new Set(PROJECT_MANAGEMENT_SECTIONS.map(section => section.id));
  const ordered = value.order.filter((id, index, items) => validIds.has(id) && items.indexOf(id) === index);
  for (const section of PROJECT_MANAGEMENT_SECTIONS) if (!ordered.includes(section.id)) ordered.push(section.id);
  return {
    order: ordered,
    hidden: value.hidden.filter((id, index, items) => validIds.has(id) && items.indexOf(id) === index),
    searchVisible: value.searchVisible !== false,
  };
}

function loadProjectMenuConfig(projectId: string): ProjectMenuConfig {
  if (typeof window === "undefined") return defaultProjectMenuConfig();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(projectMenuConfigKey(projectId)) ?? "null") as Partial<ProjectMenuConfig> | null;
    if (!parsed || !Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) return defaultProjectMenuConfig();
    return normalizeProjectMenuConfig({
      order: parsed.order as ProjectManagementSection[],
      hidden: parsed.hidden as ProjectManagementSection[],
      searchVisible: parsed.searchVisible !== false,
    });
  } catch {
    return defaultProjectMenuConfig();
  }
}

function saveProjectMenuConfig(projectId: string, value: ProjectMenuConfig) {
  try {
    window.localStorage.setItem(projectMenuConfigKey(projectId), JSON.stringify(value));
  } catch {
    // 菜单配置只影响本机显示，不应阻塞项目操作。
  }
}

function loadProjectManagementWorkspaceSection(projectId: string): ProjectManagementSection {
  if (typeof window === "undefined") return "dashboard";
  try {
    const saved = window.localStorage.getItem(projectManagementWorkspaceSectionKey(projectId));
    const valid = new Set(PROJECT_MANAGEMENT_SECTIONS.map(section => section.id));
    return saved && valid.has(saved as ProjectManagementSection) ? saved as ProjectManagementSection : "dashboard";
  } catch {
    return "dashboard";
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
      group: c.group ?? "",
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
              {c.group && (<><dt>项目分组</dt><dd>{c.group}</dd></>)}
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
            <label><span>项目分组</span>
              <input type="text" value={draft.group ?? ""}
                onChange={e => setDraft(d => ({ ...d, group: e.target.value }))}
                placeholder="例如：二代 SAFE / 内部工具" />
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
  { path: "AI项目管理",                 desc: "项目管理手册" },
  { path: "00-启动",                      desc: "合同、SOW、方案" },
  { path: "00-启动/合同",                 desc: "" },
  { path: "00-启动/方案",                 desc: "" },
  { path: "01-管理",                      desc: "计划与过程资料" },
  { path: "01-管理/计划",                 desc: "" },
  { path: "01-管理/日报",                 desc: "" },
  { path: "01-管理/周报",                 desc: "" },
  { path: "01-管理/会议",                 desc: "" },
  { path: "01-管理/问题",                 desc: "风险、问题与变更" },
  { path: "02-分析",                      desc: "需求、产品、接口" },
  { path: "02-分析/需求",                 desc: "" },
  { path: "02-分析/产品",                 desc: "" },
  { path: "02-分析/接口",                 desc: "" },
  { path: "03-Mapping",                   desc: "映射与数据字典" },
  { path: "03-Mapping/字典",              desc: "" },
  { path: "03-Mapping/分析",              desc: "" },
  { path: "03-Mapping/归档",              desc: "" },
  { path: "04-部署",                      desc: "环境、脚本、配置" },
  { path: "04-部署/环境",                 desc: "" },
  { path: "04-部署/脚本",                 desc: "" },
  { path: "04-部署/配置",                 desc: "" },
  { path: "05-版本",                      desc: "发布与源码" },
  { path: "05-版本/发布",                 desc: "" },
  { path: "05-版本/源码",                 desc: "" },
  { path: "06-测试",                      desc: "测试与联调" },
  { path: "06-测试/用例",                 desc: "" },
  { path: "06-测试/数据",                 desc: "" },
  { path: "06-测试/报告",                 desc: "" },
  { path: "07-交付",                      desc: "培训、手册、验收" },
  { path: "07-交付/手册",                 desc: "" },
  { path: "07-交付/验收",                 desc: "" },
  { path: "08-材料",                      desc: "客户提供材料" },
  { path: "08-材料/监管发文",             desc: "" },
  { path: "99-其他",                      desc: "待整理资料" },
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

function folderOpenPathsStorageKey(projectId: string) {
  return `rich:folder-open-paths:${projectId}`;
}

function folderTreeZoomStorageKey(projectId: string) {
  return `rich:folder-tree-zoom:${projectId}`;
}

function loadFolderTreeZoom(projectId: string): number {
  try {
    const zoom = Number(window.localStorage.getItem(folderTreeZoomStorageKey(projectId)));
    return Number.isFinite(zoom) ? Math.min(1.6, Math.max(.8, zoom)) : 1;
  } catch {
    return 1;
  }
}

function loadFolderOpenPaths(projectId: string): Set<string> {
  try {
    const saved = window.localStorage.getItem(folderOpenPathsStorageKey(projectId));
    if (!saved) return new Set([""]);
    const paths = JSON.parse(saved);
    return Array.isArray(paths) ? new Set(paths.filter((path): path is string => typeof path === "string")) : new Set([""]);
  } catch {
    return new Set([""]);
  }
}

function FolderSection({ project, searchTarget }: { project: Element; searchTarget: ProjectManagementSearchTarget | null }) {
  const hydrate = useStore(s => s.hydrate);
  const c = (project.content ?? {}) as ProjectContentWithFolderScan;
  const folder = c.localFolder ?? "";

  const [bindDraft, setBindDraft] = useState(folder);
  const [svnDraft, setSvnDraft] = useState(c.svnPath ?? "");
  const [githubDraft, setGithubDraft] = useState(c.githubPath ?? "");
  const [deliverablesDirectoryDraft, setDeliverablesDirectoryDraft] = useState(c.defaultDeliverablesDirectory ?? "07-交付");
  const [versionControlDirectoryDraft, setVersionControlDirectoryDraft] = useState(c.defaultVersionControlDirectory ?? "05-版本");

  const [scan, setScan] = useState<ProjectFolderScanResult | null>(() => savedFolderScan(c, folder));
  const [scanBusy, setScanBusy] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<ProjectModuleItem[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [focusedFolderPath, setFocusedFolderPath] = useState<string | null>(null);
  const [autoScrollFolderPath, setAutoScrollFolderPath] = useState<string | null>(null);
  const [draggingFolderPath, setDraggingFolderPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ item: ProjectModuleItem; x: number; y: number } | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectModuleItem | null>(null);
  const [pendingFolderAction, setPendingFolderAction] = useState<{ action: string; path: string } | null>(null);
  const [openFolderPaths, setOpenFolderPaths] = useState(() => loadFolderOpenPaths(project.id));
  const [folderTreeZoom, setFolderTreeZoom] = useState(() => loadFolderTreeZoom(project.id));
  const pendingFolderActionRef = useRef(false);

  const [creatingDirs, setCreatingDirs] = useState(false);
  const [createResult, setCreateResult] = useState<string | null>(null);
  const [recommendedStructureOpen, setRecommendedStructureOpen] = useState(false);
  const [importantOpen, setImportantOpen] = useState(false);

  const [selectedDirs, setSelectedDirs] = useState<Set<string>>(
    new Set(RECOMMENDED_STRUCTURE.map(s => s.path)),
  );

  useEffect(() => {
    if (!folderMenu) return;
    const closeMenu = () => setFolderMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [folderMenu]);

  useEffect(() => {
    setBindDraft(folder);
    setSvnDraft(c.svnPath ?? "");
    setGithubDraft(c.githubPath ?? "");
    setDeliverablesDirectoryDraft(c.defaultDeliverablesDirectory ?? "07-交付");
    setVersionControlDirectoryDraft(c.defaultVersionControlDirectory ?? "05-版本");
    setScan(savedFolderScan(c, folder));
    setScanErr(null);
  }, [project.id, folder, c.lastFolderScan]);

  useEffect(() => {
    setOpenFolderPaths(loadFolderOpenPaths(project.id));
    setFolderTreeZoom(loadFolderTreeZoom(project.id));
  }, [project.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem(folderOpenPathsStorageKey(project.id), JSON.stringify([...openFolderPaths]));
    } catch {
      // 浏览器存储不可用时保留当前会话中的展开状态。
    }
  }, [project.id, openFolderPaths]);

  useEffect(() => {
    try {
      window.localStorage.setItem(folderTreeZoomStorageKey(project.id), String(folderTreeZoom));
    } catch {
      // 浏览器存储不可用时保留当前会话中的缩放比例。
    }
  }, [project.id, folderTreeZoom]);

  const toggleFolderOpen = useCallback((path: string) => {
    setOpenFolderPaths(paths => {
      const next = new Set(paths);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const ensureFolderOpen = useCallback((path: string) => {
    setOpenFolderPaths(paths => paths.has(path) ? paths : new Set(paths).add(path));
  }, []);

  function setFolderSubtreeOpen(item: ProjectModuleItem, open: boolean) {
    const path = String(item.content.relativePath ?? "");
    const root = scan?.root;
    if (!root || !path) return;
    const findNode = (node: ProjectFolderNode): ProjectFolderNode | null => {
      if (node.path === path) return node;
      for (const child of node.children ?? []) {
        const found = findNode(child);
        if (found) return found;
      }
      return null;
    };
    const target = findNode(root);
    if (!target) return;
    const paths: string[] = [];
    const collect = (node: ProjectFolderNode) => {
      if (node.kind === "dir") paths.push(node.path);
      node.children?.forEach(collect);
    };
    collect(target);
    setOpenFolderPaths(current => {
      const next = new Set(current);
      paths.forEach(entryPath => open ? next.add(entryPath) : next.delete(entryPath));
      return next;
    });
  }

  async function loadFolderEntries() {
    const items = await api.listProjectManagementModuleItems(project.id, "folder", undefined, true);
    setFolderEntries(items.filter(item => item.content.recordType === "folder-entry"));
  }

  useEffect(() => {
    let cancelled = false;
    void api.listProjectManagementModuleItems(project.id, "folder", undefined, true)
      .then(items => { if (!cancelled) setFolderEntries(items.filter(item => item.content.recordType === "folder-entry")); })
      .catch(() => { if (!cancelled) setFolderEntries([]); });
    return () => { cancelled = true; };
  }, [project.id]);

  const folderEntriesByPath = useMemo(() => new Map(
    folderEntries.map(item => [String(item.content.relativePath ?? ""), item]),
  ), [folderEntries]);
  const markedFolderEntries = useMemo(() => folderEntries
    .filter(item => item.content.marked && item.content.present !== false)
    .sort((a, b) => String(a.content.relativePath ?? "").localeCompare(String(b.content.relativePath ?? ""), "zh-CN")), [folderEntries]);

  useEffect(() => {
    if (!searchTarget || searchTarget.entityType !== "folderEntry") return;
    const target = folderEntries.find(item => item.id === searchTarget.entityId);
    if (!target) return;
    const path = String(target.content.relativePath ?? "");
    if (!path) return;
    setSelectedFolderPath(path);
    setFocusedFolderPath(path);
    setAutoScrollFolderPath(path);
  }, [folderEntries, searchTarget]);

  function beginFolderAction(action: string, path: string): boolean {
    if (pendingFolderActionRef.current) {
      window.alert("文件操作正在同步，请等待完成后再继续操作。");
      return false;
    }
    pendingFolderActionRef.current = true;
    setPendingFolderAction({ action, path });
    return true;
  }

  function finishFolderAction() {
    pendingFolderActionRef.current = false;
    setPendingFolderAction(null);
  }

  async function saveBind() {
    const next = bindDraft.trim();
    try {
      const nextContent: ProjectContentWithFolderScan = {
        ...c,
        localFolder: next || undefined,
        svnPath: svnDraft.trim() || undefined,
        githubPath: githubDraft.trim() || undefined,
        defaultDeliverablesDirectory: deliverablesDirectoryDraft.trim() || "07-交付",
        defaultVersionControlDirectory: versionControlDirectoryDraft.trim() || "05-版本",
      };
      if (next !== folder) delete nextContent.lastFolderScan;
      await api.patchElement(project.id, {
        content: nextContent,
      });
      await hydrate();
    } catch (e) {
      window.alert(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function runScan() {
    if (!folder) return;
    setScanBusy(true); setScanErr(null);
    try {
      const result = await api.scanProjectFolder(project.id);
      setScan(result);
      await loadFolderEntries();
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

  async function saveFolderRemark(item: ProjectModuleItem, remark: string) {
    const updated = await api.updateProjectManagementModuleItem(project.id, item.id, {
      content: { ...item.content, remark: remark.trim() || undefined },
    });
    setFolderEntries(items => items.map(entry => entry.id === updated.id ? updated : entry));
  }

  const selectedFolderEntry = selectedFolderPath === null ? null : folderEntriesByPath.get(selectedFolderPath) ?? null;

  async function saveFolderAiNote(item: ProjectModuleItem, aiNote: string) {
    const updated = await api.updateProjectManagementModuleItem(project.id, item.id, {
      content: { ...item.content, aiNote: aiNote.trim() || undefined },
    });
    setFolderEntries(items => items.map(entry => entry.id === updated.id ? updated : entry));
  }

  async function moveFolderEntry(item: ProjectModuleItem, target: ProjectModuleItem) {
    const sourcePath = String(item.content.relativePath ?? "");
    const targetPath = String(target.content.relativePath ?? "");
    if (!sourcePath || sourcePath === targetPath || targetPath.startsWith(`${sourcePath}/`)) return;
    const destinationPath = targetPath ? `${targetPath}/${item.title}` : item.title;
    if (!beginFolderAction("移动", destinationPath)) return;
    setScan(current => current ? { ...current, root: moveFolderTreeNode(current.root, sourcePath, targetPath) } : current);
    setFolderEntries(items => moveFolderEntries(items, sourcePath, destinationPath, target.id));
    setSelectedFolderPath(destinationPath);
    setFocusedFolderPath(destinationPath);
    try {
      await api.moveProjectFolderEntry(project.id, item.id, target.id);
      await runScan();
    } catch (e) {
      window.alert(`移动失败: ${e instanceof Error ? e.message : String(e)}`);
      await runScan();
    } finally {
      finishFolderAction();
    }
  }

  async function renameFolderEntry(item: ProjectModuleItem, name: string): Promise<boolean> {
    const nextName = name.trim();
    if (!nextName || nextName === item.title) return true;
    const sourcePath = String(item.content.relativePath ?? "");
    if (!sourcePath) return false;
    const destinationPath = `${sourcePath.split("/").slice(0, -1).join("/")}${sourcePath.includes("/") ? "/" : ""}${nextName}`;
    if (!beginFolderAction("重命名", destinationPath)) return false;
    setScan(current => current ? { ...current, root: renameFolderTreeNode(current.root, sourcePath, destinationPath, nextName) } : current);
    setFolderEntries(items => renameFolderEntries(items, sourcePath, destinationPath, nextName));
    setSelectedFolderPath(destinationPath);
    setFocusedFolderPath(destinationPath);
    try {
      await api.renameProjectFolderEntry(project.id, item.id, nextName);
      await runScan();
      return true;
    } catch (e) {
      window.alert(`重命名失败: ${e instanceof Error ? e.message : String(e)}`);
      await runScan();
      return false;
    } finally {
      finishFolderAction();
    }
  }

  async function deleteFolderEntry(item: ProjectModuleItem) {
    if (!window.confirm(`确定删除“${item.title}”${item.content.kind === "dir" ? "及其全部内容" : ""}吗？此操作会删除真实文件，无法撤销。`)) return;
    const sourcePath = String(item.content.relativePath ?? "");
    if (!sourcePath) return;
    if (!beginFolderAction("删除", sourcePath)) return;
    setScan(current => current ? { ...current, root: removeFolderTreeNode(current.root, sourcePath) } : current);
    setFolderEntries(items => items.filter(entry => {
      const path = String(entry.content.relativePath ?? "");
      return path !== sourcePath && !path.startsWith(`${sourcePath}/`);
    }));
    setSelectedFolderPath(null);
    setFocusedFolderPath(null);
    try {
      await api.deleteProjectFolderEntry(project.id, item.id);
      await runScan();
    } catch (e) {
      window.alert(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
      await runScan();
    } finally {
      finishFolderAction();
    }
  }

  async function setFolderIgnored(item: ProjectModuleItem, ignored: boolean) {
    try {
      await api.setProjectFolderIgnored(project.id, item.id, ignored);
      await runScan();
    } catch (e) { window.alert(`${ignored ? "忽略" : "取消忽略"}失败: ${e instanceof Error ? e.message : String(e)}`); }
  }

  async function setFolderMarked(item: ProjectModuleItem, marked: boolean) {
    const updated = await api.updateProjectManagementModuleItem(project.id, item.id, {
      content: { ...item.content, marked },
    });
    setFolderEntries(items => items.map(entry => entry.id === updated.id ? updated : entry));
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
      setCreateResult(`✓ 已建 ${r.created.length} 个目录；${r.manual ? r.manual.created ? "已创建 AI项目管理/项目管理手册.md；" : "项目管理手册已保留；" : ""}跳过 ${r.skipped.length} 个${r.skipped.length > 0 ? `（${r.skipped.map(s => s.path).slice(0, 3).join(", ")}…）` : ""}`);
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
      <div className="prj-folder-section__workspace">
      {/* —— 2. 项目目录扫描 —— */}
      <section className="prj-folder-section__scan">
        <header className="prj-folder-section__row-head">
          <button className="prj-folder-section__root-select" onClick={() => { setSelectedFolderPath(""); setFocusedFolderPath(""); setAutoScrollFolderPath(null); setRecommendedStructureOpen(false); setImportantOpen(false); }}>
            📁 项目目录：<code>{folder || "未绑定"}</code>
          </button>
          <div className="prj-folder-section__actions">
            <button className="prj-folder-section__action is-initialize" onClick={() => { setRecommendedStructureOpen(true); setImportantOpen(false); setSelectedFolderPath(null); }}>初始化</button>
            <button className="prj-folder-section__action is-scan" disabled={!folder || scanBusy || !!pendingFolderAction} onClick={() => void runScan()}>
              {scanBusy ? "遍历中…" : "遍历"}
            </button>
            <button className="prj-folder-section__action is-important" onClick={() => { setImportantOpen(true); setRecommendedStructureOpen(false); setSelectedFolderPath(null); }}>重要{markedFolderEntries.length > 0 ? ` (${markedFolderEntries.length})` : ""}</button>
          </div>
        </header>
        {!folder && <div className="prj-folder-section__empty">先绑定项目目录</div>}
        {scanErr && <div className="prj-folder-section__err">⚠ {scanErr}</div>}
        {pendingFolderAction && <div className="prj-folder-section__sync">⌛ 正在同步：{pendingFolderAction.action} {pendingFolderAction.path}</div>}
        {folder && !scan && !scanBusy && !scanErr && (
          <div className="prj-folder-section__empty">还没有目录记录，点右上角「遍历目录」后会逐条入库。</div>
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
            <div className="prj-folder-section__tree" style={{ fontSize: `${12 * folderTreeZoom}px` }}>
              <FolderTree node={scan.root} depth={0} entriesByPath={folderEntriesByPath}
                focusPath={focusedFolderPath} autoScrollPath={autoScrollFolderPath} draggingPath={draggingFolderPath} dropTargetPath={dropTargetPath} pendingAction={pendingFolderAction}
                openPaths={openFolderPaths} onToggleOpen={toggleFolderOpen} onEnsureOpen={ensureFolderOpen}
                onSelect={path => { const selectedPath = path === "." ? "" : path; setSelectedFolderPath(selectedPath); setFocusedFolderPath(selectedPath); setAutoScrollFolderPath(null); setRecommendedStructureOpen(false); setImportantOpen(false); }} onMove={moveFolderEntry}
                onDragStart={setDraggingFolderPath} onDragTarget={setDropTargetPath} onDragEnd={() => { setDraggingFolderPath(null); setDropTargetPath(null); }}
                onContextMenu={(item, x, y) => setFolderMenu({ item, x, y })} />
            </div>
            <div className="prj-folder-section__ext-bar">
              {scan.extStats.length > 0 && <div className="prj-folder-section__ext-stats">
                <span>文件类型 Top {scan.extStats.length}：</span>
                {scan.extStats.map(s => (
                  <span key={s.ext} className="prj-folder-section__ext-chip">
                    {s.ext} <strong>{s.count}</strong>
                  </span>
                ))}
              </div>}
              <div className="prj-folder-section__tree-zoom" aria-label="目录树缩放">
                <button type="button" onClick={() => setFolderTreeZoom(zoom => Math.max(.8, Number((zoom - .1).toFixed(1))))} disabled={folderTreeZoom <= .8} title="缩小目录树">−</button>
                <button type="button" onClick={() => setFolderTreeZoom(zoom => Math.min(1.6, Number((zoom + .1).toFixed(1))))} disabled={folderTreeZoom >= 1.6} title="放大目录树">+</button>
              </div>
            </div>
          </>
        )}
      </section>

      <aside className="prj-folder-section__detail-pane">
      {/* —— 3. 推荐结构（默认收起）—— */}
      {recommendedStructureOpen && <section className="prj-folder-section__template">
        <header className="prj-folder-section__row-head">
          <h3>🪜 推荐目录结构 <span className="prj-folder-section__template-count">共 {RECOMMENDED_STRUCTURE.length} 项</span></h3>
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
                  <span className="prj-folder-section__template-name" title={item.path}>{item.path.split("/").pop()}</span>
                  {item.desc && <span className="prj-folder-section__template-desc">— {item.desc}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </section>}

      {importantOpen && <section className="prj-folder-section__important">
        <header><h3>重要文件与目录 <span>{markedFolderEntries.length} 项</span></h3></header>
        {markedFolderEntries.length === 0 ? <p className="prj-folder-section__empty">尚未标记重要文件或目录。</p> : <ul>
          {markedFolderEntries.map(item => (
            <li key={item.id}>
              <button onClick={() => setFocusedFolderPath(String(item.content.relativePath ?? ""))}>
                <span>{item.content.kind === "dir" ? "📁" : "📄"} {item.title}</span>
                <code>{String(item.content.relativePath ?? "") || "/"}</code>
              </button>
            </li>
          ))}
        </ul>}
      </section>}

      {/* —— 4. 选中项信息 / AI 整理 —— */}
      {!recommendedStructureOpen && !importantOpen && <section className="prj-folder-section__ai">
        {selectedFolderPath === "" || !folder ? <FolderPathDetails bindDraft={bindDraft} svnDraft={svnDraft} githubDraft={githubDraft} deliverablesDirectoryDraft={deliverablesDirectoryDraft} versionControlDirectoryDraft={versionControlDirectoryDraft}
          onChangeLocal={setBindDraft} onChangeSvn={setSvnDraft} onChangeGithub={setGithubDraft} onChangeDeliverablesDirectory={setDeliverablesDirectoryDraft} onChangeVersionControlDirectory={setVersionControlDirectoryDraft} onSave={() => void saveBind()} /> : selectedFolderEntry ? <FolderEntryDetails item={selectedFolderEntry} onSaveRemark={saveFolderRemark}
          onSaveAiNote={saveFolderAiNote} /> : <>
          <h3>🤖 AI 整理 <span className="prj-folder-section__hint">下一批接入</span></h3>
          <p>单击文件或目录可查看信息、填写备注与 AI 注释；拖拽文件到目录可移动真实文件。</p>
        </>}
      </section>}
      </aside>
      </div>
      {folderMenu && <FolderContextMenu item={folderMenu.item} x={folderMenu.x} y={folderMenu.y} disabled={!!pendingFolderAction} onClose={() => setFolderMenu(null)}
        onOpen={() => void api.openProjectFolderFile(project.id, folderMenu.item.id).catch(e => window.alert(`打开失败: ${e instanceof Error ? e.message : String(e)}`))}
        onReveal={() => void api.revealProjectFolderEntry(project.id, folderMenu.item.id).catch(e => window.alert(`访达打开失败: ${e instanceof Error ? e.message : String(e)}`))}
        onExpand={() => setFolderSubtreeOpen(folderMenu.item, true)} onCollapse={() => setFolderSubtreeOpen(folderMenu.item, false)}
        onRename={() => setRenameTarget(folderMenu.item)} onDelete={() => void deleteFolderEntry(folderMenu.item)}
        onIgnore={ignored => void setFolderIgnored(folderMenu.item, ignored)} onMark={marked => void setFolderMarked(folderMenu.item, marked)} />}
      {renameTarget && <FolderRenameDialog item={renameTarget} onClose={() => setRenameTarget(null)} onRename={name => renameFolderEntry(renameTarget, name)} />}
    </div>
  );
}

function FolderTree({
  node, depth, entriesByPath, focusPath, autoScrollPath, draggingPath, dropTargetPath, pendingAction, openPaths, onToggleOpen, onEnsureOpen, onSelect, onMove, onDragStart, onDragTarget, onDragEnd, onContextMenu,
}: {
  node: ProjectFolderNode;
  depth: number;
  entriesByPath: Map<string, ProjectModuleItem>;
  focusPath: string | null;
  autoScrollPath: string | null;
  draggingPath: string | null;
  dropTargetPath: string | null;
  pendingAction: { action: string; path: string } | null;
  openPaths: Set<string>;
  onToggleOpen: (path: string) => void;
  onEnsureOpen: (path: string) => void;
  onSelect: (path: string) => void;
  onMove: (item: ProjectModuleItem, target: ProjectModuleItem) => Promise<void>;
  onDragStart: (path: string) => void;
  onDragTarget: (path: string | null) => void;
  onDragEnd: () => void;
  onContextMenu: (item: ProjectModuleItem, x: number, y: number) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const entry = entriesByPath.get(node.path);
  const isDir = node.kind === "dir";
  const isEmptyDir = isDir && (node.children?.length ?? 0) === 0;
  const open = openPaths.has(node.path);
  const canAcceptDrop = !!(isDir && entry && draggingPath && draggingPath !== node.path && !node.path.startsWith(`${draggingPath}/`));
  useEffect(() => {
    if (focusPath === null) return;
    const containsFocus = node.path === "" || focusPath === node.path || focusPath.startsWith(`${node.path}/`);
    if (isDir && containsFocus) onEnsureOpen(node.path);
    if (shouldScrollFocusedFolderIntoView(focusPath, node.path, autoScrollPath)) requestAnimationFrame(() => rowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }, [autoScrollPath, focusPath, isDir, node.path, onEnsureOpen]);
  if (entry?.content.present === false) return null;
  const isPending = pendingAction?.path === node.path;
  return (
    <div className="prj-tree-node">
      <div ref={rowRef} className={`prj-tree-row${focusPath === node.path ? " is-focused" : ""}${draggingPath === node.path ? " is-dragging" : ""}${dropTargetPath === node.path && canAcceptDrop ? " is-drop-target" : ""}${isPending ? " is-pending" : ""}`} style={{ paddingLeft: `${depth * 18 + 4}px` }} onClick={() => onSelect(node.path)}
        onDoubleClick={() => { if (isDir) onToggleOpen(node.path); }} draggable={!!entry && node.path !== "" && !pendingAction}
        onDragStart={e => { if (entry) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", entry.id); onDragStart(node.path); } }}
        onDragOver={e => { if (canAcceptDrop) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragTarget(node.path); } }}
        onDragLeave={() => { if (dropTargetPath === node.path) onDragTarget(null); }}
        onDragEnd={onDragEnd}
        onDrop={e => { e.preventDefault(); const source = Array.from(entriesByPath.values()).find(item => item.id === e.dataTransfer.getData("text/plain")); onDragEnd(); if (source && entry && source.id !== entry.id && canAcceptDrop) void onMove(source, entry); }}
        onContextMenu={e => { if (!entry) return; e.preventDefault(); onContextMenu(entry, e.clientX, e.clientY); }}>
        {isDir ? (
          <button
            className="prj-tree-toggle"
            onClick={() => onToggleOpen(node.path)}
            disabled={(node.children?.length ?? 0) === 0}
          >{(node.children?.length ?? 0) === 0 ? "·" : open ? "▾" : "▸"}</button>
        ) : (
          <span className="prj-tree-toggle prj-tree-toggle--leaf">·</span>
        )}
        <span className={`prj-tree-name prj-tree-name--${node.kind}${isEmptyDir ? " is-empty" : ""}${entry?.content.marked ? " is-marked" : ""}`}>
          {isDir ? "📁" : extIcon(node.ext)} {node.name || "(根目录)"}
        </span>
        <span className="prj-tree-meta">
          {isDir
            ? `${node.children?.length ?? 0} 项 · ${formatBytes(node.size)}`
            : formatBytes(node.size)}
        </span>
        {node.truncated && <span className="prj-tree-truncated">(已截断)</span>}
        {node.ignored && <span className="prj-tree-truncated">(已忽略子项)</span>}
        {dropTargetPath === node.path && canAcceptDrop && <span className="prj-tree-drop-hint">放到此目录</span>}
        {isPending && <span className="prj-tree-pending">⌛ 同步中</span>}
      </div>
      {isDir && open && node.children && (
        <div>
          {node.children.map(c => <FolderTree key={c.path} node={c} depth={depth + 1} entriesByPath={entriesByPath} focusPath={focusPath} autoScrollPath={autoScrollPath} draggingPath={draggingPath} dropTargetPath={dropTargetPath} pendingAction={pendingAction} openPaths={openPaths} onToggleOpen={onToggleOpen} onEnsureOpen={onEnsureOpen} onSelect={onSelect} onMove={onMove} onDragStart={onDragStart} onDragTarget={onDragTarget} onDragEnd={onDragEnd} onContextMenu={onContextMenu} />)}
        </div>
      )}
    </div>
  );
}

function moveFolderEntries(items: ProjectModuleItem[], sourcePath: string, destinationPath: string, targetId: string): ProjectModuleItem[] {
  return items.map(item => {
    const path = String(item.content.relativePath ?? "");
    if (path !== sourcePath && !path.startsWith(`${sourcePath}/`)) return item;
    const suffix = path.slice(sourcePath.length);
    return {
      ...item,
      parentId: path === sourcePath ? targetId : item.parentId,
      content: { ...item.content, relativePath: `${destinationPath}${suffix}` },
    };
  });
}

function renameFolderEntries(items: ProjectModuleItem[], sourcePath: string, destinationPath: string, name: string): ProjectModuleItem[] {
  return items.map(item => {
    const path = String(item.content.relativePath ?? "");
    if (path !== sourcePath && !path.startsWith(`${sourcePath}/`)) return item;
    const suffix = path.slice(sourcePath.length);
    return {
      ...item,
      title: path === sourcePath ? name : item.title,
      content: { ...item.content, relativePath: `${destinationPath}${suffix}` },
    };
  });
}

function moveFolderTreeNode(root: ProjectFolderNode, sourcePath: string, targetPath: string): ProjectFolderNode {
  const moved = { node: null as ProjectFolderNode | null };
  const detach = (node: ProjectFolderNode): ProjectFolderNode | null => {
    if (node.path === sourcePath) { moved.node = node; return null; }
    if (!node.children) return node;
    const children = node.children.map(detach).filter((child): child is ProjectFolderNode => child !== null);
    return children.length === node.children.length ? node : { ...node, children };
  };
  const remaining = detach(root);
  const movedNodeSource = moved.node;
  if (!remaining || !movedNodeSource) return root;
  const destinationPath = targetPath ? `${targetPath}/${movedNodeSource.name}` : movedNodeSource.name;
  const remapPaths = (node: ProjectFolderNode): ProjectFolderNode => ({
    ...node,
    path: node.path === sourcePath ? destinationPath : `${destinationPath}${node.path.slice(sourcePath.length)}`,
    children: node.children?.map(remapPaths),
  });
  const movedNode = remapPaths(movedNodeSource);
  const attach = (node: ProjectFolderNode): ProjectFolderNode => {
    if (node.path === targetPath) {
      const children = [...(node.children ?? []), movedNode].sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name, "zh-CN") : a.kind === "dir" ? -1 : 1);
      return { ...node, children };
    }
    return node.children ? { ...node, children: node.children.map(attach) } : node;
  };
  return attach(remaining);
}

function renameFolderTreeNode(root: ProjectFolderNode, sourcePath: string, destinationPath: string, name: string): ProjectFolderNode {
  const remap = (node: ProjectFolderNode): ProjectFolderNode => ({
    ...node,
    name: node.path === sourcePath ? name : node.name,
    path: node.path === sourcePath ? destinationPath : `${destinationPath}${node.path.slice(sourcePath.length)}`,
    children: node.children?.map(remap),
  });
  const visit = (node: ProjectFolderNode): ProjectFolderNode => {
    if (node.path === sourcePath) return remap(node);
    return node.children ? { ...node, children: node.children.map(visit) } : node;
  };
  return visit(root);
}

function removeFolderTreeNode(root: ProjectFolderNode, sourcePath: string): ProjectFolderNode {
  if (!sourcePath || root.path === sourcePath || !root.children) return root;
  return {
    ...root,
    children: root.children
      .filter(node => node.path !== sourcePath && !node.path.startsWith(`${sourcePath}/`))
      .map(node => removeFolderTreeNode(node, sourcePath)),
  };
}

function FolderEntryDetails({
  item, onSaveRemark, onSaveAiNote,
}: {
  item: ProjectModuleItem;
  onSaveRemark: (item: ProjectModuleItem, value: string) => Promise<void>;
  onSaveAiNote: (item: ProjectModuleItem, value: string) => Promise<void>;
}) {
  const [remark, setRemark] = useState(typeof item.content.remark === "string" ? item.content.remark : "");
  const [aiNote, setAiNote] = useState(typeof item.content.aiNote === "string" ? item.content.aiNote : "");
  useEffect(() => {
    setRemark(typeof item.content.remark === "string" ? item.content.remark : "");
    setAiNote(typeof item.content.aiNote === "string" ? item.content.aiNote : "");
  }, [item.id, item.content.remark, item.content.aiNote]);
  return (
    <div className="prj-folder-entry-details">
      <header><h3>{item.content.kind === "dir" ? "📁" : "📄"} {item.title}</h3></header>
      <div className="prj-folder-entry-details__meta">{String(item.content.relativePath)} · {item.content.kind === "dir" ? "目录" : typeof item.content.ext === "string" ? item.content.ext : "文件"} · {formatBytes(Number(item.content.size) || 0)}</div>
      <label>AI 注释<textarea value={aiNote} placeholder="AI 注释（可在此补充或修改）" onChange={e => setAiNote(e.target.value)} onBlur={() => void onSaveAiNote(item, aiNote)} /></label>
      <label>备注<textarea value={remark} placeholder="文件或目录备注" onChange={e => setRemark(e.target.value)} onBlur={() => void onSaveRemark(item, remark)} /></label>
    </div>
  );
}

function FolderPathDetails({
  bindDraft, svnDraft, githubDraft, deliverablesDirectoryDraft, versionControlDirectoryDraft, onChangeLocal, onChangeSvn, onChangeGithub, onChangeDeliverablesDirectory, onChangeVersionControlDirectory, onSave,
}: {
  bindDraft: string;
  svnDraft: string;
  githubDraft: string;
  deliverablesDirectoryDraft: string;
  versionControlDirectoryDraft: string;
  onChangeLocal: (value: string) => void;
  onChangeSvn: (value: string) => void;
  onChangeGithub: (value: string) => void;
  onChangeDeliverablesDirectory: (value: string) => void;
  onChangeVersionControlDirectory: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="prj-folder-entry-details prj-folder-path-details">
      <header><h3>📁 项目路径</h3><button className="prj-btn-primary" onClick={onSave}>保存路径</button></header>
      <label>项目目录<input autoFocus value={bindDraft} placeholder="/Users/你/Documents/项目目录" onChange={e => onChangeLocal(e.target.value)} /></label>
      <label>默认交付物目录<input value={deliverablesDirectoryDraft} placeholder="07-交付" onChange={e => onChangeDeliverablesDirectory(e.target.value)} /></label>
      <label>默认版本控制目录<input value={versionControlDirectoryDraft} placeholder="05-版本" onChange={e => onChangeVersionControlDirectory(e.target.value)} /></label>
      <label>SVN 目录<input value={svnDraft} placeholder="https://svn.example.com/project" onChange={e => onChangeSvn(e.target.value)} /></label>
      <label>GitHub 目录<input value={githubDraft} placeholder="https://github.com/org/repo" onChange={e => onChangeGithub(e.target.value)} /></label>
      <p>目录填写相对项目目录的路径。新建交付物会使用默认交付物目录。</p>
    </div>
  );
}

function FolderContextMenu({
  item, x, y, disabled, onClose, onOpen, onReveal, onExpand, onCollapse, onRename, onDelete, onIgnore, onMark,
}: {
  item: ProjectModuleItem;
  x: number;
  y: number;
  disabled: boolean;
  onClose: () => void;
  onOpen: () => void;
  onReveal: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onRename: () => void;
  onDelete: () => void;
  onIgnore: (ignored: boolean) => void;
  onMark: (marked: boolean) => void;
}) {
  const isDir = item.content.kind === "dir";
  const run = (action: () => void) => { onClose(); action(); };
  return (
    <div className="prj-folder-context-menu" style={{ left: x, top: y }} onContextMenu={e => e.preventDefault()}>
      {isDir ? <button disabled={disabled} onClick={() => run(() => onIgnore(!item.content.ignored))}>{item.content.ignored ? "关注文件夹" : "忽略文件夹"}</button> : <button disabled={disabled} onClick={() => run(onOpen)}>打开</button>}
      {isDir && <>
        <button disabled={disabled} onClick={() => run(onExpand)}>一键展开</button>
        <button disabled={disabled} onClick={() => run(onCollapse)}>一键收缩</button>
      </>}
      <button disabled={disabled} onClick={() => run(onReveal)}>访达</button>
      <button disabled={disabled} onClick={() => run(onRename)}>重命名</button>
      <button disabled={disabled} onClick={() => run(() => onMark(!item.content.marked))}>{item.content.marked ? "取消标记" : "标记"}</button>
      <button disabled={disabled} className="is-danger" onClick={() => run(onDelete)}>删除</button>
    </div>
  );
}

function FolderRenameDialog({
  item, onClose, onRename,
}: {
  item: ProjectModuleItem;
  onClose: () => void;
  onRename: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(item.title);
  useEffect(() => { setName(item.title); }, [item.id, item.title]);
  function submit() {
    if (!name.trim()) return;
    void onRename(name);
    onClose();
  }
  return (
    <div className="prj-folder-rename-dialog" role="presentation" onMouseDown={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="folder-rename-title" onMouseDown={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void submit(); }}>
        <h3 id="folder-rename-title">重命名{item.content.kind === "dir" ? "目录" : "文件"}</h3>
        <p>{item.content.kind === "dir" ? "📁" : "📄"} {String(item.content.relativePath ?? item.title)}</p>
        <label>新名称<input autoFocus value={name} onChange={event => setName(event.target.value)} /></label>
        <footer>
          <button type="button" className="prj-btn-link" onClick={onClose}>取消</button>
          <button type="submit" className="prj-btn-primary" disabled={!name.trim()}>确认重命名</button>
        </footer>
      </form>
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
