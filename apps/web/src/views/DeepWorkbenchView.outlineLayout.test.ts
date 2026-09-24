import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./DeepWorkbenchView.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./DeepWorkbenchView.css", import.meta.url), "utf8");
const outlineTypes = readFileSync(new URL("../components/outline-editor/types.ts", import.meta.url), "utf8");

test("keeps node details permanently visible beside the outline", () => {
  assert.match(outlineTypes, /onNodeSelect\?: \(nodeId: string\) => void/);
  assert.match(view, /className="deep-outline-workspace"/);
  assert.match(view, /className="deep-outline-workspace__detail"/);
  assert.match(view, /onNodeSelect=\{setOutlineSelectedNodeId\}/);
  assert.doesNotMatch(view, /aria-label="关闭大纲节点详情"/);
  assert.match(styles, /\.deep-outline-workspace\{display:grid;grid-template-columns:minmax\(280px,38%\) minmax\(0,1fr\)/);
});
