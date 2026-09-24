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

test("resource workspaces register the current Codex Session shortcut", () => {
  for (const path of [
    "apps/web/src/views/DeepWorkbenchView.tsx",
    "apps/web/src/views/project-management/flowcharts/FlowchartsWorkspace.tsx",
    "apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx",
    "apps/web/src/views/project-management/DictionaryWorkspace.tsx",
  ]) assert.match(source(path), /useCurrentCodexShortcut/);
});
