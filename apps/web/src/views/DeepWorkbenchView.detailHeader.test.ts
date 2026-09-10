import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DeepWorkbenchView.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./DeepWorkbenchView.css", import.meta.url), "utf8");

test("keeps node detail chrome free of redundant labels", () => {
  assert.doesNotMatch(source, /<span>节点详情<\/span>/);
  assert.doesNotMatch(source, /deep-node-detail__label">详情/);
});

test("shows node details as a preview until the user chooses to edit", () => {
  assert.match(source, /const \[nodeDetailEditing, setNodeDetailEditing\] = useState\(false\);/);
  assert.match(source, /<h3>说明<\/h3>/);
  assert.match(source, /nodeDetailEditing \? <ProjectRichTextEditorInput/);
  assert.match(source, /deep-node-detail__preview workflow-rich-content/);
  assert.match(source, /setNodeDetailEditing\(false\), \[projectId\]\)/);
  assert.match(styles, /deep-node-detail__description/);
});
