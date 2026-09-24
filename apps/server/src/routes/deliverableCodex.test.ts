import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("首次读取绑定会话时复用统一的上下文说明卡", () => {
  const source = readFileSync(new URL("./deliverableCodex.ts", import.meta.url), "utf8");
  assert.match(source, /createBoundContextCard/);
  assert.match(source, /isBoundContextCard/);
});
