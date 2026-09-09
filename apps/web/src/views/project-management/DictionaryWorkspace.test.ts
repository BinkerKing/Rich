import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ProjectDictionaryMappingTempTable, ProjectDictionaryTable } from "../../api/client.js";
import { dictionaryTableHasTempTables, dictionaryTableSupportsMapping } from "./DictionaryWorkspace.js";

const source = readFileSync(new URL("./DictionaryWorkspace.tsx", import.meta.url), "utf8");

test("左侧数据字典树只展示标记为使用的表，右侧库表清单保留完整数据", () => {
  assert.match(source, /const getVisibleTreeTables[\s\S]*?\.filter\(dictionaryTableIsInUse\)/);
  assert.match(source, /getVisibleTreeTables\(system\.id\)\.map\(table/);
  assert.match(source, /function dictionaryTableIsInUse[\s\S]*?\["使用", "是", "yes"/);
  assert.match(source, /<DictionarySystemOverview[\s\S]*?tables=\{orderedTables\}/);
});

test("无 Mapping 的表不展示 Mapping 或临时表页签", () => {
  const table = { id: "source-table", hasMapping: false } as ProjectDictionaryTable;
  const tempTables = [{ id: "temp-1" }] as ProjectDictionaryMappingTempTable[];

  assert.equal(dictionaryTableSupportsMapping(table), false);
  assert.equal(dictionaryTableHasTempTables(table, tempTables), false);
});

test("有 Mapping 但无临时表的表仅展示 Mapping 页签", () => {
  const table = { id: "target-table", hasMapping: true } as ProjectDictionaryTable;

  assert.equal(dictionaryTableSupportsMapping(table), true);
  assert.equal(dictionaryTableHasTempTables(table, []), false);
});

test("有 Mapping 且配置临时表的表展示临时表页签", () => {
  const table = { id: "target-table", hasMapping: true } as ProjectDictionaryTable;
  const tempTables = [{ id: "temp-1" }] as ProjectDictionaryMappingTempTable[];

  assert.equal(dictionaryTableHasTempTables(table, tempTables), true);
});
