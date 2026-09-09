import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const preload = readFileSync(new URL("./preload.ts", import.meta.url), "utf8");

test("桌面端暴露交付计划快照导出桥接", () => {
  assert.match(preload, /exportDeliveryPlan: \(payload/);
  assert.match(preload, /ipcRenderer\.invoke\("rich-delivery-plan:export", payload\)/);
  assert.match(main, /ipcMain\.handle\("rich-delivery-plan:export"/);
  assert.match(main, /ganttSheet\.mergeCells\("A1:A2"\)/);
  assert.match(main, /phaseColors = \["FF234A82"/);
  assert.match(main, /item\.kind === "task"/);
  assert.match(main, /ganttSheet\.views = \[\{ state: "frozen", xSplit: 3, ySplit: 2/);
  assert.match(main, /group\.kind !== "group"/);
  assert.match(main, /style: "mediumDashed"/);
  assert.match(main, /"FFB15CFF"/);
  assert.match(main, /argb: "FF6B7280"/);
  assert.match(main, /fill: "FF00A878", border: "FF6EE7B7"/);
  assert.match(main, /const isTaskBar = item\?\.kind === "task"/);
  assert.match(main, /completeDateIndex = taskStartIndex/);
  assert.match(main, /const todayColumn = dates\.indexOf\(gantt\.today\) \+ 4/);
  assert.match(main, /tableSheet\.columns = \[34, 24, 12/);
  assert.match(main, /tableSheet\.autoFilter = \{ from: "A1"/);
  assert.match(main, /fgColor: \{ argb: "FF17365D" \}/);
  assert.match(main, /type\.startsWith\("阶段"\)/);
  assert.match(main, /statusColor = status\.value === "已完成"/);
});

test("甘特图导出将任务的延期区间绘制为独立的延期条", () => {
  assert.match(main, /const delayEnd = typeof item\.dueDate === "string" && item\.dueDate > String\(plannedEnd\)/);
  assert.match(main, /const renderedEnd = delayEnd \|\| plannedEnd/);
  assert.match(main, /const isDelay = Boolean\(delayEnd && date > String\(plannedEnd\)\)/);
  assert.match(main, /pattern: "darkTrellis"/);
});
