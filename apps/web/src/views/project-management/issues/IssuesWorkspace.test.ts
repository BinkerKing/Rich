import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  assert.match(source, /import \{ UniverIssueSheet \} from "\.\.\/\.\.\/\.\.\/components\/UniverIssueSheet\.js"/);
  assert.match(source, /<UniverIssueSheet/);
  assert.doesNotMatch(source, /<ConfigurableDataGrid ariaLabel=\{`\$\{active\.title\} 表格`\}/);
});
