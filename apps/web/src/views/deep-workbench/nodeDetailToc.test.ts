import assert from "node:assert/strict";
import test from "node:test";
import { nodeDetailToc } from "./nodeDetailToc.js";

test("node detail TOC keeps the persisted section order", () => {
  assert.deepEqual(nodeDetailToc.map(item => item.id), ["description", "flowcharts", "table", "files"]);
});
