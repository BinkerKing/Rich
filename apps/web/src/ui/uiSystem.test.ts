import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

test("Rich UI exposes the common primitive barrel", () => {
  assert.match(source, /export \{ Button \}/);
  assert.match(source, /export \{ Input \}/);
  assert.match(source, /export \{ ScrollArea \}/);
  assert.match(source, /export \{ Dialog \}/);
});
