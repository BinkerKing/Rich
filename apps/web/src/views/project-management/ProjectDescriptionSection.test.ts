import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./ProjectDescriptionSection.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("./ProjectManagementNavigation.tsx", import.meta.url), "utf8");
const modules = readFileSync(new URL("./ProjectManagementModules.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../ProjectsView.css", import.meta.url), "utf8");
const lightbox = readFileSync(new URL("../../components/Lightbox.tsx", import.meta.url), "utf8");

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

test("项目说明使用共享 UI 组件和线性图标统一操作样式", () => {
  assert.match(source, /import \{ Button, ScrollArea \} from "\.\.\/\.\.\/ui\/index\.js"/);
  assert.match(source, /import \{ FileText, Pencil, Save, X \} from "lucide-react"/);
  assert.match(source, /<ScrollArea className="prj-pm-description__body">/);
  assert.match(source, /<Button variant="primary"/);
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

test("富文本编辑区可直接粘贴图片并复用附件上传插入图片", () => {
  const editorStart = modules.indexOf("export function ProjectRichTextEditor");
  const editorEnd = modules.indexOf("export function normalizeTodoStatus", editorStart);
  const editorSource = modules.slice(editorStart, editorEnd);
  assert.match(editorSource, /const pastedImages = Array\.from\(event\.clipboardData\.items\).*item\.type\.startsWith\("image\/"\)/s);
  assert.match(editorSource, /void uploadAndInsert\(pastedImages\)/);
  assert.match(editorSource, /<EditorContent[\s\S]*editor=\{editor\}[\s\S]*className="prj-pm-rich-content"[\s\S]*onPaste=/);
});

test("富文本中的图片可点击放大预览", () => {
  assert.match(lightbox, /img && img\.closest\("\.body-section, \.sec-image, \.sec-image-pair, \.workflow-rich-content"\)/);
  assert.match(styles, /\.workflow-rich-content img \{[^}]*cursor:\s*zoom-in/);
});

test("富文本展示态保留编辑时插入的空行", () => {
  assert.match(styles, /\.workflow-rich-content:not\(\.prj-pm-rich-surface\) p:empty,\s*\.workflow-rich-content:not\(\.prj-pm-rich-surface\) p:has\(> br:only-child\)\s*\{[^}]*min-height:\s*1\.7em/s);
});

test("项目说明以中等阅读宽度和中性深色边界呈现文档", () => {
  assert.match(styles, /\.prj-pm-description__document\s*\{[^}]*max-width:\s*840px[^}]*border:\s*1px solid #303038[^}]*background:\s*#151519/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-editor\s*\{[^}]*max-width:\s*840px[^}]*border-color:\s*#4a4a54[^}]*background:\s*#151519/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-toolbar\s*\{[^}]*background:\s*#1b1b20/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-surface\s*\{[^}]*background:\s*#151519/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-surface\s*\{[^}]*padding:\s*28px 36px 40px/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-toolbar button\s*\{[^}]*border-radius:\s*6px/s);
});

test("富文本颜色选择器在窄栏中保留完整色块", () => {
  assert.match(styles, /\.prj-pm-rich-color-palette\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*20px\)/s);
  assert.match(styles, /\.prj-pm-rich-toolbar button\.prj-pm-rich-color-swatch,[\s\S]*?width:\s*20px/s);
});
