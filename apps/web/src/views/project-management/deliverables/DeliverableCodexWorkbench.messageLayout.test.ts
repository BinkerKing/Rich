import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");

test("用户消息靠右显示为气泡，Codex 回复保持无气泡的清晰正文", () => {
  assert.match(css, /article\.is-user\s*\{[\s\S]*?justify-self:end;[\s\S]*?margin-left:auto;[\s\S]*?background:/);
  assert.match(css, /article\.is-assistant\s*\{[\s\S]*?background:transparent;[\s\S]*?border:0;/);
  assert.match(css, /article\.is-assistant p\s*\{[\s\S]*?color:#f0f1f3;[\s\S]*?font-size:18px;[\s\S]*?font-weight:500;[\s\S]*?text-shadow:none;/);
});
