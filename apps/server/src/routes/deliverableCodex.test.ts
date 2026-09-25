import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("绑定会话通过统一生命周期持久化说明卡和整体上下文卡", () => {
  const source = readFileSync(new URL("./deliverableCodex.ts", import.meta.url), "utf8");
  assert.match(source, /prepareBoundCodexTurn/);
});
