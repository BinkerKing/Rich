import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("新建自由会话不自动插入交付物上下文消息", () => {
  const source = readFileSync(new URL("./deliverableCodex.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /appendMessage\(\{ id: randomUUID\(\), conversationId, role: "system"/);
});
