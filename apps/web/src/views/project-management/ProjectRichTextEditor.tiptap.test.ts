import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modules = readFileSync(new URL("./ProjectManagementModules.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../ProjectsView.css", import.meta.url), "utf8");

test("通用富文本编辑器使用 Tiptap，并保留 HTML 回调和图片上传接口", () => {
  assert.match(modules, /from "@tiptap\/react"/);
  assert.match(modules, /StarterKit/);
  assert.match(modules, /TextStyle/);
  assert.match(modules, /Color/);
  assert.match(modules, /Highlight/);
  assert.match(modules, /editor\.getHTML\(\)/);
  assert.match(modules, /api\.uploadAttachments/);
});

test("项目说明编辑器提供完整的三级标题，并以不同卡片呈现步骤和代码", () => {
  assert.match(modules, /<option value="h1">一级标题<\/option>/);
  assert.match(modules, /<option value="h2">二级标题<\/option>/);
  assert.match(modules, /<option value="h3">三级标题<\/option>/);
  assert.match(styles, /\.workflow-rich-content h1,[\s\S]*?\.prj-pm-rich-surface h1/);
  assert.match(styles, /\.workflow-rich-content ol,[\s\S]*?counter-reset: rich-step/);
  assert.match(styles, /\.workflow-rich-content pre,[\s\S]*?\.workflow-rich-content pre::before/);
});
