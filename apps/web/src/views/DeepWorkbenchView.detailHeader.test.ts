import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DeepWorkbenchView.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./DeepWorkbenchView.css", import.meta.url), "utf8");

test("keeps node detail chrome free of redundant labels", () => {
  assert.doesNotMatch(source, /<span>节点详情<\/span>/);
  assert.doesNotMatch(source, /deep-node-detail__label">详情/);
});

test("shows a collapsed node-detail module list with description open by default", () => {
  assert.match(source, /const \[nodeDetailEditing, setNodeDetailEditing\] = useState\(false\);/);
  assert.match(source, /const \[activeDetailSection, setActiveDetailSection\] = useState<DetailSection>\("description"\)/);
  assert.match(source, /<header onDoubleClick=\{onToggle\}>/);
  assert.match(source, /<NodeDetailSection title="说明" open=\{activeDetailSection === "description"\}/);
  assert.match(source, /<NodeDetailSection title="流程图" open=\{activeDetailSection === "flowcharts"\}/);
  assert.match(source, /<NodeDetailSection title="表格数据" open=\{activeDetailSection === "table"\}/);
  assert.match(source, /<NodeDetailSection title="外部文件" open=\{activeDetailSection === "files"\}/);
  assert.match(source, /editing \? <ProjectRichTextEditorInput/);
  assert.match(source, /deep-node-detail__preview workflow-rich-content/);
  assert.match(source, /setActiveDetailSection\("description"\); setNodeDetailEditing\(false\)/);
  assert.match(styles, /deep-node-detail__section/);
  assert.match(styles, /deep-node-detail\.is-fullscreen \.deep-node-detail__body/);
  assert.match(source, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});
