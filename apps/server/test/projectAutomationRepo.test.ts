import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { SqliteProjectAutomationRepo } from "../src/modules/project-automation/infrastructure/SqliteProjectAutomationRepo.js";
import { AUTOMATION_STEPS } from "../src/modules/project-automation/application/runner.js";

describe("SQLite project automation repository", () => {
  const databases: ReturnType<typeof openDb>[] = [];
  afterEach(() => databases.splice(0).forEach(db => db.close()));

  it("persists plans, ordered groups and dictionary table assignments", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-automation-")), "rich.db"));
    databases.push(db);
    seedDictionaryTable(db, "project-a", "system-a", "table-a", "ods_customer");
    seedDictionaryTable(db, "project-a", "system-a", "table-b", "dwd_customer");
    const repo = new SqliteProjectAutomationRepo(db);

    const plan = await repo.createPlan("project-a", { name: "每日取数" });
    const source = await repo.createGroup("project-a", plan.id, { name: "贴源层", sortOrder: 1 });
    const middle = await repo.createGroup("project-a", plan.id, { name: "中间层", sortOrder: 2 });
    await repo.addItem("project-a", plan.id, middle.id, { tableId: "table-b", sortOrder: 1 });
    await repo.addItem("project-a", plan.id, source.id, { tableId: "table-a", sortOrder: 1 });

    const detail = await repo.getPlan("project-a", plan.id);

    expect(detail?.groups.map(group => group.name)).toEqual(["贴源层", "中间层"]);
    expect(detail?.groups[0]?.items[0]).toMatchObject({ tableId: "table-a", tableName: "ods_customer" });
    expect(detail?.groups[1]?.items[0]).toMatchObject({ tableId: "table-b", tableName: "dwd_customer" });
  });

  it("persists a run snapshot and its resumable step state", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-automation-")), "rich.db"));
    databases.push(db);
    seedDictionaryTable(db, "project-a", "system-a", "table-a", "ods_customer");
    const repo = new SqliteProjectAutomationRepo(db);
    const plan = await repo.createPlan("project-a", { name: "每日取数" });
    const group = await repo.createGroup("project-a", plan.id, { name: "贴源层", sortOrder: 1 });
    await repo.addItem("project-a", plan.id, group.id, { tableId: "table-a", sortOrder: 1 });
    const detail = await repo.getPlan("project-a", plan.id);
    if (!detail) throw new Error("plan missing");

    const createRun = repo.createRun.bind(repo) as unknown as (
      plan: typeof detail,
      runtimeParams: Record<string, unknown>,
    ) => ReturnType<typeof repo.createRun>;
    const run = await createRun(detail, { businessDate: "2026-08-25" });
    const runItem = run.items[0]!;
    runItem.status = "error";
    runItem.failedStep = "prepare_extraction";
    runItem.error = "参数缺失";
    runItem.steps = AUTOMATION_STEPS.map((step, index) => ({
      step,
      status: index < 2 ? "success" : index === 2 ? "error" : "pending",
    }));
    await repo.saveRun({ ...run, status: "paused", error: "参数缺失", items: [runItem] });

    await expect(repo.getRun("project-a", run.id)).resolves.toMatchObject({
      status: "paused",
      error: "参数缺失",
      runtimeParams: { businessDate: "2026-08-25" },
      items: [{ tableId: "table-a", failedStep: "prepare_extraction" }],
    });
  });
});

function seedDictionaryTable(
  db: ReturnType<typeof openDb>,
  projectId: string,
  systemId: string,
  tableId: string,
  tableName: string,
) {
  const now = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO pm_data_systems
    (id, project_id, code, name, extra, created_at, updated_at)
    VALUES (?, ?, ?, ?, '{}', ?, ?)`)
    .run(systemId, projectId, systemId, systemId, now, now);
  db.prepare(`INSERT INTO pm_data_tables
    (id, project_id, system_id, table_name, extra, created_at, updated_at)
    VALUES (?, ?, ?, ?, '{}', ?, ?)`)
    .run(tableId, projectId, systemId, tableName, now, now);
}
