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
