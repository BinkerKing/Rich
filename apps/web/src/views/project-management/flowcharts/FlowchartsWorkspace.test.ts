import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./FlowchartsWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./FlowchartsWorkspace.css", import.meta.url), "utf8");

test("流程节点按类型和稳定调色板使用不同的高亮边框", () => {
  assert.match(source, /pfc-node is-\$\{data\.kind\}/);
  assert.match(source, /const palette = \["#63ddeb", "#a98aff", "#f1b968", "#6de2ae"\]/);
  assert.match(styles, /border: 2px solid color-mix\(in srgb,var\(--node-accent\) 82%,#4b5158\)/);
  assert.match(styles, /\.pfc-node\.is-table \{ --node-accent: #70e6ba; \}/);
});
