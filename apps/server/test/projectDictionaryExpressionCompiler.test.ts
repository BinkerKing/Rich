import { describe, expect, it } from "vitest";
import {
  buildDictionaryExtractionConditionSql,
  buildDictionaryExtractionFieldSqlExpression,
  coerceDictionaryExtractionExpressionForTarget,
  isDictionaryExtractionTableRef,
  isSupportedDictionaryExtractionOp,
  type DictionaryExtractionSqlContext,
  type DictionaryExtractionSqlTableSource,
} from "../src/modules/project-dictionary/sql-engine/expressionCompiler.js";
import type { ProjectDictionaryFieldDetail, ProjectDictionarySystem, ProjectDictionaryTable } from "../src/repos/ProjectManagementRepo.js";

function createContext(dialect: "postgresql" | "sqlserver"): DictionaryExtractionSqlContext {
  const sourceTable = { id: "source", tableName: "source_orders" } as ProjectDictionaryTable;
  const targetTable = { id: "target", tableName: "target_orders" } as ProjectDictionaryTable;
  const sourceFields = [{ id: "source-date", fieldName: "report_date" }] as ProjectDictionaryFieldDetail[];
  const source: DictionaryExtractionSqlTableSource = {
    table: sourceTable,
    fields: sourceFields,
    columns: [{ columnName: "report_date", dataType: "varchar", nullable: true }],
    alias: "s",
    primary: true,
  };
  return {
    dialect,
    sourceSystem: {} as ProjectDictionarySystem,
    sourceTable,
    sourceFields,
    sourceColumns: source.columns,
    sourceTableSources: new Map([["__primary__", source], ["sourceorders", source]]),
    targetTable,
    targetFields: [],
    targetColumns: [],
    targetExpressions: new Map(),
    usedAliases: new Set(["s"]),
    runtimeParams: { reportDate: "2026-08-24" },
    visiting: new Set(),
  };
}

describe("project dictionary expression compiler", () => {
  it("compiles a direct field reference with dialect quoting", () => {
    const field = {
      id: "target-date",
      fieldName: "report_date",
      acquireLogic: '{"op":"direct","source":"source_orders.report_date"}',
    } as ProjectDictionaryFieldDetail;
    expect(buildDictionaryExtractionFieldSqlExpression(field, createContext("postgresql"))).toBe('"s"."report_date"');
    expect(buildDictionaryExtractionFieldSqlExpression(field, createContext("sqlserver"))).toBe('[s].[report_date]');
  });

  it("compiles runtime parameters as dialect-safe literals", () => {
    const field = {
      id: "runtime-date",
      fieldName: "report_date",
      acquireLogic: '{"op":"param","name":"reportDate"}',
    } as ProjectDictionaryFieldDetail;
    expect(buildDictionaryExtractionFieldSqlExpression(field, createContext("postgresql"))).toBe("'2026-08-24'");
    expect(buildDictionaryExtractionFieldSqlExpression(field, createContext("sqlserver"))).toBe("'2026-08-24'");
  });

  it("keeps concat delimiters in generated SQL", () => {
    const field = {
      id: "remark",
      fieldName: "remark",
      acquireLogic: '{"op":"concat","sources":["source_orders.report_date","source_orders.report_date"],"delimiter":"|"}',
    } as ProjectDictionaryFieldDetail;

    expect(buildDictionaryExtractionFieldSqlExpression(field, createContext("postgresql")))
      .toBe("CONCAT_WS('|', \"s\".\"report_date\", \"s\".\"report_date\")");
    expect(buildDictionaryExtractionFieldSqlExpression(field, createContext("sqlserver")))
      .toBe("CONCAT_WS('|', [s].[report_date], [s].[report_date])");
  });

  it("converts blank numeric source values to NULL before casting", () => {
    const field = { id: "amount", fieldName: "amount", fieldType: "decimal", fieldLength: "22,2" } as ProjectDictionaryFieldDetail;
    const column = { columnName: "amount", dataType: "numeric", numericPrecision: 22, numericScale: 2, nullable: true };

    expect(coerceDictionaryExtractionExpressionForTarget('"s"."amount"', field, column, "postgresql"))
      .toBe('CAST(NULLIF(BTRIM(("s"."amount")::text), \'\') AS NUMERIC(22,2))');
    expect(coerceDictionaryExtractionExpressionForTarget("[s].[amount]", field, column, "sqlserver"))
      .toBe("CAST(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), [s].[amount]))), '') AS NUMERIC(22,2))");
  });

  it("converts blank values to NULL for an explicit numeric cast rule", () => {
    const field = {
      id: "rate",
      fieldName: "rate",
      acquireLogic: '{"op":"cast","source":"source_orders.report_date","to":"DECIMAL(18,8)"}',
    } as ProjectDictionaryFieldDetail;

    expect(buildDictionaryExtractionFieldSqlExpression(field, createContext("postgresql")))
      .toBe('CAST(NULLIF(BTRIM(("s"."report_date")::text), \'\') AS DECIMAL(18,8))');
    expect(buildDictionaryExtractionFieldSqlExpression(field, createContext("sqlserver")))
      .toBe("CAST(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), [s].[report_date]))), '') AS DECIMAL(18,8))");
  });

  it("uses a text fallback before converting a text source to numeric", () => {
    const field = {
      id: "amount",
      fieldName: "amount",
      acquireLogic: '{"op":"coalesce_cast","source":"source_orders.report_date","emptyAs":"0","to":"NUMERIC"}',
    } as ProjectDictionaryFieldDetail;

    expect(buildDictionaryExtractionFieldSqlExpression(field, createContext("postgresql")))
      .toBe('COALESCE(NULLIF("s"."report_date", \'\'), \'0\')::NUMERIC');
  });

  it("prefers a registered join table over recursive target-field resolution", () => {
    const primaryTable = { id: "cif", tableName: "CifTab" } as ProjectDictionaryTable;
    const targetTable = { id: "customer", tableName: "Customer" } as ProjectDictionaryTable;
    const primaryFields = [{ id: "cif-customer", fieldName: "customerId" }] as ProjectDictionaryFieldDetail[];
    const targetFields = [{
      id: "customer-bank-code",
      fieldName: "bankCustomerCode",
      acquireLogic: '{"op":"direct","source":"CifTab.customerId"}',
    }] as ProjectDictionaryFieldDetail[];
    const primarySource: DictionaryExtractionSqlTableSource = {
      table: primaryTable,
      fields: primaryFields,
      columns: [{ columnName: "customer_id", dataType: "varchar", nullable: true }],
      alias: "CifTab",
      primary: true,
    };
    const customerSource: DictionaryExtractionSqlTableSource = {
      table: targetTable,
      fields: targetFields,
      columns: [{ columnName: "bank_customer_code", dataType: "varchar", nullable: true }],
      alias: "Customer",
    };
    const context: DictionaryExtractionSqlContext = {
      dialect: "postgresql",
      sourceSystem: {} as ProjectDictionarySystem,
      sourceTable: primaryTable,
      sourceFields: primaryFields,
      sourceColumns: primarySource.columns,
      sourceTableSources: new Map([
        ["__primary__", primarySource],
        ["ciftab", primarySource],
        ["customer", customerSource],
      ]),
      targetTable,
      targetFields,
      targetColumns: customerSource.columns,
      targetExpressions: new Map(),
      usedAliases: new Set(["CifTab", "Customer"]),
      visiting: new Set(),
    };

    expect(buildDictionaryExtractionConditionSql(
      { source: "CifTab.customerId", eq: { source: "Customer.bankCustomerCode" } },
      targetFields[0],
      context,
    )).toBe('"CifTab"."customer_id" = "Customer"."bank_customer_code"');
    expect(buildDictionaryExtractionConditionSql(
      { source: "Customer.bankCustomerCode", eq: null },
      targetFields[0],
      context,
    )).toBe('"Customer"."bank_customer_code" IS NULL');
  });

  it("uses a registered join field's type when coercing a runtime parameter", () => {
    const sourceTable = { id: "source", tableName: "source_orders" } as ProjectDictionaryTable;
    const targetTable = { id: "customer", tableName: "Customer" } as ProjectDictionaryTable;
    const source: DictionaryExtractionSqlTableSource = {
      table: sourceTable,
      fields: [{ id: "source-customer", fieldName: "customerId" }] as ProjectDictionaryFieldDetail[],
      columns: [{ columnName: "customer_id", dataType: "varchar", nullable: true }],
      alias: "s",
      primary: true,
    };
    const customer: DictionaryExtractionSqlTableSource = {
      table: targetTable,
      fields: [{ id: "customer-date", fieldName: "businessDate" }] as ProjectDictionaryFieldDetail[],
      columns: [{ columnName: "business_date", dataType: "date", nullable: true }],
      alias: "Customer",
    };
    const context: DictionaryExtractionSqlContext = {
      ...createContext("postgresql"),
      sourceTable,
      sourceFields: source.fields,
      sourceColumns: source.columns,
      sourceTableSources: new Map([
        ["__primary__", source],
        ["sourceorders", source],
        ["customer", customer],
      ]),
      targetTable,
      targetFields: [{ id: "target-date", fieldName: "businessDate" }] as ProjectDictionaryFieldDetail[],
      targetColumns: [{ columnName: "business_date", dataType: "varchar", nullable: true }],
      runtimeParams: { cutoffDate: "2026-08-24" },
      usedAliases: new Set(["s", "Customer"]),
    };

    const sql = buildDictionaryExtractionConditionSql(
      { source: "Customer.businessDate", eq: { op: "param", name: "cutoffDate" } },
      context.targetFields[0],
      context,
    );
    expect(sql).toContain('"Customer"."business_date" = CASE WHEN');
    expect(sql).toContain("TO_DATE(('2026-08-24')::text, 'YYYYMMDD')");
  });

  it("does not treat a target table's source-file annotation as its own alias", () => {
    const targetTable = {
      id: "transaction-tab",
      tableName: "TransactionTab",
      extra: { sourceFile: "TRN2.TXT" },
    } as ProjectDictionaryTable;

    expect(isDictionaryExtractionTableRef("TRN2.TXT", targetTable)).toBe(false);
  });

  it("compiles required lookup as a nullable joined value; procedure prechecks enforce required matches", () => {
    const context = createContext("postgresql");
    const txCode = {
      table: { id: "tx-code", tableName: "TxCode" } as ProjectDictionaryTable,
      fields: [{ id: "tx-code-id", fieldName: "Id" }] as ProjectDictionaryFieldDetail[],
      columns: [{ columnName: "Id", dataType: "integer", nullable: false }],
      alias: "x",
    } satisfies DictionaryExtractionSqlTableSource;
    const sourceFields = [{ id: "bop-code", fieldName: "bopTxCode" }] as ProjectDictionaryFieldDetail[];
    const sourceColumns = [{ columnName: "bop_tx_code", dataType: "varchar", nullable: true }];
    context.sourceFields = sourceFields;
    context.sourceColumns = sourceColumns;
    const primarySource = context.sourceTableSources.get("__primary__")!;
    primarySource.fields = sourceFields;
    primarySource.columns = sourceColumns;
    context.targetColumns = [{ columnName: "tx_code_id", dataType: "integer", nullable: true }];
    context.sourceTableSources.set("txcode", txCode);
    context.usedAliases.add("x");
    const field = {
      id: "tx-code-id",
      fieldName: "TxCodeId",
      fieldType: "integer",
      acquireLogic: '{"op":"required_lookup","source":"bopTxCode","lookup":"TxCode.Id"}',
    } as ProjectDictionaryFieldDetail;

    expect(isSupportedDictionaryExtractionOp("required_lookup")).toBe(true);
    expect(buildDictionaryExtractionFieldSqlExpression(field, context)).toBe(
      'CASE WHEN "s"."bop_tx_code" IS NOT NULL AND ("s"."bop_tx_code")::text <> \'\' THEN "x"."Id" ELSE NULL END',
    );
  });
});
