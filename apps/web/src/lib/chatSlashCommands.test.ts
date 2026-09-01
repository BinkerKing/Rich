import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAT_SLASH_COMMANDS, parseChatSlashInput } from "./chatSlashCommands.js";

test("slash menu exposes Rich chat, Hermes Agent, task, save, and find modes", () => {
  assert.deepEqual(CHAT_SLASH_COMMANDS.map(command => command.id), ["chat", "agent", "task", "save", "find"]);
  assert.equal(parseChatSlashInput("/").open, true);
  assert.deepEqual(parseChatSlashInput("/ag").matches.map(command => command.id), ["agent"]);
});

test("agent new is parsed as a command with an argument", () => {
  assert.deepEqual(parseChatSlashInput("/agent new").selected, { command: "agent", argument: "new" });
});

test("ordinary prose does not open the slash menu", () => {
  assert.equal(parseChatSlashInput("帮我开发一个小程序").open, false);
});
