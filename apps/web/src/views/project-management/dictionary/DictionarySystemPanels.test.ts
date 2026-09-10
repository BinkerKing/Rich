import test from "node:test";
import assert from "node:assert/strict";
import type { ProjectDictionaryTable } from "../../../api/client.js";
import { sortDictionarySystemSummaryTables } from "./DictionarySystemPanels.js";

test("表清单摘要将已使用且有 Mapping 的表排在最前", () => {
  const tables = [
    { id: "unused", usageStatus: "未使用", hasMapping: false },
    { id: "mapping-only", usageStatus: "未使用", hasMapping: true },
    { id: "used-only", usageStatus: "使用", hasMapping: false },
    { id: "both", usageStatus: "使用", hasMapping: true },
  ] as ProjectDictionaryTable[];

  assert.deepEqual(sortDictionarySystemSummaryTables(tables).map(table => table.id), ["both", "mapping-only", "used-only", "unused"]);
});
