import test from "node:test";
import assert from "node:assert/strict";
import { dictionaryTableMarker, dictionaryTableMarkerOptions } from "./DictionaryTableMarker.js";

test("数据表标记只接受预设图标", () => {
  assert.equal(dictionaryTableMarker({ tableMarker: "flag" }), "flag");
  assert.equal(dictionaryTableMarker({ tableMarker: "unknown" }), undefined);
  assert.equal(dictionaryTableMarker(undefined), undefined);
});

test("数据表标记提供可移除的预设图标", () => {
  assert.deepEqual(dictionaryTableMarkerOptions.map(option => option.id), ["star", "flag", "alert", "bookmark", "check", "clock"]);
});
