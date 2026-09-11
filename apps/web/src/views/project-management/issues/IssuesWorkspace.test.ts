import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("问题清单标题头行采用紧凑高度", () => {
  assert.match(styles, /\.issues-workspace\s*\{[^}]*gap:8px[^}]*padding:8px 12px 12px/s);
  assert.match(styles, /\.issues-workspace > header\s*\{[^}]*min-height:42px/s);
});

test("问题清单的列表行采用交付物式紧凑中性卡片", () => {
  assert.match(styles, /\.issues-workspace__list > button\s*\{[^}]*min-height:72px[^}]*border-color:#424242[^}]*background:#252525/s);
  assert.match(styles, /\.issues-workspace__list > button:hover\s*\{[^}]*box-shadow:inset 3px 0 #65d1d8/s);
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
  assert.match(source, /className="issues-workspace__create-button"/);
  assert.match(source, /<IssueListIcon\s*\/>\s*<span>新建问题表<\/span>/);
  assert.match(styles, /\.issues-workspace__create-button\s*\{[^}]*min-height:28px[^}]*padding:6px 9px[^}]*border-radius:6px[^}]*font-size:11px/s);
});

test("问题表列表与交付物一致，并可从标题行返回列表", () => {
  assert.match(source, /issues-workspace__list-icon[\s\S]*?<IssueListIcon\s*\/>/);
  assert.match(source, /aria-label="返回问题清单"[\s\S]*?setActiveId\(""\)/);
  assert.doesNotMatch(source, /<i>打开 →<\/i>/);
  assert.match(styles, /\.issues-workspace__list-copy strong\s*\{[^}]*color:#eef2f3[^}]*font-size:14px/s);
  assert.match(styles, /\.issues-workspace__table-title > button::before\s*\{[^}]*content:none/s);
});

test("打开问题表时标题头行采用项目流程图的工作台样式", () => {
  assert.match(source, /className="issues-workspace__editor-shell"[\s\S]*?className="issues-workspace__table-title"/);
  assert.doesNotMatch(source, /可使用完整工具栏调整格式、边框、颜色与行列布局/);
  assert.match(styles, /\.issues-workspace__editor-shell\s*\{[^}]*grid-template-rows:42px minmax\(0,1fr\)[^}]*border:1px solid #4c5965[^}]*border-radius:8px/s);
  assert.match(styles, /\.issues-workspace__table-title\s*\{[^}]*min-height:42px[^}]*border-bottom:1px solid #29292d[^}]*background:#252525/s);
});

test("打开问题表时使用 Univer 编辑器而非旧的配置表格", () => {
  assert.match(source, /lazy\(\(\) => import\("\.\.\/\.\.\/\.\.\/components\/UniverIssueSheet\.js"\)\)/);
  assert.match(source, /<Suspense fallback=/);
  assert.match(source, /<UniverIssueSheet/);
  assert.doesNotMatch(source, /<ConfigurableDataGrid ariaLabel=\{`\$\{active\.title\} 表格`\}/);
});
