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

test("新建问题表按钮采用工作台统一的青绿色主操作样式", () => {
  assert.match(source, /className="issues-workspace__create-button"/);
  assert.match(styles, /\.issues-workspace__create-button\s*\{[^}]*background:linear-gradient\(135deg,#1b928c,#166d6f\)/s);
});

test("打开问题表时使用 Univer 编辑器而非旧的配置表格", () => {
  assert.match(source, /lazy\(\(\) => import\("\.\.\/\.\.\/\.\.\/components\/UniverIssueSheet\.js"\)\)/);
  assert.match(source, /<Suspense fallback=/);
  assert.match(source, /<UniverIssueSheet/);
  assert.doesNotMatch(source, /<ConfigurableDataGrid ariaLabel=\{`\$\{active\.title\} 表格`\}/);
});
