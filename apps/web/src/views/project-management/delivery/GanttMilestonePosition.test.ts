import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workspace = readFileSync(new URL("./DeliveryWorkspace.tsx", import.meta.url), "utf8");

test("里程碑定位在结束日期的右边界", () => {
  assert.match(workspace, /leftAt\(ganttEndBoundary\(baselineDue\(milestone\)\)\)/);
  assert.match(workspace, /leftAt\(ganttEndBoundary\(baselineDue\(row\)\)\)/);
});

test("甘特图以完成到开始的箭头展示可见任务依赖", () => {
  assert.match(workspace, /const dependencyLinks = visibleRows\.flatMap/);
  assert.match(workspace, /ganttEndBoundary\(baselineDue\(predecessor\)\)/);
  assert.match(workspace, /className="delivery-gantt-split__dependencies"/);
  assert.match(workspace, /markerEnd={`url\(#dependency-arrow/);
});

test("依赖连线层高度与任务行一致，箭头保持紧凑", () => {
  assert.match(workspace, /height={visibleRows\.length \* 38}/);
  assert.match(workspace, /markerWidth="4" markerHeight="4"/);
});
