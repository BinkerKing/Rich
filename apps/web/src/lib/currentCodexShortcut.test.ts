import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./currentCodexShortcut.ts", import.meta.url), "utf8");

test("opens only the current resource's Codex Session", () => {
  assert.match(source, /export function requestCurrentCodexOpen/);
  assert.match(source, /window\.__richOpenCurrentCodex\?\.\(\);/);
  assert.doesNotMatch(source, /dispatchEvent/);
});

test("keeps one handler owned by the currently mounted resource", () => {
  assert.match(source, /window\.__richOpenCurrentCodex = opener/);
  assert.match(source, /window\.__richOpenCurrentCodex === opener/);
});
