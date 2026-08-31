import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./DeliveryWorkspace.tsx", import.meta.url), "utf8");

test("删除任务下的交付物活动时，同步删除关联的交付物工作台记录", () => {
  assert.match(source, /deletedActivity\?\.kind === "deliverable"/);
  assert.match(source, /const linkedActivityKey = `\$\{task\.id\}:\$\{activityId\}`/);
  assert.match(source, /listProjectManagementModuleItems\(projectId, "deliverables", undefined, true\)/);
  assert.match(source, /deliverable\.content\.linkedActivityKey === linkedActivityKey/);
  assert.match(source, /archiveDeliverableFolder\(projectId, deliverable\.content\.folderPath\)/);
  assert.match(source, /deleteProjectManagementModuleItem\(projectId, deliverable\.id\)/);
});

test("新增交付物时同步创建带任务和交付物编号的目录", () => {
  assert.match(source, /deliverableFolderPath\(taskCode, task\.title, deliverableNumber, activity\.text, deliverablesRoot\)/);
  assert.match(source, /createDeliverableFolder\(projectId, folderPath\)/);
  const start = source.indexOf('if (activity.kind === "deliverable")');
  const mkdir = source.indexOf("await api.createDeliverableFolder(projectId, folderPath)", start);
  const create = source.indexOf('await api.createProjectManagementModuleItem(projectId, "deliverables"', start);
  assert.ok(mkdir >= start && create > mkdir);
});

test("甘特图日历设置与交付计划顶部工具栏同一行", () => {
  assert.match(source, /view === "gantt" && <div className="delivery-gantt-calendar-actions delivery__toolbar-calendar-actions"/);
  assert.doesNotMatch(source, /return <>\s*<div className="delivery-gantt-calendar-actions"/);
});
