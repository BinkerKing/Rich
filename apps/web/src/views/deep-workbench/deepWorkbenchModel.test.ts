import assert from "node:assert/strict";
import test from "node:test";
import { createDeepWorkbenchMap } from "./deepWorkbenchModel.js";

test("new deep workbench map contains only the named root node", () => {
  const map = createDeepWorkbenchMap("支付风控方案", "root-1");

  assert.equal(map.root.data.uid, "root-1");
  assert.equal(map.root.data.text, "支付风控方案");
  assert.deepEqual(map.root.children, []);
  assert.equal(map.layout, "logicalStructure");
  assert.equal(map.theme.id, "neon-violet");
});
