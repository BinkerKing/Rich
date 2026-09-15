import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./ProjectsView.css", import.meta.url), "utf8");
const workspace = readFileSync(new URL("./ProjectWorkspace.tsx", import.meta.url), "utf8");
const workflow = readFileSync(new URL("./project-management/sections/WorkflowSection.tsx", import.meta.url), "utf8");

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
  assert.match(styles, /\.prj-ws__head\s*\{[^}]*grid-template-rows:\s*36px 54px/s);
  assert.match(styles, /\.prj-ws__head\s*\{[^}]*row-gap:\s*2px[^}]*min-height:\s*100px[^}]*padding:\s*4px 16px 4px 12px/s);
  assert.match(styles, /\.prj-ws\s*\{[^}]*padding:\s*6px 16px 14px 12px/s);
  assert.match(styles, /\.prj-ws__head-row\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*space-between/s);
  assert.match(styles, /\.prj-ws__project-title\s*\{[^}]*position:\s*static[^}]*gap:\s*12px[^}]*height:\s*36px/s);
  assert.match(styles, /\.prj-ws__menu-settings\s*\{[^}]*position:\s*static[^}]*width:\s*28px[^}]*height:\s*28px/s);
  assert.match(styles, /\.prj-ws__nav\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*flex-start/s);
  assert.match(workspace, /startEditingProjectTitle\(\)/);
  assert.match(workspace, /await api\.patchElement\(project\.id, \{ title: nextTitle \}\)/);
});

test("项目名称在顶部具有明确的视觉层级，编辑状态保持一致", () => {
  assert.match(styles, /\.prj-ws__project-title \.prj-ws__title\s*\{[^}]*font-size:\s*25px[^}]*font-weight:\s*700/s);
  assert.match(styles, /\.prj-ws__title-input\s*\{[^}]*font:\s*700 25px\/1\.1 inherit/s);
});

test("项目管理各模块的标题操作区采用统一紧凑行距", () => {
  assert.match(styles, /\.prj-ws \.delivery\s*\{[^}]*padding:8px 12px 14px/s);
  assert.match(styles, /\.prj-ws \.delivery__header\s*\{[^}]*min-height:42px[^}]*margin-bottom:8px/s);
  assert.match(styles, /\.prj-ws \.prj-pm-description__head\s*\{[^}]*min-height:58px[^}]*padding:8px 0 16px/s);
  assert.match(styles, /\.prj-ws :is\(\.prj-pm-dict__hero,[^}]*min-height:58px[^}]*padding:10px 12px/s);
});

test("交付物与报告的标题头行压缩纵向高度", () => {
  assert.match(styles, /\.prj-ws \.deliverables-workspace > header\s*\{[^}]*min-height:42px/s);
  assert.match(styles, /\.prj-ws \.reports-workspace__header\s*\{[^}]*min-height:42px/s);
  assert.match(styles, /\.prj-ws \.reports-workspace__layout\s*\{[^}]*margin-top:8px/s);
});

test("项目菜单使用统一的无底色线条图标", () => {
  assert.match(workspace, /function ProjectMenuIcon\(/);
  assert.match(workspace, /<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"/);
  assert.match(workspace, /<ProjectMenuIcon section=\{s\.id\}\/>/);
  assert.match(styles, /\.prj-ws__nav-icon svg \{[^}]*stroke:\s*currentColor[^}]*stroke-width:\s*1\.8/s);
  assert.match(styles, /\.prj-ws__nav-btn:hover,[\s\S]*?\.prj-ws__nav-btn\.is-active \{[^}]*border-color:\s*#454545[^}]*background:\s*#303030[^}]*box-shadow:\s*none/s);
  assert.match(styles, /\.prj-ws__nav-btn\.is-active \.prj-ws__nav-icon\s*\{[^}]*color:\s*#fff/s);
  assert.doesNotMatch(styles, /\.prj-ws__nav-btn\.is-active \.prj-ws__nav-icon\s*\{[^}]*background:color-mix|\.prj-ws__nav-btn\.is-active \.prj-ws__nav-icon\s*\{[^}]*box-shadow:/s);
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

test("作业流程采用明亮文字、线条图标与透明描边操作", () => {
  assert.match(workflow, /import \{ GitBranch, Plus \} from "lucide-react"/);
  assert.match(workflow, /import \{ Button \} from "\.\.\/\.\.\/\.\.\/ui\/index\.js"/);
  assert.match(workflow, /<div className="workflow__title">[\s\S]*<GitBranch[\s\S]*<h2>作业流程<\/h2>/);
  assert.match(workflow, /<Button variant="secondary" className="workflow__create"[\s\S]*<Plus[\s\S]*新增流程/s);
  assert.doesNotMatch(workflow, /prj-pm-legacy-skin/);
  assert.match(styles, /\.workflow__head\s*\{[^}]*border-bottom:\s*1px solid #303038[^}]*background:\s*transparent/s);
  assert.match(styles, /\.workflow__title > svg\s*\{[^}]*color:\s*#d8d8de/s);
  assert.match(styles, /\.workflow__create\s*\{[^}]*border:\s*1px solid #51515b[^}]*background:\s*transparent[^}]*color:\s*#f1f1f4/s);
  assert.match(styles, /\.workflow-step\s*\{[^}]*grid-template-columns:\s*42px minmax\(0, 1fr\) auto[^}]*border-bottom:\s*1px solid #303038[^}]*background:\s*transparent/s);
  assert.match(styles, /\.workflow-order\s*\{[^}]*border:\s*1px solid #4a4a52[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s);
  assert.match(styles, /\.workflow-actions button\s*\{[^}]*border:\s*0[^}]*background:\s*transparent/s);
});

test("项目管理的场景、环境与部署模块共享明亮的深色工作台层级", () => {
  assert.match(styles, /\.prj-ws \.prj-pm-scenarios-skin\s*\{[^}]*--scenario-text:\s*#f1f1f4[^}]*--scenario-line:\s*#34343c/s);
  assert.match(styles, /\.prj-ws \.scenario-toolbar,\s*\.prj-ws \.env-title-row,\s*\.prj-ws \.deployment-title-row\s*\{[^}]*border-bottom:\s*1px solid #303038[^}]*background:\s*transparent/s);
  assert.match(styles, /\.prj-ws :is\(\.scenario-edit-toggle, \.env-mode-toggle, \.deployment-mode-toggle\)\s*\{[^}]*border:\s*1px solid #51515b[^}]*background:\s*transparent[^}]*color:\s*#f1f1f4/s);
  assert.match(styles, /\.prj-ws \.scenario-index-item\s*\{[^}]*border:\s*0[^}]*border-bottom:\s*1px solid #303038[^}]*background:\s*transparent/s);
  assert.match(styles, /\.prj-ws \.deployment-sidebar,\s*\.prj-ws \.deployment-detail\s*\{[^}]*border-color:\s*#34343c[^}]*background:\s*#202024/s);
});

test("作业流程内容区在可用高度内自适应，超出部分由流程轨道滚动", () => {
  assert.match(styles, /\.workflow-content\s*\{[^}]*display:\s*flex[^}]*flex:\s*1 1 0[^}]*flex-direction:\s*column[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.workflow-rail\s*\{[^}]*flex:\s*1 1 auto[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s);
});

test("环境配置使用紧凑的中性石墨面板，而非彩色发光卡片", () => {
  assert.match(styles, /\.prj-ws \.env-module-card\s*\{[^}]*height:\s*auto[^}]*min-height:\s*0[^}]*border:\s*1px solid #424242[^}]*background:\s*#252525[^}]*box-shadow:\s*none/s);
  assert.match(styles, /\.prj-ws \.server\.env-server-card\s*\{[^}]*height:\s*auto[^}]*min-height:\s*96px[^}]*border:\s*1px solid #4a4a4a[^}]*background:\s*#202020[^}]*box-shadow:\s*none/s);
  assert.match(styles, /\.prj-ws \.env-connection-panel\s*\{[^}]*border:\s*1px solid #424242[^}]*background:\s*#252525[^}]*box-shadow:\s*none/s);
  assert.match(styles, /\.prj-ws \.env-connection-table\s*\{[^}]*border-color:\s*#424242[^}]*background:\s*#202020[^}]*box-shadow:\s*none/s);
});

test("版本控制使用中性深色面板，左栏条目不会因内边距或长文本溢出", () => {
  assert.match(styles, /\.prj-pm-code__head\s*\{[^}]*border:\s*1px solid #424242[^}]*background:\s*#252525/s);
  assert.match(styles, /\.prj-pm-code__apps\s*\{[^}]*min-width:\s*0/s);
  assert.match(styles, /\.prj-pm-code__apps button\s*\{[^}]*box-sizing:\s*border-box[^}]*min-width:\s*0/s);
  assert.match(styles, /\.prj-pm-code__apps button :is\(strong,p\)\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(styles, /\.prj-pm-code-version\s*\{[^}]*border:\s*1px solid #424242[^}]*background:\s*#202020/s);
});
