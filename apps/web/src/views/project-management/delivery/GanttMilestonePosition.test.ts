import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workspace = readFileSync(new URL("./DeliveryWorkspace.tsx", import.meta.url), "utf8");

test("里程碑定位在结束日期的右边界", () => {
  assert.match(workspace, /leftAt\(ganttEndBoundary\(baselineDue\(milestone\)\)\)/);
  assert.match(workspace, /leftAt\(ganttEndBoundary\(baselineDue\(row\)\)\)/);
});
