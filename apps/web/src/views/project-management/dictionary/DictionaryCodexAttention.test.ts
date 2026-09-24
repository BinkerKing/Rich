import test from "node:test";
import assert from "node:assert/strict";
import { dictionaryCodexAttention } from "./DictionaryCodexAttention.js";

test("dictionary Codex attention prioritizes active work and unread replies", () => {
  assert.equal(dictionaryCodexAttention({ running: true, latestAssistantCreatedAt: "2026-09-24T10:00:00.000Z", viewedAt: "2026-09-24T09:59:00.000Z" }), "working");
  assert.equal(dictionaryCodexAttention({ running: false, latestAssistantCreatedAt: "2026-09-24T10:00:00.000Z", viewedAt: "2026-09-24T09:59:00.000Z" }), "unread");
  assert.equal(dictionaryCodexAttention({ running: false, latestAssistantCreatedAt: "2026-09-24T10:00:00.000Z", viewedAt: "2026-09-24T10:01:00.000Z" }), "idle");
});
