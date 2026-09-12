import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./IssueDataGrid.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./IssueDataGrid.css", import.meta.url), "utf8");

test("问题表使用 AG Grid 并提供搜索、状态筛选和内联编辑", () => {
  assert.match(source, /from "ag-grid-react"/);
  assert.match(source, /placeholder="搜索已设为可检索的字段"/);
  assert.match(source, /cellEditor: column\.fieldType === "select" \? "agSelectCellEditor"/);
  assert.match(source, /onCellValueChanged=/);
});

test("高级问题表格撑满编辑区域并使用紧凑深色工具栏", () => {
  assert.match(styles, /\.issue-data-grid\s*\{[^}]*height:100%[^}]*grid-template-rows:auto minmax\(0,1fr\)/s);
  assert.match(styles, /\.issue-data-grid__toolbar\s*\{[^}]*min-height:48px[^}]*background:#252629/s);
});

test("问题表包含可编辑的项目跟进字段，并记住每张表的列宽", () => {
  assert.match(source, /key: "serial", name: "序号"/);
  assert.match(source, /key: "project", name: "项目"[\s\S]*?editable: true/);
  assert.match(source, /key: "issueType", name: "类型"[\s\S]*?fieldType: "select"/);
  assert.match(source, /key: "module", name: "模块"[\s\S]*?editable: true/);
  assert.match(source, /key: "eta", name: "ETA"[\s\S]*?editable: true/);
  assert.match(source, /key: "progressFollowUp", name: "进度跟进"[\s\S]*?editable: true/);
  assert.match(source, /api\.getTestCenterGridSettings\(projectId, gridSettingsKey\)/);
  assert.match(source, /api\.saveTestCenterGridSettings\(projectId, gridSettingsKey/);
  assert.match(source, /onColumnResized=/);
});

test("问题表提供字段配置器，支持列类型、搜索和样式设置", () => {
  assert.match(source, /表格设置/);
  assert.match(source, /添加字段/);
  assert.match(source, /字段类型/);
  assert.match(source, /参与搜索/);
  assert.match(source, /下拉选项/);
  assert.match(source, /表格样式/);
  assert.match(source, /fieldType: "select"/);
  assert.match(source, /searchable/);
  assert.match(source, /tableStyle/);
});

test("字段设置以表格行展示，并提供日期、勾选和多选类型", () => {
  assert.match(source, /issue-data-grid__field-table/);
  assert.match(source, /<th>字段名称<\/th>/);
  assert.match(source, /<option value="date">日期<\/option>/);
  assert.match(source, /<option value="checkbox">勾选<\/option>/);
  assert.match(source, /<option value="multiSelect">多选下拉<\/option>/);
});

test("下拉选项以所见即所得的可编辑下拉管理", () => {
  assert.match(source, /issue-data-grid__option-editor/);
  assert.match(source, /新增选项/);
  assert.match(source, /删除选项/);
  assert.match(source, /上移选项/);
  assert.match(source, /下移选项/);
  assert.match(source, /dropdownStyle/);
  assert.match(source, /圆角标签/);
  assert.match(source, /强调色块/);
  assert.doesNotMatch(source, /placeholder="每行一个选项"/);
});

test("下拉选项支持继承统一样式或单独覆盖样式", () => {
  assert.match(source, /统一所有选项/);
  assert.match(source, /option\?\.style \?\? dropdownStyle/);
  assert.match(source, /option-content/);
});

test("下拉统一样式和单项样式由同一工具栏编辑", () => {
  assert.match(source, /target: "dropdown"/);
  assert.match(source, /统一所有选项/);
  assert.match(source, /styleSelection\.optionValue/);
  assert.match(source, /下拉样式 ·/);
  assert.doesNotMatch(source, /issue-data-grid__option-style-picker/);
});

test("下拉样式工具保留清晰的最终效果预览", () => {
  assert.match(styles, /\.issue-data-grid__option-editor-menu\s*\{[^}]*width:420px/s);
  assert.match(styles, /\.issue-data-grid__option-row\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/s);
  assert.match(styles, /\.issue-data-grid__toolbar-dropdown-style--soft\s*\{[^}]*background:/s);
});

test("下拉选项在最终样式输入框中直接编辑，工具栏不叠层", () => {
  assert.match(source, /issue-data-grid__option-content/);
  assert.doesNotMatch(source, /issue-data-grid__option-preview/);
  assert.match(styles, /\.issue-data-grid__settings:has\(\.issue-data-grid__dropdown-toolbar\) \.issue-data-grid__style-toolbar\s*\{[^}]*visibility:hidden/s);
});

test("字段定义表不显示冗余标题行，并使用图标删除字段", () => {
  assert.doesNotMatch(source, /字段顺序、宽度和显示内容会自动保存/);
  assert.match(source, /<th>操作<\/th>/);
  assert.match(source, /aria-label="删除字段"/);
  assert.match(source, /issue-data-grid__delete-icon/);
  assert.doesNotMatch(source, />删除字段<\/button>/);
  assert.match(source, /removeColumn/);
  assert.doesNotMatch(source, /\? "隐藏" : "删除字段"/);
  assert.match(source, /deleted: true/);
});

test("字段定义表表头固定，字段样式以真实预览展示", () => {
  assert.match(styles, /\.issue-data-grid__field-table th\s*\{[^}]*position:sticky[^}]*top:0/s);
  assert.match(source, /issue-data-grid__style-preview-button/);
  assert.match(source, /column\.name/);
  assert.match(source, /示例值/);
});

test("字段设置表采用紧凑的数据工作台层级", () => {
  assert.match(styles, /\.issue-data-grid__field-table-wrap\s*\{[^}]*border-radius:10px[^}]*box-shadow:0 12px 28px/s);
  assert.match(styles, /\.issue-data-grid__field-table th\s*\{[^}]*letter-spacing:\.03em/s);
  assert.match(styles, /\.issue-data-grid__field-table td\s*\{[^}]*height:52px/s);
  assert.match(styles, /\.issue-data-grid__style-preview-button\s*\{[^}]*border-radius:6px/s);
});

test("打开字段设置时配置表占满剩余工作区", () => {
  assert.match(styles, /\.issue-data-grid:has\(\.issue-data-grid__settings\)\s*\{[^}]*grid-template-rows:auto minmax\(0,1fr\)/s);
  assert.match(styles, /\.issue-data-grid:has\(\.issue-data-grid__settings\) \.issue-data-grid__table\s*\{[^}]*display:none/s);
  assert.match(styles, /\.issue-data-grid:has\(\.issue-data-grid__settings\) \.issue-data-grid__settings\s*\{[^}]*max-height:none[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/s);
});

test("字段属性可配置表头与单元格样式", () => {
  assert.match(source, /字号/);
  assert.match(source, /文字颜色/);
  assert.match(source, /背景颜色/);
  assert.match(source, /headerStyle/);
  assert.match(source, /cellStyle/);
  assert.match(source, /textAlign/);
});

test("字段样式拆分为标题与内容，并由工具栏即时调整", () => {
  assert.match(source, /<th>标题样式<\/th>/);
  assert.match(source, /<th>内容样式<\/th>/);
  assert.match(source, /styleSelection/);
  assert.match(source, /样式工具栏/);
  assert.match(source, /左对齐/);
  assert.match(source, /居中/);
  assert.match(source, /右对齐/);
  assert.match(source, /issue-data-grid__style-preview-button/);
});

test("字段样式预览与属性面板保持同列宽度", () => {
  assert.match(styles, /\.issue-data-grid__field-table th:nth-child\(4\),\.issue-data-grid__field-table td:nth-child\(4\)\s*\{[^}]*width:190px/s);
  assert.match(styles, /\.issue-data-grid__field-style-preview\s*\{[^}]*width:100%/s);
  assert.match(styles, /\.issue-data-grid__field-style > div\s*\{[^}]*width:190px[^}]*min-width:0/s);
});
