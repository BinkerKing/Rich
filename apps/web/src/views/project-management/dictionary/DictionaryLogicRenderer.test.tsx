import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProjectDictionaryFieldHit } from "../../../api/client.js";
import { renderDictionaryLogicWithRefs } from "./DictionaryLogicRenderer.js";

const refs = [
  { label: "TransactionTab.referenceNumber", field: { id: "reference", tableName: "TransactionTab", fieldName: "referenceNumber" } as ProjectDictionaryFieldHit },
  { label: "TransactionTab.tradeAmount", field: { id: "amount", tableName: "TransactionTab", fieldName: "tradeAmount" } as ProjectDictionaryFieldHit },
  { label: "CifTab.customerType", field: { id: "type", tableName: "CifTab", fieldName: "customerType" } as ProjectDictionaryFieldHit },
];

function display(logic: string): string {
  return renderToStaticMarkup(renderDictionaryLogicWithRefs(logic, refs, () => {}));
}

test("复杂标准动作在共用逻辑渲染器中可读展示", () => {
  assert.match(display('{"op":"split_part","source":"TransactionTab.referenceNumber","delimiter":"-","index":2}'), /分隔取段[\s\S]*分隔符 -[\s\S]*第 2 段/);
  assert.match(display('{"op":"substring_marker","source":"TransactionTab.referenceNumber","marker":"-","length":16}'), /标记截取[\s\S]*第一次出现位置开始截取 16 位/);
  assert.match(display('{"op":"round","value":{"op":"multiply","left":{"op":"coalesce_cast","source":"TransactionTab.tradeAmount","emptyAs":"0","to":"NUMERIC"},"right":1.015},"scale":2}'), /四舍五入[\s\S]*ROUND\([\s\S]*空值按 0 后转 NUMERIC[\s\S]*\* 1\.015, 2\)/);
  assert.match(display('{"op":"code_mapping","source":"CifTab.customerType","map":{"01":"VIP","02":"VIP"},"else":"OTHER"}'), /码值映射[\s\S]*01-&gt;VIP[\s\S]*否则 OTHER/);
});
