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
  assert.match(view, /放大思维导图/);
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
  assert.match(styles, /\.wd-mindmap-embed figcaption \.wd-mindmap-embed__expand\s*\{[^}]*margin:\s*0 0 0 auto/s);
  assert.match(styles, /\.wd-image-embed img\s*\{[^}]*border:/s);
});

test("工作台目录固定在与正文共用的阅读网格中", () => {
  assert.match(view, /className="wd-reading-layout"/);
  assert.doesNotMatch(view, /sharedScroll/);
  assert.match(styles, /\.wd-reading-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 190px/s);
  assert.match(styles, /\.wd-locator-host\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/s);
});

test("连续序号以无底色模块承载，行间保留轻量分隔和亮白文字", () => {
  assert.match(styles, /\.wd-step-card\s*\{[^}]*gap:\s*0[^}]*padding:\s*4px 18px[^}]*background:\s*transparent[^}]*border:\s*1px solid rgba\(255, 255, 255, 0\.28\)[^}]*border-radius:\s*12px/s);
  assert.match(styles, /\.wd-step-card li\s*\{[^}]*color:\s*#fff[^}]*border-bottom:\s*1px solid rgba\(255, 255, 255, 0\.14\)[^}]*font-size:\s*16\.5px/s);
  assert.match(styles, /\.wd-step-card li:last-child\s*\{[^}]*border-bottom:\s*0/s);
  assert.match(styles, /\.wd-step-card li::before\s*\{[^}]*color:\s*#fff[^}]*background:\s*transparent[^}]*border:\s*0/s);
});

test("工作台标题和正文使用亮白文字，并留出清晰的阅读间距", () => {
  assert.match(styles, /\.wd-card--heading-level-1 h2\s*\{[^}]*margin:\s*64px 0 22px[^}]*color:\s*#fff/s);
  assert.match(styles, /\.wd-card--heading-level-2 h3\s*\{[^}]*margin:\s*44px 0 18px[^}]*color:\s*#fff/s);
  assert.match(styles, /\.wd-card--heading-level-3 h4\s*\{[^}]*margin:\s*34px 0 14px[^}]*color:\s*#fff/s);
  assert.match(styles, /\.wd-card p\s*\{[^}]*color:\s*#fff[^}]*line-height:\s*1\.92/s);
});

test("流程图卡片保留边框并将放大按钮固定在标题栏最右侧", () => {
  assert.match(styles, /\.wd-card--flowchart\s*\{[^}]*border-color:\s*rgba\(4, 189, 214, 0\.32\)/s);
  assert.match(styles, /\.wd-flowchart-drawer__label\s*\{[^}]*width:\s*100%/s);
  assert.match(styles, /\.wd-flowchart-drawer__label\s+\.wd-flowchart-drawer__expand\s*\{[^}]*margin:\s*0 0 0 auto/s);
});
