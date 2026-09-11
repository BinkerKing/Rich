import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const componentPath = new URL("./UniverIssueSheet.tsx", import.meta.url);

test("问题表编辑器使用 Univer 的核心预设和工作簿", () => {
  assert.equal(existsSync(componentPath), true, "Univer 问题表组件尚未创建");
  const source = readFileSync(componentPath, "utf8");

  assert.match(source, /UniverSheetsCorePreset/);
  assert.match(source, /createUniver/);
  assert.match(source, /createWorkbook/);
  assert.match(source, /header: false, toolbar: false, formulaBar: false/);
});
