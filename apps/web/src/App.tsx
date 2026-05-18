import { useEffect } from "react";
import { useStore } from "./state/store.js";
import { InputView } from "./views/InputView.js";
import { TreeView } from "./views/TreeView.js";
import { AdminView } from "./views/AdminView.js";
import { Lightbox } from "./components/Lightbox.js";
import { useHashRoute } from "./lib/useHashRoute.js";

export function App() {
  const rootId = useStore(s => s.rootId);
  const hydrate = useStore(s => s.hydrate);
  const hash = useHashRoute();
  useEffect(() => { void hydrate(); }, [hydrate]);
  if (hash === "/admin" || hash === "admin") {
    return (
      <>
        <AdminView />
        <Lightbox />
      </>
    );
  }
  return (
    <>
      {rootId ? <TreeView /> : <InputView />}
      <Lightbox />
    </>
  );
}
