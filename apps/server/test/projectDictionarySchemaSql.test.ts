import { describe, expect, it } from "vitest";
import {
  buildDictionaryEntityCreateTableSql,
  dictionaryEntityFieldsForTestEntity,
  diffDictionaryEntitySchema,
  mapDictionaryEntityColumnType,
} from "../src/modules/project-dictionary/schema/schemaSql.js";
import type { ProjectDictionaryFieldDetail, ProjectDictionarySystem, ProjectDictionaryTable } from "../src/repos/ProjectManagementRepo.js";

const field = (patch: Partial<ProjectDictionaryFieldDetail> = {}): ProjectDictionaryFieldDetail => ({
  id: "field-id",
  projectId: "project-id",
  tableId: "table-id",
  fieldName: "customerCode",
  fieldCn: "客户编码",
  fieldType: "varchar",
  fieldLength: "32",
  ...patch,
} as ProjectDictionaryFieldDetail);

const table = { id: "table-id", tableName: "customer", extra: { entitySchema: "vtb" } } as ProjectDictionaryTable;
const system = { connection: { schema: "public" } } as ProjectDictionarySystem;

describe("project dictionary schema SQL", () => {
  it("maps field types by dialect", () => {
    expect(mapDictionaryEntityColumnType(field(), "postgresql")).toBe("VARCHAR(32)");
    expect(mapDictionaryEntityColumnType(field(), "sqlserver")).toBe("NVARCHAR(32)");
    expect(mapDictionaryEntityColumnType(field({ fieldType: "decimal", fieldLength: "18,4" }), "postgresql")).toBe("DECIMAL(18,4)");
  });

  it("reports missing, extra and mismatched columns", () => {
    expect(diffDictionaryEntitySchema([field()], [
      { columnName: "customerCode", dataType: "integer" },
      { columnName: "legacy", dataType: "text" },
    ], "postgresql").map(issue => issue.kind)).toEqual(["type_mismatch", "extra"]);
  });

  it("builds a qualified create-table statement without changing the public model", () => {
    expect(buildDictionaryEntityCreateTableSql(system, table, [field({ required: true })], "postgresql"))
      .toContain('CREATE TABLE IF NOT EXISTS "vtb"."customer"');
  });

  it("materializes file sources as dot-safe VARCHAR(500) test tables", () => {
    const sourceFile = { id: "source-file", tableName: "AIF2.TXT", sourceKind: "文件", extra: { entitySchema: "vtb" } } as ProjectDictionaryTable;
    const entityFields = dictionaryEntityFieldsForTestEntity(sourceFile, [field({ fieldType: "text", fieldLength: undefined })]);

    expect(entityFields[0]).toMatchObject({ fieldType: "varchar", fieldLength: "500" });
    expect(buildDictionaryEntityCreateTableSql(system, sourceFile, entityFields, "postgresql"))
      .toContain('CREATE TABLE IF NOT EXISTS "vtb"."AIF2_TXT"');
    expect(buildDictionaryEntityCreateTableSql(system, sourceFile, entityFields, "postgresql"))
      .toContain('"customerCode" VARCHAR(500)');
  });
});
