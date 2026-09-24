import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");

test("Cmd/Ctrl+Enter dispatches the current-resource Codex request outside editable fields", () => {
  const app = source("apps/web/src/App.tsx");
  assert.match(app, /event\.key !== "Enter"/);
  assert.match(app, /input, textarea, select, \[contenteditable='true'\]/);
  assert.match(app, /requestCurrentCodexOpen\(\)/);
});

test("切换全局视图时不会保留上一页面的 Codex 对话", () => {
  const app = source("apps/web/src/App.tsx");
  assert.match(app, /useEffect\(\(\) => \{\s*closeDeliverableCodex\(\);\s*\}, \[appView\]\);/);
});

test("resource workspaces register the current Codex Session shortcut", () => {
  for (const path of [
    "apps/web/src/views/DeepWorkbenchView.tsx",
    "apps/web/src/views/project-management/flowcharts/FlowchartsWorkspace.tsx",
    "apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx",
    "apps/web/src/views/project-management/DictionaryWorkspace.tsx",
  ]) assert.match(source(path), /useCurrentCodexShortcut/);
});

test("mindmap toolbar exposes the Codex action directly below export", () => {
  const toolbar = source("apps/web/src/components/mindmap/MindmapFloatingToolbar.tsx");
  const workbench = source("apps/web/src/views/DeepWorkbenchView.tsx");
  assert.match(toolbar, /onOpenCodex\(\): void;/);
  assert.ok(toolbar.indexOf(">导出</button>") < toolbar.indexOf(">Codex 对话</button>"));
  assert.match(toolbar, /onClick=\{onOpenCodex\}>Codex 对话<\/button>/);
  assert.match(workbench, /onOpenCodex=\{\(\) => void openCodexConversation\(active\)\}/);
});

test("mindmap toolbar provides a 0–100 drag-speed slider", () => {
  const toolbar = source("apps/web/src/components/mindmap/MindmapFloatingToolbar.tsx");
  assert.match(toolbar, /type="range" min="0" max="100"/);
  assert.match(toolbar, /panSensitivityFromPercent/);
});
