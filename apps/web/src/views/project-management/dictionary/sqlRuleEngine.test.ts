import test from "node:test";
import assert from "node:assert/strict";
import type { ProjectDictionaryFieldHit } from "../../../api/client.js";
import {
  convertDictionaryMappingRuleToSql,
  parseDictionaryJsonRuleStrict,
  type DictionaryMappingRule,
} from "./sqlRuleEngine.js";

const targetField = { id: "target-date", fieldName: "parsed_date" } as ProjectDictionaryFieldHit;
const sourceField = {
  id: "source-date",
  tableName: "source_orders",
  fieldName: "report_date",
} as ProjectDictionaryFieldHit;

test("数据字典规则解析器返回可定位的字段错误", () => {
  const parsed = parseDictionaryJsonRuleStrict('{"op":"date_parse","format":"YYYYMMDD"}');
  assert.equal(parsed.rule, undefined);
  assert.match(parsed.error ?? "", /缺少 source/);
});

test("数据字典规则引擎按数据库方言生成日期解析 SQL", () => {
  const rule: DictionaryMappingRule = {
    field: targetField,
    logic: '{"op":"date_parse","source":"source_orders.report_date","from":"YYYYMMDD"}',
    sourceRefs: [{ label: "source_orders.report_date", field: sourceField }],
  };
  assert.deepEqual(convertDictionaryMappingRuleToSql(rule, "postgresql"), {
    status: "complete",
    sql: "TO_DATE(source_orders.report_date, 'YYYYMMDD') AS parsed_date",
  });
  assert.deepEqual(convertDictionaryMappingRuleToSql(rule, "sqlserver"), {
    status: "complete",
    sql: "CONVERT(date, source_orders.report_date, 112) AS parsed_date",
  });
});

test("数据字典规则引擎将拼接分隔符转换为 CONCAT_WS", () => {
  const codeField = { id: "source-code", tableName: "TransactionTab", fieldName: "customerCode" } as ProjectDictionaryFieldHit;
  const referenceField = { id: "source-reference", tableName: "TransactionTab", fieldName: "referenceNumber" } as ProjectDictionaryFieldHit;
  const rule: DictionaryMappingRule = {
    field: { id: "target-remark", fieldName: "remark" } as ProjectDictionaryFieldHit,
    logic: '{"op":"concat","sources":["TransactionTab.customerCode","TransactionTab.referenceNumber"],"delimiter":"|"}',
    sourceRefs: [
      { label: "TransactionTab.customerCode", field: codeField },
      { label: "TransactionTab.referenceNumber", field: referenceField },
    ],
  };

  assert.deepEqual(convertDictionaryMappingRuleToSql(rule, "postgresql"), {
    status: "complete",
    sql: "CONCAT_WS('|', TransactionTab.customerCode, TransactionTab.referenceNumber) AS remark",
  });
});

test("数据字典规则引擎转换复杂临时表动作", () => {
  const codeField = { id: "source-code", tableName: "TransactionTab", fieldName: "customerCode" } as ProjectDictionaryFieldHit;
  const referenceField = { id: "source-reference", tableName: "TransactionTab", fieldName: "referenceNumber" } as ProjectDictionaryFieldHit;
  const amountField = { id: "source-amount", tableName: "TransactionTab", fieldName: "tradeAmount" } as ProjectDictionaryFieldHit;
  const typeField = { id: "source-type", tableName: "CifTab", fieldName: "customerType" } as ProjectDictionaryFieldHit;
  const sourceRefs = [
    { label: "TransactionTab.customerCode", field: codeField },
    { label: "TransactionTab.referenceNumber", field: referenceField },
    { label: "TransactionTab.tradeAmount", field: amountField },
    { label: "CifTab.customerType", field: typeField },
  ];
  const convert = (fieldName: string, logic: string) => convertDictionaryMappingRuleToSql({
    field: { id: `target-${fieldName}`, fieldName } as ProjectDictionaryFieldHit,
    logic,
    sourceRefs,
  }, "postgresql");

  assert.deepEqual(convert("contract_no_segment", '{"op":"split_part","source":"TransactionTab.referenceNumber","delimiter":"-","index":2}'), {
    status: "complete",
    sql: "SPLIT_PART(TransactionTab.referenceNumber, '-', 2) AS contract_no_segment",
  });
  assert.match(convert("contract_no_tail", '{"op":"substring_marker","source":"TransactionTab.referenceNumber","marker":"-","length":16}').sql ?? "", /POSITION\('-' IN TransactionTab\.referenceNumber\)/);
  assert.match(convert("amount_with_fee", '{"op":"round","value":{"op":"multiply","left":{"op":"coalesce_cast","source":"TransactionTab.tradeAmount","emptyAs":"0","to":"NUMERIC"},"right":1.015},"scale":2}').sql ?? "", /ROUND\(\(COALESCE\(NULLIF\(TransactionTab\.tradeAmount, ''\), '0'\)::NUMERIC \* 1\.015\), 2\)/);
  assert.deepEqual(convert("customer_tier", '{"op":"code_mapping","source":"CifTab.customerType","map":{"01":"VIP","02":"VIP","03":"STANDARD"},"else":"OTHER"}'), {
    status: "complete",
    sql: "CASE WHEN CifTab.customerType = '01' THEN 'VIP' WHEN CifTab.customerType = '02' THEN 'VIP' WHEN CifTab.customerType = '03' THEN 'STANDARD' ELSE 'OTHER' END AS customer_tier",
  });
});
