import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("项目管理内的流程图清单有紧凑标题头和交付物式列表行", () => {
  assert.match(source, /embedded && !expanded && <header className="pfc-project-header">/);
  assert.match(source, /<h1>项目流程图<\/h1>/);
  assert.match(styles, /\.pfc-project-header\s*\{[^}]*min-height:42px/s);
  assert.match(styles, /\.pfc--embedded:not\(:has\(\.pfc-task\.is-expanded\)\) \.pfc-task\s*\{[^}]*min-height:52px[^}]*background:#252525/s);
  assert.match(styles, /\.pfc--embedded:not\(:has\(\.pfc-task\.is-expanded\)\) \.pfc-task:hover\s*\{[^}]*border-color:#424242[^}]*background:#303030[^}]*box-shadow:none/s);
  assert.doesNotMatch(source, /!standalone && <button aria-label="创建流程图任务"/);
});

const source = readFileSync(new URL("./FlowchartsWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./FlowchartsWorkspace.css", import.meta.url), "utf8");

test("流程节点按类型和稳定调色板使用不同的高亮边框", () => {
  assert.match(source, /pfc-node is-\$\{data\.kind\}/);
  assert.match(source, /const palette = \["#63ddeb", "#a98aff", "#f1b968", "#6de2ae"\]/);
  assert.match(styles, /border: 2px solid color-mix\(in srgb,var\(--node-accent\) 82%,#4b5158\)/);
  assert.match(styles, /\.pfc-node\.is-table \{ --node-accent: #70e6ba; \}/);
});
