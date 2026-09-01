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

test("task command opens the structured promotion panel instead of being sent as prose", () => {
  assert.match(home, /setTaskPanelOpen\(true\)/);
  assert.match(overlay, /setTaskPanelOpen\(true\)/);
  assert.match(home, /ConversationTaskPanel/);
  assert.match(overlay, /ConversationTaskPanel/);
  assert.doesNotMatch(overlay, /if \(\/\^\\\/task\\s\+\\S\/i\.test\(value\)\) return value/);
});

test("save command opens an explicit Rich destination preview", () => {
  assert.match(home, /ConversationSavePanel/);
  assert.match(overlay, /ConversationSavePanel/);
  assert.match(home, /setSavePanelOpen\(true\)/);
  assert.match(overlay, /setSavePanelOpen\(true\)/);
  assert.match(api, /previewConversationSave/);
  assert.match(api, /publishConversationSave/);
});

test("home and overlay send stable ids for durable Agent admission", () => {
  assert.match(home, /clientRequestId:\s*reqId/);
  assert.match(home, /userMessageId:\s*userTurn\.id/);
  assert.match(overlay, /clientRequestId:\s*reqId/);
  assert.match(overlay, /userMessageId:\s*userMsg\.id/);
});
