import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./TestCenterWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./TestCenterWorkspace.css", import.meta.url), "utf8");

test("点击测试任务时展示任务资料而不是仅折叠树节点", () => {
  assert.match(source, /onSelectTask\(group\.id\)/);
  assert.match(source, /任务说明/);
  assert.match(source, /测试数据/);
  assert.match(source, /测试链接/);
  assert.match(source, /应用版本/);
});

test("展开测试动态时在原卡片展示全文", () => {
  assert.match(source, /expandedCommentId/);
  assert.match(source, /aria-expanded/);
  assert.doesNotMatch(source, /test-case-activity__dialog-backdrop/);
});

test("测试任务、分组和用例使用递进的树形缩进", () => {
  assert.match(source, /test-case-execution__case-row--task/);
  assert.match(source, /test-case-execution__case-row--group/);
  assert.match(styles, /test-case-execution__group-row>span:first-child\s*\{[^}]*padding-left:36px/s);
  assert.match(styles, /test-case-execution__case-row--group>span:first-child\s*\{[^}]*padding-left:60px/s);
});

test("测试中心以清晰的实色文字和较大字号呈现信息", () => {
  assert.match(styles, /\.test-case-execution__group-row,\.test-case-execution__case-row\s*\{[^}]*color:#e5eefb[^}]*font-size:15px/s);
  assert.match(styles, /\.test-case-module p,\.test-case-execution__sections p\s*\{[^}]*color:#e5eefb[^}]*font-size:14px/s);
  assert.match(styles, /test-case-activity__timeline.*header strong\s*\{[^}]*color:#f1f7ff[^}]*font-size:14px/s);
});

test("测试动态的时间与内容靠左，更多操作保持紧凑", () => {
  assert.match(styles, /test-case-activity__timeline\s*\{\s*padding:8px 2px/s);
  assert.match(styles, /delivery-dashboard-activity\s*\{\s*grid-template-columns:42px 14px minmax\(0,1fr\)/s);
  assert.match(styles, /delivery-dashboard-activity > time\s*\{\s*text-align:left/s);
  assert.match(styles, /delivery-dashboard-activity header > button\s*\{[^}]*width:20px[^}]*height:20px[^}]*font-size:12px/s);
});

test("层级列表不显示类型列", () => {
  assert.doesNotMatch(source, /<span>类型<\/span>/);
  assert.match(source, /test-case-execution__list-head"><span>测试任务 \/ 分组 \/ 用例<\/span><span>执行状态<\/span>/);
  assert.match(styles, /test-case-execution__list-head,.test-case-execution__group-row,.test-case-execution__case-row\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) 90px/s);
});

test("直属及分组下的用例均可点击查看详情", () => {
  assert.match(source, /test-case-execution__case-row--task[\s\S]*?onClick=\{\(\) => onSelectCase\(item\.id\)\}/);
  assert.match(source, /test-case-execution__case-row--group[\s\S]*?onClick=\{\(\) => onSelectCase\(item\.id\)\}/);
});

test("嵌入项目工作区时不将测试中心上移到顶部导航下方", () => {
  const embeddedWorkspace = styles.match(/\.prj-ws \.delivery\.test-center\s*\{[^}]*\}/s)?.[0] ?? "";
  assert.match(embeddedWorkspace, /height:100%/);
  assert.match(embeddedWorkspace, /margin-top:0/);
  assert.doesNotMatch(embeddedWorkspace, /margin-top:-/);
});

test("测试中心标题使用线性图标，并在项目工作区保持可见", () => {
  assert.match(source, /import \{ FlaskConical \} from "lucide-react"/);
  assert.match(source, /<header className="test-center__masthead"><FlaskConical aria-hidden="true" \/><h1>测试中心<\/h1>\{panel === "cases" && <div className="test-center__case-summary">/);
  assert.match(styles, /\.prj-ws \.delivery\.test-center > \.test-center__masthead\s*\{[^}]*display:flex!important[^}]*min-height:58px/s);
  assert.match(styles, /\.prj-ws \.test-center \.test-case-workbench__header \{ display:none; \}/);
});

test("问题清单以表格占满工作区，不再渲染右侧详情面板", () => {
  const issueWorkspace = source.slice(source.indexOf("function TestIssueExecution"), source.indexOf("function TestCaseActivity"));
  assert.match(issueWorkspace, /test-issue-execution--grid-only/);
  assert.match(issueWorkspace, /ConfigurableDataGrid/);
  assert.doesNotMatch(issueWorkspace, /test-case-execution__detail/);
  assert.doesNotMatch(issueWorkspace, /选中问题详情/);
});
