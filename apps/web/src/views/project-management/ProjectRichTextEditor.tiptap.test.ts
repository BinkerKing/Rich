import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modules = readFileSync(new URL("./ProjectManagementModules.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../ProjectsView.css", import.meta.url), "utf8");

test("通用富文本编辑器使用 Tiptap，并保留 HTML 回调和图片上传接口", () => {
  assert.match(modules, /from "@tiptap\/react"/);
  assert.match(modules, /StarterKit/);
  assert.match(modules, /import \{ Code \} from "@tiptap\/extension-code"/);
  assert.match(modules, /const RichInlineCode = Code\.extend\(\{ excludes: "" \}\)/);
  assert.match(modules, /StarterKit\.configure\(\{ heading: \{ levels: \[1, 2, 3\] \}, code: false \}\)/);
  assert.match(modules, /StarterKit\.configure[\s\S]*?RichInlineCode/);
  assert.match(modules, /TextStyle/);
  assert.match(modules, /Color/);
  assert.match(modules, /Highlight/);
  assert.match(modules, /editor\.getHTML\(\)/);
  assert.match(modules, /api\.uploadAttachments/);
  assert.match(modules, /const RICH_FONT_SIZES = \[12, 14, 16, 18, 20, 24, 28, 32\]/);
  assert.match(modules, /aria-label="减小字体"/);
  assert.match(modules, /aria-label="增大字体"/);
  assert.match(modules, /function changeFontSize|const changeFontSize/);
  assert.match(modules, /const selectCurrentTextBlock/);
  assert.match(modules, /editor\.commands\.setTextSelection\(\{ from: \$from\.start\(depth\), to: \$from\.end\(depth\) \}\)/);
  assert.match(modules, /const applyFontFamily/);
  assert.match(modules, /setFontFamily\(fontFamily\)/);
  assert.match(modules, /applyTextStyle\(\{ fontSize: `\$\{nextSize\}px` \}\)/);
  assert.match(modules, /微软雅黑/);
  assert.match(modules, /Songti SC/);
  assert.match(modules, /Kaiti SC/);
  assert.match(modules, /STFangsong/);
  assert.doesNotMatch(modules, /className="prj-pm-rich-toolbar__select is-size"/);
  assert.match(styles, /\.prj-pm-rich-font-size\s*\{[^}]*display:inline-flex[^}]*height:34px/s);
  assert.match(styles, /\.prj-pm-rich-font-size button\s*\{[^}]*display:flex[^}]*align-items:center[^}]*justify-content:center[^}]*padding:0 0 2px/s);
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
  assert.match(styles, /\.workflow-rich-content > ol,[\s\S]*?gap:\s*0[\s\S]*?padding:\s*4px 18px[\s\S]*?background:\s*transparent[\s\S]*?border:\s*2px solid rgba\(255, 255, 255, \.4\)[\s\S]*?border-radius:\s*12px/);
  assert.match(styles, /\.workflow-rich-content > ol > li,[\s\S]*?border-bottom:\s*1px solid rgba\(255, 255, 255, \.14\)[\s\S]*?color:\s*#fff[\s\S]*?font-size:\s*16px[\s\S]*?font-weight:\s*450/);
  assert.match(styles, /\.workflow-rich-content > ol > li:last-child,[\s\S]*?border-bottom:\s*0/);
  assert.match(styles, /\.workflow-rich-content > ol > li::before,[\s\S]*?background:\s*transparent[\s\S]*?border:\s*0/);
  assert.match(styles, /\.workflow-rich-content > ol > li:nth-child\(4n \+ 2\)::before,[\s\S]*?color:\s*#ffcf78/);
});

test("通用富文本以亮白正文和有呼吸感的分级标题呈现", () => {
  assert.match(styles, /\.workflow-rich-content\s*\{[^}]*--rich-block-gap:\s*14px[^}]*color:\s*#fff[^}]*font-size:\s*16px/s);
  assert.match(styles, /\.workflow-rich-content :is\(p, li, p \*, li \*\),[\s\S]*?color:\s*#fff;/);
  assert.match(styles, /\.workflow-rich-content > p,[\s\S]*?font-weight:\s*500/);
  assert.match(styles, /\.workflow-rich-content h1,[\s\S]*?border-left:\s*3px solid #edac57[\s\S]*?color:\s*#ffe4b5/);
  assert.match(styles, /\.workflow-rich-content h2,[\s\S]*?margin:\s*30px 0 15px[\s\S]*?border-left:\s*3px solid #64c8f2[\s\S]*?color:\s*#d9f3ff/);
  assert.match(styles, /\.workflow-rich-content h3,[\s\S]*?margin:\s*26px 0 13px[\s\S]*?border-left:\s*2px solid #66d6a0[\s\S]*?color:\s*#e0ffee/);
  assert.match(styles, /\.workflow-rich-content :is\(h1, h2, h3\) \*,[\s\S]*?color:\s*inherit !important/);
});

test("正文格式保持默认排版，但不覆盖编辑器的字号、加粗和颜色标记", () => {
  assert.doesNotMatch(styles, /\.workflow-rich-content > ol > li :is\(strong, b\),[^}]*font-weight/);
  assert.doesNotMatch(styles, /\.workflow-rich-content :is\(p, li, p \*, li \*\),[^}]*color:\s*#fff !important/);
});
