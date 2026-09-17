import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./CollaborativeWorkspaceShell.tsx", import.meta.url), "utf8");

test("协作壳只拥有左右两个业务槽位，并在窄屏允许聚焦对话", () => {
  assert.match(source, /information: ReactNode/);
  assert.match(source, /conversation: ReactNode/);
  assert.match(source, /setConversationFocused/);
  assert.match(source, /collaborative-workspace--conversation-focused/);
});
