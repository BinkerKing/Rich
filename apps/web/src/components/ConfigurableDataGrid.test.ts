import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./ConfigurableDataGrid.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./ConfigurableDataGrid.css", import.meta.url), "utf8");

test("共享表格基于 React Data Grid 并支持受控列配置", () => {
  assert.match(source, /from "react-data-grid"/);
  assert.match(source, /export type ConfigurableGridColumn/);
  assert.match(source, /columns: ConfigurableGridColumn\[\]/);
  assert.match(source, /onColumnsChange/);
});

test("共享表格提供新增行、增加列和冻结列设置", () => {
  assert.match(source, /onAddRow/);
  assert.match(source, /新增记录/);
  assert.match(source, /添加列/);
  assert.match(source, /冻结/);
  assert.match(source, /frozen:/);
  assert.match(source, /draggable: true/);
});

test("共享表格使用适配深色工作台的视觉样式", () => {
  assert.match(styles, /\.configurable-data-grid/);
  assert.match(styles, /--rdg-background-color/);
  assert.match(styles, /\.configurable-data-grid__settings/);
});

test("共享表格默认采用高密度数据表外观，并提供勾选和序号列", () => {
  assert.match(source, /SelectColumn/);
  assert.match(source, /selectedRows/);
  assert.match(source, /key: "__rowNumber"/);
  assert.match(source, /name: "序号"/);
  assert.match(styles, /--rdg-header-row-height: 42px/);
  assert.match(styles, /\.configurable-data-grid__row-number/);
  assert.match(styles, /border-radius: 4px/);
});
