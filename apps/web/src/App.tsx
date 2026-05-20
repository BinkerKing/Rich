import { useEffect } from "react";
import { useStore } from "./state/store.js";
import { InputView } from "./views/InputView.js";
import { TreeView } from "./views/TreeView.js";
import { AdminView } from "./views/AdminView.js";
import { NewsView } from "./views/NewsView.js";
import { MindmapView } from "./views/MindmapView.js";
import { Lightbox } from "./components/Lightbox.js";
import { CommandPalette } from "./components/CommandPalette.js";

export function App() {
  const appView = useStore(s => s.appView);
  const rootId = useStore(s => s.rootId);
  const hydrate = useStore(s => s.hydrate);
  useEffect(() => { void hydrate(); }, [hydrate]);

  return (
    <>
      {appView === "admin" && <AdminView />}
      {appView === "news" && <NewsView />}
      {appView === "mindmap" && <MindmapView />}
      {appView === "tree" && (rootId ? <TreeView /> : <InputView />)}
      <Lightbox />
      <CommandPalette />
    </>
  );
}
