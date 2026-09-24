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

test("有序列表将连续步骤收纳为无底色模块，并用亮白文字和轻边框维持层级", () => {
  assert.match(styles, /\.workflow-rich-content > ol,[\s\S]*?gap:\s*0[\s\S]*?padding:\s*4px 18px[\s\S]*?background:\s*transparent[\s\S]*?border:\s*1px solid rgba\(255, 255, 255, \.28\)[\s\S]*?border-radius:\s*12px/);
  assert.match(styles, /\.workflow-rich-content > ol > li,[\s\S]*?border-bottom:\s*1px solid rgba\(255, 255, 255, \.14\)[\s\S]*?color:\s*#fff[\s\S]*?font-size:\s*16px/);
  assert.match(styles, /\.workflow-rich-content > ol > li:last-child,[\s\S]*?border-bottom:\s*0/);
  assert.match(styles, /\.workflow-rich-content > ol > li::before,[\s\S]*?background:\s*transparent[\s\S]*?border:\s*0[\s\S]*?color:\s*#fff/);
});

test("通用富文本以亮白正文和有呼吸感的标题间距呈现", () => {
  assert.match(styles, /\.workflow-rich-content\s*\{[^}]*--rich-block-gap:\s*14px[^}]*color:\s*#fff[^}]*font-size:\s*16px/s);
  assert.match(styles, /\.workflow-rich-content :is\(p, li, p \*, li \*\),[\s\S]*?color:\s*#fff !important/);
  assert.match(styles, /\.workflow-rich-content h2,[\s\S]*?margin:\s*30px 0 15px[\s\S]*?color:\s*#fff/);
  assert.match(styles, /\.workflow-rich-content h3,[\s\S]*?margin:\s*26px 0 13px[\s\S]*?color:\s*#fff/);
});
