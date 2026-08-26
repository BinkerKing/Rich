import { describe, expect, it } from "vitest";
import { replaceDictionaryRuntimePlaceholdersForValidation } from "../src/modules/project-dictionary/sql-engine/sqlValidator.js";

describe("project dictionary SQL validator", () => {
  it("replaces PostgreSQL runtime parameters without touching casts", () => {
    expect(replaceDictionaryRuntimePlaceholdersForValidation(
      "SELECT :reportDate::date, ':literal', value::text",
      "postgresql",
    )).toBe("SELECT NULL::text::date, ':literal', value::text");
  });

  it("uses a SQL Server-compatible validation literal", () => {
    expect(replaceDictionaryRuntimePlaceholdersForValidation(
      "SELECT :tenantId, schema_name.table_name",
      "sqlserver",
    )).toBe("SELECT CAST(NULL AS NVARCHAR(MAX)), schema_name.table_name");
  });
});
