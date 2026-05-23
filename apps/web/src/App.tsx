import { useEffect, useState } from "react";
import { useStore } from "./state/store.js";
import { InputView } from "./views/InputView.js";
import { TreeView } from "./views/TreeView.js";
import { AdminView } from "./views/AdminView.js";
import { NewsView } from "./views/NewsView.js";
import { MindmapView } from "./views/MindmapView.js";
import { GreatMeView } from "./views/GreatMeView.js";
import { OverlayTaskView } from "./views/OverlayTaskView.js";
import { ChatOverlay } from "./views/ChatOverlay.js";
import { ToolboxView } from "./views/ToolboxView.js";
import { HomeView } from "./views/HomeView.js";
import { Lightbox } from "./components/Lightbox.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { MascotDock } from "./components/MascotDock.js";
import { FloatingTaskDock } from "./components/FloatingTaskDock.js";
import { connectServerEvents } from "./lib/serverEvents.js";

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
  if (hashRoute === "chat") {
    // Tag <html> so global CSS knows this is the transparent chat window.
    document.documentElement.classList.add("is-chat-overlay");
    return <ChatOverlay />;
  }

  return <MainApp />;
}

function MainApp() {
  const appView = useStore(s => s.appView);
  const rootId = useStore(s => s.rootId);
  const hydrate = useStore(s => s.hydrate);
  const runAutoRetrySweep = useStore(s => s.runAutoRetrySweep);
  const exitToHome = useStore(s => s.exitToHome);
  const setAppView = useStore(s => s.setAppView);
  useEffect(() => { void hydrate(); }, [hydrate]);
  // Subscribe to backend SSE so Hermes-driven (or any server-side) writes
  // re-hydrate the UI within ~500ms. Closed on unmount.
  useEffect(() => connectServerEvents(), []);
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
        setAppView("tree");
        exitToHome();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitToHome, setAppView]);

  return (
    <>
      {appView === "admin" && <AdminView />}
      {appView === "news" && <NewsView />}
      {appView === "mindmap" && <MindmapView />}
      {appView === "greatme" && <GreatMeView />}
      {appView === "toolbox" && <ToolboxView />}
      {appView === "home" && <HomeView />}
      {appView === "tree" && (rootId ? <TreeView /> : <InputView />)}
      <Lightbox />
      <CommandPalette />
      <MascotDock />
      <FloatingTaskDock />
    </>
  );
}
