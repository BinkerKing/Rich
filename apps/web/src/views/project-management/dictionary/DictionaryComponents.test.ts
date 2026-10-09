import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ProjectDictionaryFieldHit, ProjectDictionaryTable } from "../../../api/client.js";
import { buildDictionaryMappingScenarios } from "./DictionaryComponents.js";

test("字段设计移除未渲染的外部 SQL 列，并在属性查看器高亮 SQL", () => {
  const source = readFileSync(new URL("./DictionaryComponents.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source.slice(source.indexOf("function DictionaryFieldGrid"), source.indexOf("export function DictionaryMappingPanel")), /id: "externalSql"/);
  assert.match(source, /<SqlSyntaxHighlight sql=\{payload\.value \|\| "-"\} \/>/);
});

test("Mapping 字段行直接展示外部 SQL，不使用查看按钮", () => {
  const source = readFileSync(new URL("./DictionaryComponents.tsx", import.meta.url), "utf8");
  const mappingPanel = source.slice(source.indexOf("export function DictionaryMappingPanel"), source.indexOf("type DictionaryCaliberView"));

  assert.match(mappingPanel, /<td className="prj-pm-dict-mapping-table__external-sql">\s*<pre><SqlSyntaxHighlight sql=\{rule\.externalSql \|\| "-"\} \/><\/pre>\s*<\/td>/);
  assert.doesNotMatch(mappingPanel, /<ExternalSqlButton title="字段 Mapping 外部 SQL"/);
});

test("公共 Mapping 规则继承到每个显式场景，不生成默认场景页签", () => {
  const scenarios = buildDictionaryMappingScenarios(
    { id: "fae-base", tableName: "FAEBaseInfo", caliber: "结售汇基础信息" } as ProjectDictionaryTable,
    [
      {
        id: "jsh-flag",
        fieldName: "jshFlag",
        acquireLogic: [
          "场景1 JSH结汇",
          '逻辑：{"op":"literal","value":"1"}',
          "场景2 JSH购汇",
          '逻辑：{"op":"literal","value":"2"}',
        ].join("\n"),
      } as ProjectDictionaryFieldHit,
      {
        id: "report-date",
        fieldName: "reportDate",
        acquireLogic: '{"op":"param","name":"dataDate"}',
      } as ProjectDictionaryFieldHit,
    ],
    new Map(),
  );

  assert.deepEqual(scenarios.map(scenario => scenario.title), ["场景1 JSH结汇", "场景2 JSH购汇"]);
  assert.deepEqual(scenarios.map(scenario => scenario.rules.length), [2, 2]);
  assert.equal(scenarios[0]?.rules[1]?.logic, '{"op":"param","name":"dataDate"}');
  assert.equal(scenarios[1]?.rules[1]?.logic, '{"op":"param","name":"dataDate"}');
});

test("字段中的默认场景不会生成页签，并按场景编号作为兜底规则", () => {
  const scenarios = buildDictionaryMappingScenarios(
    { id: "fae-base", tableName: "FAEBaseInfo", caliber: "结售汇基础信息" } as ProjectDictionaryTable,
    [
      {
        id: "action-type",
        fieldName: "actionType",
        acquireLogic: [
          "场景1 JSH结汇",
          '逻辑：{"op":"literal","value":"JSH"}',
          "场景2 JSH购汇",
          '逻辑：{"op":"literal","value":"GSH"}',
        ].join("\n"),
      } as ProjectDictionaryFieldHit,
      {
        id: "branch-id",
        fieldName: "branchId",
        acquireLogic: [
          "场景1 默认场景",
          '逻辑：{"op":"default","value":10001}',
          "场景2 默认场景",
          '逻辑：{"op":"default","value":10002}',
        ].join("\n"),
      } as ProjectDictionaryFieldHit,
    ],
    new Map(),
  );

  assert.deepEqual(scenarios.map(scenario => scenario.title), ["场景1 JSH结汇", "场景2 JSH购汇"]);
  assert.equal(scenarios[0]?.rules[1]?.logic, '{"op":"default","value":10001}');
  assert.equal(scenarios[1]?.rules[1]?.logic, '{"op":"default","value":10002}');
});
