import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./ProjectDescriptionSection.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("./ProjectManagementNavigation.tsx", import.meta.url), "utf8");
const modules = readFileSync(new URL("./ProjectManagementModules.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../ProjectsView.css", import.meta.url), "utf8");

test("项目说明是项目管理的第一个菜单", () => {
  const descriptionIndex = navigation.indexOf('id: "description"');
  const dictionaryIndex = navigation.indexOf('id: "dictionary"');
  assert.ok(descriptionIndex >= 0);
  assert.ok(descriptionIndex < dictionaryIndex);
});

test("项目说明使用现有富文本编辑器并显式保存或取消", () => {
  assert.match(source, /ProjectRichTextEditor/);
  assert.match(source, /getProjectDescription/);
  assert.match(source, /saveProjectDescription/);
  assert.match(source, /"保存"/);
  assert.match(source, />取消</);
});

test("项目说明工作区自适应窗口并在内部滚动", () => {
  assert.match(styles, /\.prj-pm-description\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.prj-pm-description__body\s*\{[^}]*overflow:\s*auto/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-surface\s*\{[^}]*max-height:\s*none/s);
});

test("富文本输入时不通过 React 重建编辑区 DOM，避免光标跳回开头", () => {
  const editorStart = modules.indexOf("export function ProjectRichTextEditor");
  const editorEnd = modules.indexOf("export function normalizeTodoStatus", editorStart);
  const editorSource = modules.slice(editorStart, editorEnd);
  assert.ok(editorStart >= 0 && editorEnd > editorStart);
  assert.doesNotMatch(editorSource, /dangerouslySetInnerHTML/);
});

test("项目说明编辑器采用场景手册式的居中内容面板", () => {
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-editor\s*\{[^}]*max-width:\s*1120px[^}]*border-color:\s*rgba\(143,\s*254,\s*247,/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-surface\s*\{[^}]*padding:\s*24px 28px/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-toolbar button\s*\{[^}]*border-radius:\s*999px/s);
});
