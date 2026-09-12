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

test("字段定义表不显示冗余标题行，并可删除自定义字段", () => {
  assert.doesNotMatch(source, /字段顺序、宽度和显示内容会自动保存/);
  assert.match(source, /<th>操作<\/th>/);
  assert.match(source, /删除字段/);
  assert.match(source, /removeColumn/);
});
