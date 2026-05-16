import { useStore } from "./state/store.js";
import { InputView } from "./views/InputView.js";
import { TreeView } from "./views/TreeView.js";

export function App() {
  const rootId = useStore(s => s.rootId);
  return rootId ? <TreeView /> : <InputView />;
}