import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";
import { SqliteProjectManagementRepo } from "../src/repos/SqliteProjectManagementRepo.js";

const databases: Database.Database[] = [];

afterEach(() => databases.splice(0).forEach(database => database.close()));

function createRepo() {
  const database = new Database(":memory:");
  databases.push(database);
  database.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
  database.prepare("INSERT INTO pm_data_systems (id, project_id, name, created_at, updated_at) VALUES (?,?,?,?,?)").run("sys-1", "project-1", "测试库", "2026-09-08", "2026-09-08");
  database.prepare("INSERT INTO pm_data_tables (id, project_id, system_id, table_name, created_at, updated_at) VALUES (?,?,?,?,?,?)").run("table-1", "project-1", "sys-1", "orders", "2026-09-08", "2026-09-08");
  database.prepare("INSERT INTO pm_data_tables (id, project_id, system_id, table_name, created_at, updated_at) VALUES (?,?,?,?,?,?)").run("table-2", "project-1", "sys-1", "payments", "2026-09-08", "2026-09-08");
  return new SqliteProjectManagementRepo(database);
}

describe("project business scenarios", () => {
  it("stores an authoritative SQL procedure and associates it with multiple tables", async () => {
    const repo = createRepo();

    const library = await repo.createDictionaryBusinessScenarioLibrary("project-1", { name: "独立场景库" });
    const scenario = await repo.createDictionaryBusinessScenario("project-1", {
      libraryId: library.id, title: "订单结算", procedureName: "sp_settle_orders", sqlText: "CREATE PROCEDURE sp_settle_orders AS SELECT 1;", tableIds: ["table-1", "table-2"],
    });

    expect(scenario.tableIds).toEqual(["table-1", "table-2"]);
    expect(scenario.sqlText).toContain("CREATE PROCEDURE");
    expect((await repo.listDictionaryBusinessScenariosForTable("project-1", "table-2")).map(item => item.id)).toEqual([scenario.id]);
  });

  it("invalidates SQL validation when the authoritative SQL changes", async () => {
    const repo = createRepo();
    const library = await repo.createDictionaryBusinessScenarioLibrary("project-1", { name: "独立场景库" });
    const scenario = await repo.createDictionaryBusinessScenario("project-1", { libraryId: library.id, title: "订单结算", procedureName: "sp_settle_orders", sqlText: "SELECT 1", tableIds: ["table-1"] });

    const updated = await repo.updateDictionaryBusinessScenario("project-1", scenario.id, { sqlText: "SELECT 2", validationStatus: "passed", validationSqlFingerprint: "old" });

    expect(updated).toMatchObject({ sqlText: "SELECT 2", validationStatus: "pending" });
    expect(updated?.validationSqlFingerprint).toBeUndefined();
  });
});
