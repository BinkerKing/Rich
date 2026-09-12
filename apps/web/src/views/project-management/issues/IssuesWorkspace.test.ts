import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("问题清单标题头行采用紧凑高度", () => {
  assert.match(styles, /\.issues-workspace\s*\{[^}]*gap:8px[^}]*padding:8px 12px 12px/s);
  assert.match(styles, /\.issues-workspace > header\s*\{[^}]*min-height:42px/s);
});

test("问题清单的列表行采用交付物式紧凑中性卡片", () => {
  assert.match(styles, /\.issues-workspace__list > button\s*\{[^}]*min-height:62px[^}]*padding:15px[^}]*border-color:#424242[^}]*background:#252525[^}]*box-shadow:inset 0 1px rgba\(255,255,255,.025\)/s);
  assert.match(styles, /\.issues-workspace__list \.issues-workspace__list-index\s*\{[^}]*width:30px[^}]*height:30px[^}]*border:1px solid #666[^}]*font-size:12px/s);
  assert.match(styles, /\.issues-workspace__list > button:hover\s*\{[^}]*border-color:#424242[^}]*background:#303030[^}]*box-shadow:none/s);
});

const source = readFileSync(new URL("./IssuesWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./IssuesWorkspace.css", import.meta.url), "utf8");

test("新建问题表通过页面内创建卡收集名称，而不依赖桌面端原生提示框", () => {
  assert.match(source, /const \[creatingTable, setCreatingTable\] = useState\(false\);/);
  assert.match(source, /className="issues-workspace__create"/);
  assert.match(source, /<label>问题表名称<input/);
  assert.doesNotMatch(source, /window\.prompt\("问题表名称"/);
});

test("问题清单操作按钮采用工作台统一的紧凑描边样式", () => {
  assert.match(source, /className="issues-workspace__create-button project-create-action"/);
  assert.match(source, /className="issues-workspace__create-button project-create-action"[\s\S]*?>＋ 新建问题表<\/button>/);
  assert.match(styles, /\.issues-workspace__create-button\s*\{[^}]*min-height:28px[^}]*padding:6px 9px[^}]*border:1px solid #515151[^}]*border-radius:6px[^}]*background:#303030[^}]*font-size:11px/s);
});

test("问题表列表与交付物一致，并可从表格标题返回列表", () => {
  assert.match(source, /tables\.map\(\(table, index\)[\s\S]*?issues-workspace__list-index[\s\S]*?String\(index \+ 1\)\.padStart\(2, "0"\)[\s\S]*?<strong>\{table\.title\}<\/strong>/);
  assert.doesNotMatch(source, /issues-workspace__list-copy|问题表 · \{issues\.length\} 条记录/);
  assert.match(source, /title=\{active\.title\} onBack=\{\(\) => setActiveId\(""\)\}/);
  assert.doesNotMatch(source, /<i>打开 →<\/i>/);
  assert.match(styles, /\.issues-workspace__list > button > strong\s*\{[^}]*color:#eef6ff[^}]*font-size:14px/s);
  assert.doesNotMatch(source, /issues-workspace__table-title/);
});

test("打开问题表时由表格身份区承担唯一标题头行", () => {
  assert.match(source, /className="issues-workspace__editor-shell"[\s\S]*?<IssueDataGrid/);
  assert.doesNotMatch(source, /可使用完整工具栏调整格式、边框、颜色与行列布局/);
  assert.match(styles, /\.issues-workspace__editor-shell\s*\{[^}]*display:grid[^}]*border:1px solid #4c5965[^}]*border-radius:8px/s);
});

test("打开问题表时使用 AG Grid 高级数据表格而非 Excel 编辑器", () => {
  assert.match(source, /import IssueDataGrid from "\.\.\/\.\.\/\.\.\/components\/IssueDataGrid\.js"/);
  assert.match(source, /<IssueDataGrid projectId=\{projectId\} tableId=\{active\.id\} title=\{active\.title\} onBack=\{\(\) => setActiveId\(""\)\} issues=\{issues\} onIssueChange=\{saveIssueChange\} onIssueReorder=\{reorderIssues\} onAddIssue=\{addIssue\} onDeleteIssue=\{deleteIssue\} \/>/);
  assert.match(source, /createTestCenterIssue/);
  assert.match(source, /deleteTestCenterIssue/);
  assert.match(source, /reorderTestCenterIssues/);
  assert.match(source, /onIssueReorder=\{reorderIssues\}/);
  assert.doesNotMatch(source, /UniverIssueSheet|Suspense|lazy\(/);
  assert.doesNotMatch(source, /<ConfigurableDataGrid ariaLabel=\{`\$\{active\.title\} 表格`\}/);
});

test("问题表编辑页只保留标题和可编辑表格，并撑满工作区", () => {
  assert.doesNotMatch(source, /issues-workspace__add-row|listTestCenterCases/);
  assert.match(styles, /\.issues-workspace--editor\s*\{[^}]*height:100%[^}]*box-sizing:border-box/s);
});
