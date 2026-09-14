import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("项目管理内的流程图清单有紧凑标题头和交付物式列表行", () => {
  assert.match(source, /embedded && !expanded && <header className="pfc-project-header">/);
  assert.match(source, /<h1>项目流程图<\/h1>/);
  assert.match(source, /<button type="button" disabled=\{busy \|\| !loaded\} onClick=\{\(\) => setCreating\(true\)\}>＋ 新建流程图<\/button>/);
  assert.match(styles, /\.pfc-project-header\s*\{[^}]*min-height:42px/s);
  assert.match(source, /items\.map\(\(item, index\)[\s\S]*?pfc-task-index[\s\S]*?String\(index \+ 1\)\.padStart\(2, "0"\)/);
  assert.match(styles, /\.pfc--embedded:not\(:has\(\.pfc-task\.is-expanded\)\) \.pfc-task\s*\{[^}]*box-sizing:border-box[^}]*height:62px[^}]*min-height:62px[^}]*background:#252525[^}]*box-shadow:inset 0 1px rgba\(255,255,255,.025\)/s);
  assert.match(styles, /\.pfc--embedded:not\(:has\(\.pfc-task\.is-expanded\)\) \.pfc-task-index\s*\{[^}]*width:30px[^}]*height:30px[^}]*font-size:12px/s);
  assert.match(styles, /\.pfc--embedded:not\(:has\(\.pfc-task\.is-expanded\)\) \.pfc-task:hover\s*\{[^}]*border-color:#424242[^}]*background:#303030[^}]*box-shadow:none/s);
  assert.match(styles, /\.pfc--embedded:not\(:has\(\.pfc-task\.is-expanded\)\) \.pfc-task:hover \.pfc-task-title\s*\{[^}]*background:transparent/s);
  assert.doesNotMatch(source, /!standalone && <button aria-label="创建流程图任务"/);
});

test("流程图空状态不重复提供创建入口", () => {
  assert.doesNotMatch(source, /items\.length === 0 \? <div className="pfc-empty">[\s\S]*?<button[\s\S]*?>新建流程图<\/button>/);
});

test("项目流程图记住上次打开的图和列表状态", () => {
  assert.match(source, /const viewKey = `rich-flowchart-view:\$\{projectId \?\? flowchartIds\?\.join\(","\) \?\? "standalone"\}`/);
  assert.match(source, /const view = JSON\.parse\(sessionStorage\.getItem\(viewKey\) \|\| "null"\)/);
  assert.match(source, /setExpanded\(view\?\.expanded === true\)/);
  assert.match(source, /sessionStorage\.setItem\(viewKey, JSON\.stringify\(\{ id: active \?\? null, expanded \}\)\)/);
});

const source = readFileSync(new URL("./FlowchartsWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./FlowchartsWorkspace.css", import.meta.url), "utf8");

test("流程节点按类型和稳定调色板使用不同的高亮边框", () => {
  assert.match(source, /pfc-node is-\$\{data\.kind\}/);
  assert.match(source, /const palette = \["#63ddeb", "#a98aff", "#f1b968", "#6de2ae"\]/);
  assert.match(styles, /border: 2px solid color-mix\(in srgb,var\(--node-accent\) 82%,#4b5158\)/);
  assert.match(styles, /\.pfc-node\.is-table \{ --node-accent: #70e6ba; \}/);
});
