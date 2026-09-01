import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const home = readFileSync(new URL("./HomeView.tsx", import.meta.url), "utf8");
const overlay = readFileSync(new URL("./ChatOverlay.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../api/client.ts", import.meta.url), "utf8");

test("home and overlay use the shared slash command menu", () => {
  assert.match(home, /ChatSlashCommandMenu/);
  assert.match(overlay, /ChatSlashCommandMenu/);
  assert.match(home, /parseChatSlashInput\(input\)/);
});

test("agent commands change session state instead of being sent as chat text", () => {
  assert.match(home, /startAgentSession/);
  assert.match(home, /exitAgentSession/);
  assert.match(home, /agent-session-marker/);
  assert.match(api, /startAgentSession/);
  assert.match(api, /newAgentSession/);
  assert.match(api, /exitAgentSession/);
});

test("task prefix remains a sendable structured-task instruction", () => {
  assert.match(overlay, /if \(\/\^\\\/task\\s\+\\S\/i\.test\(value\)\) return value/);
});

test("home and overlay send stable ids for durable Agent admission", () => {
  assert.match(home, /clientRequestId:\s*reqId/);
  assert.match(home, /userMessageId:\s*userTurn\.id/);
  assert.match(overlay, /clientRequestId:\s*reqId/);
  assert.match(overlay, /userMessageId:\s*userMsg\.id/);
});
