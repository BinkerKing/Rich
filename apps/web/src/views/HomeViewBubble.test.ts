import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("./HomeView.css", import.meta.url), "utf8");

test("首页上一条提问气泡使用灰底和高亮白字", () => {
  assert.match(css, /\.home-corner-bubble \{[\s\S]*?background: #292c31;[\s\S]*?font-size: 16px;[\s\S]*?color: #f7f8fa;/);
  assert.match(css, /\.home-corner-bubble__name \{[\s\S]*?color: #fff;[\s\S]*?font-weight: 700;/);
  assert.doesNotMatch(css, /home-corner-bubble-pulse/);
});
