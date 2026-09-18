import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const view = readFileSync(new URL("./WorkbenchDocumentView.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./WorkbenchDocumentView.css", import.meta.url), "utf8");

test("工作台文档提供可插入的脑图、表格和图片展示卡片", () => {
  assert.match(view, /插入展示样例/);
  assert.match(view, /function MindmapCard/);
  assert.match(view, /function TableCard/);
  assert.match(view, /function ImageCard/);
  assert.match(styles, /\.wd-mindmap-card/);
  assert.match(styles, /\.wd-table-card/);
  assert.match(styles, /\.wd-image-card/);
});

test("工作台目录固定在与正文共用的阅读网格中", () => {
  assert.match(view, /className="wd-reading-layout"/);
  assert.doesNotMatch(view, /sharedScroll/);
  assert.match(styles, /\.wd-reading-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 190px/s);
  assert.match(styles, /\.wd-locator-host\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/s);
});
