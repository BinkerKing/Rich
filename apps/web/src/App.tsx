import { useEffect, useMemo, useState } from "react";
import { useStore } from "./state/store.js";
import { InputView } from "./views/InputView.js";
import { TreeView } from "./views/TreeView.js";
import { AdminView } from "./views/AdminView.js";
import { NewsView } from "./views/NewsView.js";
import { MindmapView } from "./views/MindmapView.js";
import { DeepWorkbenchView } from "./views/DeepWorkbenchView.js";
import { FlowchartsView } from "./views/FlowchartsView.js";
import { DeliverablesView } from "./views/DeliverablesView.js";
import { GreatMeView } from "./views/GreatMeView.js";
import { TaskWorkbench } from "./views/task-workbench/TaskWorkbench.js";
import { AiTaskManagementView } from "./views/AiTaskManagementView.js";
import { PracticeView } from "./views/PracticeView.js";
import { ProjectsView } from "./views/ProjectsView.js";
import { OverlayTaskView } from "./views/OverlayTaskView.js";
import { ChatOverlay } from "./views/ChatOverlay.js";
import { BreakReminderView } from "./views/BreakReminderView.js";
import { ToolboxView } from "./views/ToolboxView.js";
import { HomeView } from "./views/HomeView.js";
import { HealthView } from "./views/HealthView.js";
import { AppLauncherView } from "./views/AppLauncherView.js";
import { RikingProjectsView } from "./views/RikingProjectsView.js";
import { Lightbox } from "./components/Lightbox.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { AiTaskCapture } from "./components/AiTaskCapture.js";
import { MascotDock } from "./components/MascotDock.js";
import { FloatingTaskDock } from "./components/FloatingTaskDock.js";
import { RichControlCenter, type RichLayoutMode } from "./components/RichControlCenter.js";
import { closeDeliverableCodex, DeliverableCodexLauncher } from "./views/project-management/deliverables/DeliverableCodexLauncher.js";
import { connectServerEvents } from "./lib/serverEvents.js";
import { RICH_NAV_EVENT, RICH_NAV_STORAGE_KEY, type RichNavigationPayload } from "./lib/richNavigation.js";
import { requestShortcutOpen, useShortcutEngine } from "./lib/shortcutEngine.js";

export function App() {
  const [hashRoute, setHashRoute] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, ""),
  );
  useEffect(() => {
    const syncHash = () => setHashRoute(window.location.hash.replace(/^#/, ""));
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  if (hashRoute === "overlay") {
    return <OverlayTaskView />;
  }
  if (hashRoute.startsWith("break-reminder")) return <BreakReminderView />;
  if (hashRoute === "chat") {
    // Tag <html> so global CSS knows this is the transparent chat window.
    document.documentElement.classList.add("is-chat-overlay");
    return (
      <>
        <ErrorBoundary><ChatOverlay /></ErrorBoundary>
        <Lightbox />
      </>
    );
  }

  return <MainApp />;
}

function MainApp() {
  const [controlCenterOpen, setControlCenterOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<RichLayoutMode>(() =>
    window.localStorage.getItem("rich-layout-mode") === "pad" ? "pad" : "desktop",
  );
  const appView = useStore(s => s.appView);
  const rootId = useStore(s => s.rootId);
  const hydrate = useStore(s => s.hydrate);
  const runAutoRetrySweep = useStore(s => s.runAutoRetrySweep);
  const exitToHome = useStore(s => s.exitToHome);
  const setAppView = useStore(s => s.setAppView);
  const enterAtElement = useStore(s => s.enterAtElement);
  const elements = useStore(s => s.elements);
  const projectShortcuts = useMemo(() => Array.from(elements.values())
    .filter(element => element.type === "project" && (element.tags ?? []).includes("project-management"))
    .flatMap(element => {
      const shortcut = (element.content as { shortcut?: string } | null)?.shortcut;
      return shortcut ? [{ id: element.id, shortcut, target: { kind: "project", id: element.id } }] : [];
    }), [elements]);
  useShortcutEngine(projectShortcuts, target => {
    if (target.kind !== "project") return;
    closeDeliverableCodex();
    requestShortcutOpen(target);
    setAppView("projects");
  });
  useEffect(() => { void hydrate(); }, [hydrate]);
  // Subscribe to backend SSE so Hermes-driven (or any server-side) writes
  // re-hydrate the UI within ~500ms. Closed on unmount.
  useEffect(() => connectServerEvents(), []);

  useEffect(() => {
    document.documentElement.dataset.richLayout = layoutMode;
    if (layoutMode !== "fullscreen") window.localStorage.setItem("rich-layout-mode", layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    const toggleControlCenter = () => setControlCenterOpen(open => !open);
    window.addEventListener("rich:toggle-control-center", toggleControlCenter);
    return () => window.removeEventListener("rich:toggle-control-center", toggleControlCenter);
  }, []);

  const changeLayoutMode = (mode: RichLayoutMode) => {
    setLayoutMode(mode);
    (window as Window & { richWindow?: { setLayoutMode?: (nextMode: RichLayoutMode) => void } })
      .richWindow?.setLayoutMode?.(mode);
  };

  useEffect(() => {
      const validViews = new Set(["home", "apps", "tree", "admin", "news", "mindmap", "deepWorkbench", "flowcharts", "deliverables", "greatme", "toolbox", "practice", "taskWorkbench", "aiTaskManagement", "health", "projects", "rikingProjects"]);
    const applyNavigation = (payload: RichNavigationPayload | null) => {
      if (!payload || Date.now() - payload.ts > 30_000) return;
      if (payload.kind === "view" && validViews.has(payload.view)) {
        if (payload.view === "tree") exitToHome();
        setAppView(payload.view);
      } else if (payload.kind === "element" && payload.elementId) {
        void enterAtElement(payload.elementId);
      }
    };
    const onNavigate = (event: Event) => {
      applyNavigation((event as CustomEvent<RichNavigationPayload>).detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== RICH_NAV_STORAGE_KEY || !event.newValue) return;
      try {
        applyNavigation(JSON.parse(event.newValue) as RichNavigationPayload);
      } catch { /* ignore malformed bridge payload */ }
    };
    window.addEventListener(RICH_NAV_EVENT, onNavigate as EventListener);
    window.addEventListener("storage", onStorage);
    try {
      const pending = window.localStorage.getItem(RICH_NAV_STORAGE_KEY);
      if (pending) applyNavigation(JSON.parse(pending) as RichNavigationPayload);
    } catch { /* ignore malformed bridge payload */ }
    return () => {
      window.removeEventListener(RICH_NAV_EVENT, onNavigate as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [enterAtElement, exitToHome, setAppView]);

  // Periodic task-list monitor: every 60s mark stuck-running tasks as error
  // and auto-retry unretried failures. First sweep runs ~5s after mount so
  // any tasks left running from a previous session get triaged promptly.
  useEffect(() => {
    const first = window.setTimeout(() => { void runAutoRetrySweep(); }, 5_000);
    const interval = window.setInterval(() => { void runAutoRetrySweep(); }, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [runAutoRetrySweep]);

  // Global hotkey: Cmd+Esc returns to the home page from ANY view.
  //   - Snaps appView back to "tree" (in case the user was in admin / news /
  //     mindmap) so the home InputView renders once we drop rootId.
  //   - exitToHome() snapshots the current center then clears rootId.
  // Registered at App root so it works regardless of which view is mounted
  // or whether anything else has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        closeDeliverableCodex();
        setAppView("tree");
        exitToHome();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitToHome, setAppView]);

  // 视图切换快捷键：Cmd/Ctrl + 1..9 跳到对应菜单（1=首页，2=应用中心）
  // 单纯 Cmd+N，不带 Shift/Alt，避免跟系统快捷键 / 输入法冲突。
  useEffect(() => {
    type ViewId = "home" | "apps" | "tree" | "news" | "mindmap" | "greatme" | "practice" | "taskWorkbench" | "health" | "toolbox" | "admin";
    const HOTKEYS: Record<string, ViewId> = {
      "1": "home",
      "2": "apps",
      "3": "tree",
      "4": "news",
      "5": "mindmap",
      "6": "greatme",
      "7": "taskWorkbench",
      "8": "health",
      "9": "toolbox",
      "0": "admin",
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey || e.altKey) return;
      const target = HOTKEYS[e.key];
      if (!target) return;
      e.preventDefault();
      closeDeliverableCodex();
      // tree 视图：先 exitToHome 清掉 rootId，让 InputView 渲染（跟 MascotDock 一致）
      if (target === "tree") exitToHome();
      setAppView(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitToHome, setAppView]);

  // 纯 ESC（无 Cmd/Ctrl）—— 从任何子菜单返回"应用中心"。
  // 防误触：在输入框 / dialog / lightbox 等已有自己 ESC 处理的地方不抢。
  // 用 setTimeout(0) 推到事件队列末尾，让子组件自己的 ESC 处理（preventDefault）先跑。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      // 输入框 / 富文本编辑器内的 ESC：只在用户有正在编辑的内容时让步。
      // 空 input 自动 focus（InputView / HealthView 都有）也照常让 ESC 跳走。
      const inputLike = target?.closest?.("input, textarea, [contenteditable='true']") as HTMLElement | null;
      if (inputLike) {
        const value = inputLike.tagName === "INPUT" || inputLike.tagName === "TEXTAREA"
          ? (inputLike as HTMLInputElement | HTMLTextAreaElement).value ?? ""
          : inputLike.textContent ?? "";
        if (value.length > 0) return;        // 用户正在打字 → 让组件自己处理
      }
      // 已经在应用中心了就跳过
      if (useStore.getState().appView === "apps") return;
      // 推迟一帧 —— 让任何 modal / overlay / dropdown 的 ESC 先跑（一般会 preventDefault）
      window.setTimeout(() => {
        if (e.defaultPrevented) return;
        // 二次防御：检查 DOM 里有没有已经打开的 dialog / lightbox / palette / overlay
        if (document.querySelector(
          [
            "[role='dialog']",
            "dialog[open]",
            ".home-history.is-fullscreen",
            ".ke-lightbox",
            ".cmd-palette",
            ".ask-popup",
            ".chd",
            ".home-sel-menu",
            ".prj-drawer-overlay",
          ].join(","),
        )) return;
        setAppView("apps");
      }, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAppView]);

  return (
    <>
      {appView === "admin" && <AdminView />}
      {appView === "news" && <NewsView />}
      {appView === "mindmap" && <MindmapView />}
      {appView === "deepWorkbench" && <ErrorBoundary><DeepWorkbenchView /></ErrorBoundary>}
      {appView === "flowcharts" && <ErrorBoundary><FlowchartsView /></ErrorBoundary>}
      {appView === "deliverables" && <ErrorBoundary><DeliverablesView /></ErrorBoundary>}
      {appView === "greatme" && <GreatMeView />}
      {appView === "practice" && <PracticeView />}
      {appView === "taskWorkbench" && <TaskWorkbench />}
      {appView === "aiTaskManagement" && <AiTaskManagementView />}
      {appView === "projects" && <ErrorBoundary><ProjectsView /></ErrorBoundary>}
      {appView === "toolbox" && <ToolboxView />}
      {appView === "health" && <ErrorBoundary><HealthView /></ErrorBoundary>}
      {appView === "home" && <ErrorBoundary><HomeView /></ErrorBoundary>}
      {appView === "apps" && <ErrorBoundary><AppLauncherView /></ErrorBoundary>}
      {appView === "rikingProjects" && <ErrorBoundary><RikingProjectsView /></ErrorBoundary>}
      {appView === "tree" && (rootId ? <TreeView /> : <InputView />)}
      <Lightbox />
      <CommandPalette />
      <AiTaskCapture />
      <DeliverableCodexLauncher />
      {controlCenterOpen && <RichControlCenter mode={layoutMode} onClose={() => setControlCenterOpen(false)} onModeChange={changeLayoutMode} />}
      {appView === "home" && (
        <>
          <MascotDock />
          <FloatingTaskDock />
        </>
      )}
    </>
  );
}
