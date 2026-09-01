import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./ReportsWorkspace.tsx", import.meta.url), "utf8");

test("日报工作台可在摘要和富文本报告之间切换", () => {
  assert.match(source, /const \[showReport, setShowReport\] = useState\(false\)/);
  assert.match(source, /setShowReport\(false\);/);
  assert.match(source, /onClick=\{\(\) => setShowReport\(current => !current\)\}/);
  assert.match(source, /showReport \? "收起报告" : "显示报告"/);
  assert.match(source, /showReport && <section className="report-workbench__editor">/);
  assert.match(source, /<ProjectRichTextEditor projectId=\{`\$\{projectId\}-report-\$\{openId\}`\} value=\{draft\.body\}/);
});

test("今日完成工作按当天任务活动分组展示", () => {
  assert.match(source, /listProjectManagementModuleItems\(projectId, "deliveryPlan", undefined, true\)/);
  assert.match(source, /function todayWorkItems\(items: ProjectModuleItem\[\], date: string\)/);
  assert.match(source, /activity\.kind === "record" \|\| activity\.kind === "reminder" \|\| activity\.kind === "end"/);
  assert.match(source, /\(activity\.kind === "todo" \|\| activity\.kind === "deliverable"\) && activity\.done === true/);
  assert.match(source, /<TodayCompletedWork items=\{todayWork\} \/>/);
  assert.match(source, /今日任务活动/);
});
