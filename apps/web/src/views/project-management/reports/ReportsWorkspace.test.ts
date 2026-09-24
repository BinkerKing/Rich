import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./ReportsWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../ProjectsView.css", import.meta.url), "utf8");

test("新建报告使用项目工作区统一的紧凑描边操作按钮", () => {
  assert.match(source, /className="reports-workspace__create"[\s\S]*?<ReportActionIcon\s*\/>[\s\S]*?<span>新建报告<\/span>/);
  assert.match(styles, /\.reports-workspace__create\s*\{[^}]*min-height:28px[^}]*border:1px solid #515151[^}]*background:#303030/s);
});

test("报告中心在新建报告旁打开与项目绑定的 Codex 会话", () => {
  assert.match(source, /import \{ openBoundCodex \} from "\.\.\/deliverables\/DeliverableCodexLauncher\.js";/);
  assert.match(source, /const openCodexConversation = async \(\) => \{/);
  assert.match(source, /api\.ensureReportCenterCodexSession\(projectId, "报告中心 · Codex"\)/);
  assert.match(source, /resourceType: "report"/);
  assert.match(source, /aria-label="Codex 对话" title="Codex 对话"/);
});

test("日报工作台可在摘要和富文本报告之间切换", () => {
  assert.match(source, /const \[showReport, setShowReport\] = useState\(false\)/);
  assert.match(source, /setShowReport\(false\);/);
  assert.match(source, /onClick=\{\(\) => setShowReport\(current => !current\)\}/);
  assert.match(source, /showReport \? "收起报告" : "显示报告"/);
  assert.match(source, /showReport && <section className="report-workbench__editor">/);
  assert.match(source, /<ProjectRichTextEditor projectId=\{`\$\{projectId\}-report-\$\{openId\}`\} value=\{draft\.body\}/);
});

test("打开日报时仅右侧详情区域滚动，日历保持固定", () => {
  assert.match(styles, /\.reports-workspace\s*\{[^}]*display:flex[^}]*flex-direction:column[^}]*overflow:hidden/s);
  assert.match(styles, /\.reports-workspace__layout\s*\{[^}]*flex:1 1 auto[^}]*min-height:0/s);
  assert.match(styles, /\.reports-workspace__working-report \.reports-workspace__detail\s*\{[^}]*overflow:auto/s);
});

test("日报详情操作使用带说明的图标按钮", () => {
  assert.match(source, /className="reports-workspace__detail-action" aria-label=\{showReport \? "收起报告" : "显示报告"\}/);
  assert.match(source, /className="reports-workspace__detail-action" aria-label="编辑报告"/);
  assert.match(source, /className="reports-workspace__detail-action" aria-label=\{busy \? "保存中" : "保存并写入文件"\}/);
  assert.match(source, /<ReportDetailActionIcon kind="preview" \/>/);
  assert.match(source, /<ReportDetailActionIcon kind="edit" \/>/);
  assert.match(source, /<ReportDetailActionIcon kind="save" \/>/);
});

test("今日完成工作按当天任务活动分组展示", () => {
  assert.match(source, /listProjectManagementModuleItems\(projectId, "deliveryPlan", undefined, true\)/);
  assert.match(source, /function todayWorkItems\(items: ProjectModuleItem\[\], date: string\)/);
  assert.match(source, /activity\.kind === "record" \|\| activity\.kind === "reminder" \|\| activity\.kind === "end"/);
  assert.match(source, /\(activity\.kind === "todo" \|\| activity\.kind === "deliverable"\) && activity\.done === true/);
  assert.match(source, /<TodayCompletedWork items=\{todayWork\} \/>/);
  assert.match(source, /今日任务活动/);
});
