import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresProjectManagementRepo } from "../src/repos/PostgresProjectManagementRepo.js";
import { projectManagementRoutes } from "../src/routes/projectManagement.js";
import { verifySafeDictionarySnapshot } from "../src/modules/project-dictionary/safe/verification.js";

const runDatabaseVerification = process.env.RUN_SAFE_DB_TESTS === "1";
const describeDatabase = runDatabaseVerification ? describe : describe.skip;
const projectId = "vtb-二代safe";
const connectionString = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";

describeDatabase("SAFE dictionary local PostgreSQL verification", () => {
  const pool = new Pool({ connectionString });

  beforeAll(async () => {
    await pool.query("SELECT 1");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("keeps confirmed source, stage, middle, and mapping metadata available", async () => {
    const [systems, tables, links, mappingStatuses, intermediateMappings] = await Promise.all([
      pool.query<{ code: string }>("SELECT code FROM pm_data_systems WHERE project_id=$1", [projectId]),
      pool.query<{ code: string; table_name: string }>(
        "SELECT s.code, t.table_name FROM pm_data_tables t JOIN pm_data_systems s ON s.id=t.system_id WHERE t.project_id=$1",
        [projectId],
      ),
      pool.query<{ count: number }>("SELECT count(*)::int AS count FROM pm_entity_links WHERE project_id=$1 AND relation_type='onegen_file_ingests_to'", [projectId]),
      pool.query<{ status: string; count: number }>("SELECT status, count(*)::int AS count FROM pm_mapping_rules WHERE project_id=$1 GROUP BY status", [projectId]),
      pool.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM pm_mapping_rules r JOIN pm_data_tables t ON t.id=r.table_id WHERE r.project_id=$1 AND t.system_id='vtb-safe-middle' AND r.status IN ('published','verified')",
        [projectId],
      ),
    ]);
    const tablesBySystem = Object.groupBy(tables.rows, row => row.code);
    const statusCounts = new Map(mappingStatuses.rows.map(row => [row.status, row.count]));
    const result = verifySafeDictionarySnapshot({
      systems: systems.rows.map(row => row.code),
      tablesBySystem: Object.fromEntries(Object.entries(tablesBySystem).map(([code, rows]) => [code, rows?.map(row => row.table_name) ?? []])),
      sourceStageLinkCount: links.rows[0]?.count ?? 0,
      publishedMappingCount: statusCounts.get("published") ?? 0,
      verifiedMappingCount: statusCounts.get("verified") ?? 0,
      intermediateMappingCount: intermediateMappings.rows[0]?.count ?? 0,
    });

    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("preserves the current BopTransaction SQL validation diagnostic", async () => {
    const app = projectManagementRoutes(new PostgresProjectManagementRepo(pool));
    const response = await app.request(
      "http://localhost/vtb-%E4%BA%8C%E4%BB%A3safe/dictionary/tables/vtb-onegen-middle-boptransaction/mapping/sql-validate",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    );
    const result = await response.json() as {
      fields: Array<{ fieldName: string; status: string; error?: string }>;
      caliber: { status: string };
    };

    expect(response.status).toBe(200);
    expect(result.caliber.status).toBe("valid");
    expect(result.fields.filter(field => field.status === "valid")).toHaveLength(49);
    expect(result.fields.filter(field => field.status === "invalid")).toEqual([
      expect.objectContaining({ fieldName: "Op_name", error: expect.stringContaining("Customer.enName") }),
    ]);
  });
});
