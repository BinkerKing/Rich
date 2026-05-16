import { useEffect } from "react";
import { useStore } from "./state/store.js";
import { InputView } from "./views/InputView.js";
import { TreeView } from "./views/TreeView.js";

export function App() {
  const rootId = useStore(s => s.rootId);
  const hydrate = useStore(s => s.hydrate);
  useEffect(() => { void hydrate(); }, [hydrate]);
  return rootId ? <TreeView /> : <InputView />;
}
