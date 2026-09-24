import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./currentCodexShortcut.ts", import.meta.url), "utf8");

test("defines a dedicated event for opening the current resource's Codex Session", () => {
  assert.match(source, /CURRENT_CODEX_OPEN_EVENT = "rich:open-current-codex"/);
  assert.match(source, /export function requestCurrentCodexOpen/);
  assert.match(source, /new Event\(CURRENT_CODEX_OPEN_EVENT\)/);
});

test("routes Cmd+Enter to the single current-resource handler before broadcasting", () => {
  assert.match(source, /if \(window\.__richOpenCurrentCodex\) \{/);
  assert.match(source, /window\.__richOpenCurrentCodex\(\);/);
  assert.match(source, /window\.__richOpenCurrentCodex = opener/);
  assert.match(source, /window\.__richOpenCurrentCodex === opener/);
});
