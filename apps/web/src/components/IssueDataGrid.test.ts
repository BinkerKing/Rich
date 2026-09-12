import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./IssueDataGrid.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./IssueDataGrid.css", import.meta.url), "utf8");

test("问题表使用 AG Grid 并提供搜索、状态筛选和内联编辑", () => {
  assert.match(source, /from "ag-grid-react"/);
  assert.match(source, /placeholder="搜索项目、问题或负责人"/);
  assert.match(source, /cellEditor: "agSelectCellEditor"/);
  assert.match(source, /onCellValueChanged=/);
});

test("高级问题表格撑满编辑区域并使用紧凑深色工具栏", () => {
  assert.match(styles, /\.issue-data-grid\s*\{[^}]*height:100%[^}]*grid-template-rows:auto minmax\(0,1fr\)/s);
  assert.match(styles, /\.issue-data-grid__toolbar\s*\{[^}]*min-height:48px[^}]*background:#252629/s);
});

test("问题表包含可编辑的项目跟进字段，并记住每张表的列宽", () => {
  assert.match(source, /field: "serial"[\s\S]*?headerName: "序号"/);
  assert.match(source, /field: "project"[\s\S]*?headerName: "项目"[\s\S]*?editable: true/);
  assert.match(source, /field: "issueType"[\s\S]*?headerName: "类型"[\s\S]*?agSelectCellEditor/);
  assert.match(source, /field: "module"[\s\S]*?headerName: "模块"[\s\S]*?editable: true/);
  assert.match(source, /field: "eta"[\s\S]*?headerName: "ETA"[\s\S]*?editable: true/);
  assert.match(source, /field: "progressFollowUp"[\s\S]*?headerName: "进度跟进"[\s\S]*?editable: true/);
  assert.match(source, /api\.getTestCenterGridSettings\(projectId, gridSettingsKey\)/);
  assert.match(source, /api\.saveTestCenterGridSettings\(projectId, gridSettingsKey/);
  assert.match(source, /onColumnResized=/);
});
