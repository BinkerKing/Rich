import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./ProjectsView.css", import.meta.url), "utf8");
const workspace = readFileSync(new URL("./ProjectWorkspace.tsx", import.meta.url), "utf8");

test("项目菜单设置按钮保留 44px 的点击热区", () => {
  assert.match(
    styles,
    /\.prj-ws__menu-settings\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s,
  );
});

test("项目管理内容区使用统一石墨灰底色，并通过边框分隔模块", () => {
  assert.match(styles, /--pm-page:\s*#1f1f1f/);
  assert.match(styles, /--pm-surface:\s*#252525/);
  assert.match(styles, /--pm-border:\s*#424242/);
  assert.match(styles, /\.prj-ws__body\s*\{\s*background:\s*var\(--pm-page\)/);
});

test("项目名称固定在工作区左上角，并可双击编辑", () => {
  assert.match(styles, /\.prj-ws__project-title\s*\{[^}]*top:\s*7px[^}]*left:\s*12px[^}]*transform:\s*none/s);
  assert.match(workspace, /startEditingProjectTitle\(\)/);
  assert.match(workspace, /await api\.patchElement\(project\.id, \{ title: nextTitle \}\)/);
});

test("作业流程使用明亮的青蓝边框和高对比信息层级", () => {
  assert.match(styles, /\.workflow-step\s*\{[^}]*border:\s*1px solid #287486[^}]*box-shadow:\s*inset 3px 0 #32d2df/s);
  assert.match(styles, /\.workflow-order\s*\{[^}]*border:\s*1px solid #45dce9/s);
  assert.match(styles, /\.workflow-actions button\s*\{[^}]*border:\s*1px solid #286878/s);
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
