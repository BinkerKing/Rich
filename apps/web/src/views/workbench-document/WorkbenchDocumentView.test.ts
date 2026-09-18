import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const view = readFileSync(new URL("./WorkbenchDocumentView.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./WorkbenchDocumentView.css", import.meta.url), "utf8");

test("工作台文档提供可插入的脑图、表格和图片展示卡片", () => {
  assert.match(view, /插入展示样例/);
  assert.match(view, /function MindmapDrawer/);
  assert.match(view, /MindmapCanvas data=\{mindmap\.map\.root/);
  assert.match(view, /fitOnResize/);
  assert.match(view, /function TableCard/);
  assert.match(view, /function ImageCard/);
  assert.match(view, /ConfigurableDataGrid/);
  assert.match(view, /deepWorkbenchId/);
  assert.doesNotMatch(view, /function MindmapCard/);
  assert.doesNotMatch(view, /<table>/);
  assert.match(styles, /\.wd-card--bare\s*\{[^}]*border-color:\s*transparent/s);
  assert.match(styles, /\.wd-table-embed\s*\{[^}]*overflow:\s*visible/s);
  assert.match(styles, /\.wd-table-embed \.configurable-data-grid__grid\s*\{[^}]*height:\s*360px/s);
  assert.match(styles, /\.wd-mindmap-embed__canvas\s*\{[^}]*height:\s*460px/s);
  assert.match(styles, /\.wd-mindmap-embed__canvas\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(styles, /\.wd-image-embed img\s*\{[^}]*border:/s);
});

test("工作台目录固定在与正文共用的阅读网格中", () => {
  assert.match(view, /className="wd-reading-layout"/);
  assert.doesNotMatch(view, /sharedScroll/);
  assert.match(styles, /\.wd-reading-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 190px/s);
  assert.match(styles, /\.wd-locator-host\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/s);
});

test("流程图卡片保留边框并将放大按钮固定在标题栏最右侧", () => {
  assert.match(styles, /\.wd-card--flowchart\s*\{[^}]*border-color:\s*rgba\(4, 189, 214, 0\.32\)/s);
  assert.match(styles, /\.wd-flowchart-drawer__label\s*\{[^}]*width:\s*100%/s);
  assert.match(styles, /\.wd-flowchart-drawer__label\s+\.wd-flowchart-drawer__expand\s*\{[^}]*margin:\s*0 0 0 auto/s);
});
