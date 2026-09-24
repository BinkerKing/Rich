import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("首次读取绑定会话时持久化完整的上下文说明卡", () => {
  const source = readFileSync(new URL("./deliverableCodex.ts", import.meta.url), "utf8");
  assert.match(source, /metadata: \{ type: "binding-context", allowedMcpTools: bindingContext\.allowedMcpTools/);
  assert.match(source, /function bindingCardContent/);
});
