import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DeepWorkbenchView.tsx", import.meta.url), "utf8");

test("creates an unbound Codex Session for a DeepMindMap", () => {
  assert.match(source, /fetch\("\/api\/deliverable-codex\/deliverables\/__general__\/__general__\/conversations"/);
  assert.match(source, /title: `\[DeepMindMap\] \$\{item\.title\} · Codex`/);
  assert.match(source, /openBoundCodex\(\{ projectId: "__general__", deliverableId: "__general__", deliverableTitle: "通用任务", conversationId: session\.id \}\)/);
  assert.doesNotMatch(source, /ensureMindmapCodexSession/);
});
