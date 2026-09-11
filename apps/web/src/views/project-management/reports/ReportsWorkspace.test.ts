import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./ReportsWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../ProjectsView.css", import.meta.url), "utf8");

test("新建报告使用项目工作区统一的紧凑描边操作按钮", () => {
  assert.match(source, /className="reports-workspace__create"[\s\S]*?<ReportActionIcon\s*\/>[\s\S]*?<span>新建报告<\/span>/);
  assert.match(styles, /\.reports-workspace__create\s*\{[^}]*min-height:28px[^}]*border:1px solid #515151[^}]*background:#303030/s);
});

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
