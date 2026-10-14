import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./FlowchartsView.css", import.meta.url), "utf8");

test("流程图列表只将图标缩为状态点，保留标题文字尺寸", () => {
  assert.match(styles, /\.pfc--standalone \.pfc-task-title > \.pfc-list-icon\s*\{[^}]*width:7px[^}]*font-size:0/s);
  assert.doesNotMatch(styles, /\.pfc--standalone \.pfc-task-title span\s*\{[^}]*font-size:0/s);
});
