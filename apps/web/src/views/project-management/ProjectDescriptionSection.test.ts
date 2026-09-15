import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./ProjectDescriptionSection.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("./ProjectManagementNavigation.tsx", import.meta.url), "utf8");
const modules = readFileSync(new URL("./ProjectManagementModules.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../ProjectsView.css", import.meta.url), "utf8");
const lightbox = readFileSync(new URL("../../components/Lightbox.tsx", import.meta.url), "utf8");
const tableOfContents = readFileSync(new URL("../../ui/table-of-contents.tsx", import.meta.url), "utf8");
const tailwind = readFileSync(new URL("../../styles/tailwind.css", import.meta.url), "utf8");

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
  assert.match(source, /ScrollArea/);
  assert.match(source, /import \{ FileText, Pencil, Save, X \} from "lucide-react"/);
  assert.match(source, /<ScrollArea className="prj-pm-description__body"/);
  assert.match(source, /<Button variant="secondary" className="prj-pm-description__action gap-1\.5"/);
});

test("项目说明只保留文档数据逻辑，页面框架复用 Rich 组合 UI", () => {
  for (const component of ["PageHeader", "DocumentLayout", "TableOfContents", "EmptyState", "Alert", "Prose", "Skeleton"]) assert.match(source, new RegExp(component));
  assert.match(source, /<PageHeader[\s\S]*title="项目说明"[\s\S]*description="记录项目背景/s);
  assert.match(source, /<Skeleton className="h-\[360px\] w-full"/);
  assert.match(source, /<Alert role="alert">\{error\}<\/Alert>/);
  assert.match(source, /<DocumentLayout aside=\{/);
  assert.match(source, /<TableOfContents items=\{headings\}/);
  assert.match(source, /<Prose ref=\{documentRef\}/);
  assert.match(source, /<EmptyState[\s\S]*title="还没有项目说明"/s);
  assert.doesNotMatch(source, /prj-pm-description__(head|title|actions|reading|toc|document|empty)/);
});

test("项目说明的操作使用明亮文字和透明描边，而非实色填充", () => {
  assert.match(styles, /\.prj-pm-description__action\s*\{[^}]*border:\s*1px solid #51515b[^}]*background:\s*transparent[^}]*color:\s*#f1f1f4/s);
});

test("项目说明在阅读态提供右侧跟随的章节目录", () => {
  assert.match(source, /querySelectorAll<HTMLElement>\("h1, h2, h3"\)/);
  assert.match(source, /<TableOfContents items=\{headings\}/);
  assert.match(source, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(tableOfContents, /sticky top-\[18px\]/);
  assert.match(tableOfContents, /aria-label=\{label\}/);
  assert.match(tableOfContents, /aria-current=\{activeId === item\.id/);
});

test("项目说明以轻量文档工作台呈现，并复用操作层 UI 原语", () => {
  assert.match(source, /import \{ Alert, Badge, Button, DocumentLayout, EmptyState, MetaText, PageHeader, Prose, ScrollArea, Separator, Skeleton, TableOfContents \} from "\.\.\/\.\.\/ui\/index\.js"/);
  assert.doesNotMatch(source, /prj-pm-description__document-card/);
  assert.match(source, /<Badge>项目说明<\/Badge>/);
  assert.match(source, /<Separator className="h-4 w-px" \/>/);
});

test("项目说明工作区自适应窗口并在内部滚动", () => {
  assert.match(styles, /\.prj-pm-description\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.prj-pm-description__body\s*\{[^}]*overflow:\s*auto/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-surface\s*\{[^}]*max-height:\s*none/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-description__body\s*\{[^}]*flex:\s*1 1 auto[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-content\s*\{[^}]*flex:\s*1 1 auto[^}]*min-height:\s*0/s);
  assert.match(styles, /\.prj-pm-description\.is-editing \.prj-pm-rich-surface\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s);
});

test("富文本输入时不通过 React 重建编辑区 DOM，避免光标跳回开头", () => {
  const editorStart = modules.indexOf("export function ProjectRichTextEditor");
  const editorEnd = modules.indexOf("export function normalizeTodoStatus", editorStart);
  const editorSource = modules.slice(editorStart, editorEnd);
  assert.ok(editorStart >= 0 && editorEnd > editorStart);
  assert.doesNotMatch(editorSource, /dangerouslySetInnerHTML/);
});

test("富文本格式变化会立即同步最新 HTML，保存时不会遗漏字体颜色", () => {
  const editorStart = modules.indexOf("export function ProjectRichTextEditor");
  const editorEnd = modules.indexOf("export function normalizeTodoStatus", editorStart);
  const editorSource = modules.slice(editorStart, editorEnd);
  assert.match(editorSource, /onUpdate:\s*\(\{ editor: nextEditor \}\)\s*=>\s*\{[\s\S]*?latestHtmlRef\.current = nextEditor\.getHTML\(\);[\s\S]*?onChangeRef\.current\(latestHtmlRef\.current\);/);
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

test("项目说明以舒展的阅读排版呈现长文", () => {
  assert.match(tailwind, /\.rich-prose\s*\{[^}]*max-width:\s*780px[^}]*font-size:\s*16px[^}]*line-height:\s*1\.95/s);
  assert.match(tailwind, /\.rich-prose > p\s*\{[^}]*margin:\s*0 0 22px[^}]*color:\s*#c4c4cc/s);
  assert.match(tailwind, /\.rich-prose > h2\s*\{[^}]*margin:\s*72px 0 20px[^}]*font-size:\s*26px/s);
  assert.match(tailwind, /\.rich-prose > :is\(ul,ol\)\s*\{[^}]*margin:\s*0 0 26px[^}]*padding-left:\s*1\.45em/s);
  assert.match(tailwind, /\.rich-prose > table\s*\{[^}]*margin:\s*32px 0[^}]*font-size:\s*14px/s);
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
