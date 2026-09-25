import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("首次读取绑定会话时持久化说明卡和整体上下文卡", () => {
  const source = readFileSync(new URL("./deliverableCodex.ts", import.meta.url), "utf8");
  assert.match(source, /ensureBoundContextCards/);
  assert.match(source, /boundContextRuntimeInstruction/);
});
