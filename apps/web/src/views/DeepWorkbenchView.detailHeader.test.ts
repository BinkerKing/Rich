import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DeepWorkbenchView.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./DeepWorkbenchView.css", import.meta.url), "utf8");

test("keeps node detail chrome free of redundant labels", () => {
  assert.doesNotMatch(source, /<span>节点详情<\/span>/);
  assert.doesNotMatch(source, /deep-node-detail__label">详情/);
});

test("renders node detail as a single rich-text editor with the node frame color", () => {
  assert.match(source, /const \[nodeDetailEditing, setNodeDetailEditing\] = useState\(false\);/);
  assert.match(source, /editing \? <ProjectRichTextEditorInput/);
  assert.match(source, /deep-node-detail__preview workflow-rich-content/);
  assert.match(source, /function nodeFrameColor\(/);
  assert.match(source, /"--node-detail-accent": nodeFrameColor/);
  assert.doesNotMatch(source, /FlowchartBindings/);
  assert.doesNotMatch(source, /NodeDetailTableEditor/);
  assert.doesNotMatch(source, /ExternalFileBindings/);
  assert.doesNotMatch(source, /NodeDetailTableOfContents/);
  assert.doesNotMatch(source, /deep-node-detail-document/);
  assert.doesNotMatch(source, /deep-node-detail__richtext-actions/);
  assert.match(source, /className={`deep-node-detail__edit-toggle/);
  assert.match(source, /<EditModeIcon \/>/);
  assert.match(styles, /\.deep-node-detail h2\s*\{[^}]*color:var\(--node-detail-accent\)/s);
  assert.match(styles, /\.deep-node-detail\s*\{[^}]*border:1px solid color-mix\(in srgb,var\(--node-detail-accent\) 58%,transparent\)[^}]*border-left:3px solid var\(--node-detail-accent\)/s);
  assert.match(styles, /\.deep-node-detail>header\s*\{[^}]*border-left:0/s);
});

test("opens a mindmap's bound Codex Session", () => {
  assert.match(source, /import \{ openBoundCodex \} from "\.\/project-management\/deliverables\/DeliverableCodexLauncher\.js";/);
  assert.match(source, /api\.ensureMindmapCodexSession\(active\.id, `\$\{active\.title\} · Codex`\)/);
  assert.match(source, /openBoundCodex\(\{ projectId: "__general__", deliverableId: active\.id, deliverableTitle: active\.title, resourceType: "mindmap", conversationId: session\.conversation\.id \}\)/);
});
