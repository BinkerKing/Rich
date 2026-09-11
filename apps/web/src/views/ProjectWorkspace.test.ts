import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./ProjectsView.css", import.meta.url), "utf8");
const workspace = readFileSync(new URL("./ProjectWorkspace.tsx", import.meta.url), "utf8");

test("项目菜单设置按钮与标题行保持紧凑一致", () => {
  assert.match(
    styles,
    /\.prj-ws__menu-settings\s*\{[^}]*width:\s*28px[^}]*height:\s*28px/s,
  );
});

test("项目管理内容区使用统一石墨灰底色，并通过边框分隔模块", () => {
  assert.match(styles, /--pm-page:\s*#1f1f1f/);
  assert.match(styles, /--pm-surface:\s*#252525/);
  assert.match(styles, /--pm-border:\s*#424242/);
  assert.match(styles, /\.prj-ws__body\s*\{\s*background:\s*var\(--pm-page\)/);
});

test("项目工作区标题与导航贴近顶部左边线并使用同一对齐基准", () => {
  assert.match(workspace, /<div className="prj-ws__head-row">[\s\S]*prj-ws__project-title[\s\S]*prj-ws__menu-settings/s);
  assert.match(styles, /\.prj-ws__head\s*\{[^}]*grid-template-rows:\s*28px 54px/s);
  assert.match(styles, /\.prj-ws__head\s*\{[^}]*row-gap:\s*2px[^}]*min-height:\s*92px[^}]*padding:\s*4px 16px 4px 12px/s);
  assert.match(styles, /\.prj-ws\s*\{[^}]*padding:\s*6px 16px 14px 12px/s);
  assert.match(styles, /\.prj-ws__head-row\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*space-between/s);
  assert.match(styles, /\.prj-ws__project-title\s*\{[^}]*position:\s*static[^}]*height:\s*28px/s);
  assert.match(styles, /\.prj-ws__menu-settings\s*\{[^}]*position:\s*static[^}]*width:\s*28px[^}]*height:\s*28px/s);
  assert.match(styles, /\.prj-ws__nav\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*flex-start/s);
  assert.match(workspace, /startEditingProjectTitle\(\)/);
  assert.match(workspace, /await api\.patchElement\(project\.id, \{ title: nextTitle \}\)/);
});

test("项目菜单使用统一的无底色线条图标", () => {
  assert.match(workspace, /function ProjectMenuIcon\(/);
  assert.match(workspace, /<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"/);
  assert.match(workspace, /<ProjectMenuIcon section=\{s\.id\}\/>/);
  assert.match(styles, /\.prj-ws__nav-icon svg \{[^}]*stroke:\s*currentColor[^}]*stroke-width:\s*1\.8/s);
  assert.match(styles, /\.prj-ws__nav-btn\.is-active \{[^}]*border-color:\s*transparent[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s);
  assert.match(styles, /\.prj-ws__nav-btn\.is-active \.prj-ws__nav-icon\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--nav-tone\) 18%, transparent\)[^}]*box-shadow:[^}]*0 0 12px var\(--nav-glow\)/s);
});

test("项目菜单整行支持连续横向拖动与滚轮滚动", () => {
  assert.match(workspace, /const menuNavRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(workspace, /onPointerDown=\{startMenuNavDrag\}[\s\S]*onPointerMove=\{moveMenuNavDrag\}[\s\S]*onWheel=\{scrollMenuNav\}/);
  assert.match(workspace, /menuNavSkipClickRef\.current/);
  assert.match(workspace, /dragging: boolean/);
  assert.match(workspace, /Math\.abs\(distance\) < 12/);
  assert.match(workspace, /drag\.dragging = true;[\s\S]*setPointerCapture\(event\.pointerId\)/);
  assert.doesNotMatch(workspace, /startScrollLeft: nav\.scrollLeft, dragging: false \};\s*nav\.setPointerCapture/);
  assert.match(styles, /\.prj-ws__nav\s*\{[^}]*-webkit-app-region:\s*no-drag[^}]*touch-action:\s*pan-y/s);
  assert.match(styles, /\.prj-ws__nav\.is-dragging\s*\{[^}]*cursor:\s*grabbing/s);
});

test("项目菜单首次展示时完整显示最左侧菜单项", () => {
  assert.doesNotMatch(workspace, /scrollLeft = 24/);
  assert.match(workspace, /<nav ref=\{menuNavRef\}/);
});

test("作业流程以黑白外框和内嵌彩色细线呈现", () => {
  assert.match(styles, /\.workflow\.prj-pm-legacy-skin \.panel\s*\{[^}]*border-color:\s*#505050[^}]*background:\s*#252525/s);
  assert.match(styles, /\.workflow-step\s*\{[^}]*border:\s*1px solid #505050[^}]*background:\s*#252525[^}]*box-shadow:\s*inset 3px 0 #52c7cc/s);
  assert.match(styles, /\.workflow-order\s*\{[^}]*border:\s*1px solid #9a9a9a[^}]*background:\s*#202020[^}]*inset 0 0 0 1px rgba\(82, 199, 204, \.55\)/s);
  assert.match(styles, /\.workflow-actions button\s*\{[^}]*border:\s*1px solid #4f4f4f[^}]*background:\s*#202020/s);
});

test("环境配置用亮色边框区分模块、服务器和连接关系表", () => {
  assert.match(styles, /\.env-module-card\s*\{[^}]*border-color:\s*color-mix\(in srgb, var\(--env-module-accent, var\(--accent\)\) 78%, #3a4b4e\)/s);
  assert.match(styles, /\.server\.env-server-card\s*\{[^}]*border:\s*1px solid color-mix\(in srgb, var\(--env-module-accent, var\(--accent\)\) 54%, #344044\)/s);
  assert.match(styles, /\.env-connection-table\s*\{[^}]*border:\s*1px solid #338e99/s);
});

test("版本控制以紫色模块边框和青蓝版本卡片保持可读对比", () => {
  assert.match(styles, /\.prj-pm-code__head\s*\{[^}]*border:\s*1px solid #7557ad[^}]*background:\s*linear-gradient\(105deg, #28242d/s);
  assert.match(styles, /\.prj-pm-code__apps button\.is-active\s*\{[^}]*border-color:\s*#8170c7/s);
  assert.match(styles, /\.prj-pm-code-version\s*\{[^}]*border:\s*1px solid #347f88[^}]*inset 3px 0 #3ad3da/s);
});
