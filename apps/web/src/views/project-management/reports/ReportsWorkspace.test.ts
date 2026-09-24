import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./ReportsWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../ProjectsView.css", import.meta.url), "utf8");

test("报告头部操作使用项目工作区统一的紧凑描边图标按钮", () => {
  assert.match(source, /className="reports-workspace__create" aria-label="新建报告"/);
  assert.match(styles, /\.reports-workspace__header-actions \.reports-workspace__create\s*\{[^}]*width:30px[^}]*height:30px[^}]*border:1px solid #515151[^}]*background:#303030/s);
});

test("报告中心在新建报告旁打开与项目绑定的 Codex 会话", () => {
  assert.match(source, /import \{ openBoundCodex \} from "\.\.\/deliverables\/DeliverableCodexLauncher\.js";/);
  assert.match(source, /const openCodexConversation = async \(\) => \{/);
  assert.match(source, /api\.ensureReportCenterCodexSession\(projectId, "报告中心 · Codex"\)/);
  assert.match(source, /resourceType: "report"/);
  assert.match(source, /aria-label="Codex 对话" title="Codex 对话"/);
});

test("报告中心头部操作只展示文档和对话图标", () => {
  assert.match(source, /function ReportHeaderActionIcon\(\{ kind \}: \{ kind: "report" \| "chat" \}\)/);
  assert.match(source, /aria-label="新建报告"[\s\S]*?<ReportHeaderActionIcon kind="report" \/>/);
  assert.match(source, /aria-label="Codex 对话"[\s\S]*?<ReportHeaderActionIcon kind="chat" \/>/);
  assert.doesNotMatch(source, /<span>新建报告<\/span>|<span>Codex<\/span>/);
});

test("新建日报默认进入紧凑驾驶舱，编辑时才展开单栏表单", () => {
  assert.match(source, /await load\(\); setOpenId\(item\.id\); setDraft\(report\); setEditing\(false\);/);
  assert.match(source, /reports-workspace__layout\$\{editing \? " is-editing" : ""\}/);
  assert.match(source, /\{editing && <button className="reports-workspace__detail-action" aria-label=\{busy \? "保存中" : "保存并写入文件"\}/);
  assert.match(styles, /\.reports-workspace__layout\.is-editing \{ grid-template-columns:1fr; \}/);
  assert.match(styles, /\.reports-workspace__layout\.is-editing \.reports-calendar \{ display:none; \}/);
});

test("日报工作台可在摘要和富文本报告之间切换", () => {
  assert.match(source, /const \[showReport, setShowReport\] = useState\(false\)/);
  assert.match(source, /setShowReport\(false\);/);
  assert.match(source, /onClick=\{\(\) => setShowReport\(current => !current\)\}/);
  assert.match(source, /showReport \? "收起报告" : "显示报告"/);
  assert.match(source, /showReport && <section className=\{`report-workbench report-workbench--document is-\$\{draft\.type\}`\}>/);
  assert.match(source, /<ReportDocument report=\{draft\} \/><ReportInsightRail report=\{draft\} \/>/);
  assert.doesNotMatch(source, /showReport && <section className="report-workbench__editor">/);
});

test("日报将日历收纳为日期导航，并使用单一主画布", () => {
  assert.match(source, /function shiftReportDate\(date: string, days: number\)/);
  assert.match(source, /className="reports-workspace__date-nav"/);
  assert.match(source, /setSelectedDate\(date => shiftReportDate\(date, -1\)\)/);
  assert.match(source, /setSelectedDate\(date => shiftReportDate\(date, 1\)\)/);
  assert.doesNotMatch(source, /<aside className="reports-calendar"/);
  assert.match(styles, /\.reports-workspace--daily \.reports-workspace__layout\s*\{[^}]*display:block[^}]*min-height:0/s);
  assert.match(styles, /\.reports-workspace--daily \.reports-workspace__date-nav\s*\{[^}]*display:flex[^}]*align-items:center/s);
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
