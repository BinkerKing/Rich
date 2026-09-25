import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DeepWorkbenchView.tsx", import.meta.url), "utf8");

test("creates or reopens a dedicated Codex Session for a DeepMindMap", () => {
  assert.match(source, /\/api\/deliverable-codex\/deep-mindmaps\/\$\{encodeURIComponent\(item\.id\)\}\/conversations\/ensure-bound/);
  assert.match(source, /title: `\[DeepMindMap\] \$\{item\.title\} · Codex`/);
  assert.match(source, /openBoundCodex\(\{ projectId: "__general__", deliverableId: item\.id, deliverableTitle: item\.title, resourceType: "deepmindmap", conversationId: session\.id \}\)/);
  assert.doesNotMatch(source, /rich_mindmap_manage/);
});
