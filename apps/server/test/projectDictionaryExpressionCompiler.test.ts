import { describe, expect, it } from "vitest";
import {
  buildDictionaryExtractionFieldSqlExpression,
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
});
