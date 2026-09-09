import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DeepWorkbenchView.tsx", import.meta.url), "utf8");

test("keeps node detail chrome free of redundant labels", () => {
  assert.doesNotMatch(source, /<span>节点详情<\/span>/);
  assert.doesNotMatch(source, /deep-node-detail__label">详情/);
});
