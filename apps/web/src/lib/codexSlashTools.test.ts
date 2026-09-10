import assert from "node:assert/strict";
import { test } from "node:test";
import { filterCodexSlashTools, parseCodexSlashInput } from "./codexSlashTools.ts";

test("a leading slash opens the Codex tool list", () => {
  assert.equal(parseCodexSlashInput("/").open, true);
  assert.equal(parseCodexSlashInput("请 / 搜索").open, false);
  assert.equal(parseCodexSlashInput("/\n搜索").open, false);
});

test("slash tools are the composer attachment tools and support Chinese or pinyin", () => {
  assert.deepEqual(filterCodexSlashTools("").map(tool => tool.id), ["image", "location", "location-screenshot", "task-mode"]);
  assert.deepEqual(filterCodexSlashTools("定位").map(tool => tool.id), ["location", "location-screenshot"]);
  assert.deepEqual(filterCodexSlashTools("dingwei").map(tool => tool.id), ["location", "location-screenshot"]);
  assert.deepEqual(filterCodexSlashTools("dwjt").map(tool => tool.id), ["location-screenshot"]);
});
