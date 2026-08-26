import { describe, expect, it } from "vitest";
import {
  buildDictionaryExtractionProcedureSql,
  buildDictionaryExtractionTempTableSetupSql,
  dictionaryExtractionProcedureParamType,
  formatDictionaryExtractionSelectExpressions,
  resolveDictionaryExtractionRuntimeParamTypes,
} from "../src/services/projectDictionaryEntitySync.js";
import { buildDictionaryExtractionFieldSqlExpression, type DictionaryExtractionSqlContext } from "../src/modules/project-dictionary/sql-engine/expressionCompiler.js";

function expressionContext(dialect: "postgresql" | "sqlserver"): DictionaryExtractionSqlContext {
  const sourceField = { id: "source-field", tableId: "source-table", tableName: "source", fieldName: "amount", fieldType: "numeric", primaryKey: false, required: false, score: 0 };
  const targetField = { id: "target-field", tableId: "target-table", tableName: "target", fieldName: "result", fieldType: "numeric", primaryKey: false, required: false, score: 0 };
  const sourceTable = { id: "source-table", tableName: "source", fieldCount: 1 };
  const targetTable = { id: "target-table", tableName: "target", fieldCount: 1 };
  const sourceTableSources = new Map([["source", {
    table: sourceTable,
    fields: [sourceField],
    columns: [{ columnName: "amount", dataType: "numeric" }],
    alias: "s",
    primary: true,
  }]]);
  return {
    dialect,
    sourceSystem: { id: "system", code: "SYS", name: "系统", fieldCount: 0, tableCount: 1 },
    sourceTable,
    sourceFields: [sourceField],
    sourceColumns: [{ columnName: "amount", dataType: "numeric" }],
    sourceTableSources,
    targetTable,
    targetFields: [targetField],
    targetColumns: [{ columnName: "result", dataType: "numeric" }],
    targetExpressions: new Map(),
    usedAliases: new Set(),
    visiting: new Set(),
  };
}

describe("project dictionary extraction SQL", () => {
  it("places target-field comments after each SELECT expression comma", () => {
    expect(formatDictionaryExtractionSelectExpressions([
      '"TransactionTab"."currency_code" AS "cred_curr_code"',
      'NULL AS "action_type"',
    ], [
      { fieldName: "CredCurrCode", fieldCn: "贷款币种" },
      { fieldName: "ActionType", fieldCn: "动作类型" },
    ])).toBe([
      '       "TransactionTab"."currency_code" AS "cred_curr_code", -- 贷款币种',
      '       NULL AS "action_type" -- 动作类型',
    ].join("\n"));
  });

  it("uses the mapped target field type for procedure parameters", () => {
    const types = resolveDictionaryExtractionRuntimeParamTypes(["importDate", "currentUserBranchCode"], [
      { name: "importDate", type: "DATE", fieldName: "ImportDate" },
      { name: "currentUserBranchCode", type: "VARCHAR(18)", fieldName: "CreditorCode" },
    ], "postgresql");

    expect(dictionaryExtractionProcedureParamType("importDate", types, "postgresql")).toBe("DATE");
    expect(dictionaryExtractionProcedureParamType("currentUserBranchCode", types, "postgresql")).toBe("VARCHAR(18)");
  });

  it("drops all existing PostgreSQL procedure signatures before recreating it", () => {
    const sql = buildDictionaryExtractionProcedureSql({
      system: {
        id: "safe-middle",
        code: "SAFE_MIDDLE",
        name: "中间层",
        fieldCount: 0,
        tableCount: 0,
        connection: { schema: "vtb" },
      },
      table: { id: "cfaca", tableName: "CFACATab", fieldCount: 0 },
      dialect: "postgresql",
      procedureName: "cfaca_tab_extract_test_data",
      bodySql: 'INSERT INTO "vtb"."cfaca_tab" DEFAULT VALUES',
      runtimeParamNames: ["importDate"],
      runtimeParamTypes: { importDate: "DATE" },
    });

    expect(sql).toContain("DO $dictionary_drop_procedure$");
    expect(sql).toContain("WHERE n.nspname = 'vtb' AND p.proname = 'cfaca_tab_extract_test_data' AND p.prokind = 'p'");
    expect(sql).toContain("EXECUTE 'DROP PROCEDURE IF EXISTS ' || procedure_signature;");
    expect(sql).toMatch(/\$dictionary_drop_procedure\$;\nCREATE OR REPLACE PROCEDURE "vtb"\."cfaca_tab_extract_test_data"\(p_importdate DATE\)/);
  });

  it("creates configured temporary tables before the extraction INSERT", () => {
    const setup = buildDictionaryExtractionTempTableSetupSql([{
      id: "temp-1",
      projectId: "project-1",
      targetTableId: "table-1",
      tableName: "tmp_transaction",
      convertedSql: "SELECT transaction_id, amount FROM source_transaction",
      fields: [],
      sortOrder: 0,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    }], "postgresql");
    const sql = buildDictionaryExtractionProcedureSql({
      system: { id: "system-1", code: "SYS", name: "系统", fieldCount: 0, tableCount: 0, connection: { schema: "public" } },
      table: { id: "table-1", tableName: "target", fieldCount: 0 },
      dialect: "postgresql",
      procedureName: "target_extract_test_data",
      bodySql: 'INSERT INTO "public"."target" DEFAULT VALUES',
      setupSql: setup,
      runtimeParamNames: [],
      runtimeParamTypes: {},
    });
    expect(sql).toContain('CREATE TEMP TABLE "tmp_transaction" ON COMMIT DROP AS');
    expect(sql.indexOf('CREATE TEMP TABLE "tmp_transaction"')).toBeLessThan(sql.indexOf('INSERT INTO "public"."target"'));
  });

  it("compiles group aggregates and relative date boundaries as standard Mapping actions", () => {
    const aggregateField = {
      id: "target-field", tableId: "target-table", tableName: "target", fieldName: "result", fieldType: "numeric", primaryKey: false, required: false, score: 0,
      acquireLogic: '{"op":"group_aggregate","aggregate":"sum","source":"source.amount"}',
    };
    expect(buildDictionaryExtractionFieldSqlExpression(aggregateField, expressionContext("postgresql"))).toBe('SUM("s"."amount")');

    const dateField = {
      ...aggregateField,
      acquireLogic: '{"op":"relative_date_boundary","source":"source.amount","unit":"month","offset":-1,"boundary":"end"}',
    };
    expect(buildDictionaryExtractionFieldSqlExpression(dateField, expressionContext("postgresql"))).toContain("INTERVAL '1 month - 1 day'");
  });
});
