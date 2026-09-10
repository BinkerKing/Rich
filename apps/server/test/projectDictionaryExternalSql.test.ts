import { describe, expect, it } from "vitest";
import { POSTGRES_PROJECT_MANAGEMENT_SCHEMA, SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";

describe("project dictionary external SQL", () => {
  it("defines all six dedicated fields in both dialect schemas", () => {
    for (const schema of [POSTGRES_PROJECT_MANAGEMENT_SCHEMA, SQLITE_PROJECT_MANAGEMENT_SCHEMA]) {
      expect(schema).toMatch(/pm_data_tables[\s\S]*?external_sql TEXT/);
      expect(schema).toMatch(/pm_mapping_scenarios[\s\S]*?caliber_external_sql TEXT[\s\S]*?external_sql TEXT/);
      expect(schema).toMatch(/pm_mapping_rules[\s\S]*?external_sql TEXT/);
      expect(schema).toMatch(/pm_mapping_temp_tables[\s\S]*?external_sql TEXT/);
      expect(schema).toMatch(/pm_mapping_temp_fields[\s\S]*?external_sql TEXT/);
    }
  });
});
