import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./DictionaryWorkspace.tsx", import.meta.url), "utf8");

test("左侧数据字典树只展示标记为使用的表，右侧库表清单保留完整数据", () => {
  assert.match(source, /const getVisibleTreeTables[\s\S]*?\.filter\(dictionaryTableIsInUse\)/);
  assert.match(source, /getVisibleTreeTables\(system\.id\)\.map\(table/);
  assert.match(source, /function dictionaryTableIsInUse[\s\S]*?\["使用", "是", "yes"/);
  assert.match(source, /<DictionarySystemOverview[\s\S]*?tables=\{orderedTables\}/);
});
