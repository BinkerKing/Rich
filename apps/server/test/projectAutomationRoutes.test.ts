import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { SqliteProjectAutomationRepo } from "../src/modules/project-automation/infrastructure/SqliteProjectAutomationRepo.js";
import { projectAutomationRoutes } from "../src/modules/project-automation/presentation/routes.js";

describe("project automation routes", () => {
  const databases: ReturnType<typeof openDb>[] = [];
  afterEach(() => databases.splice(0).forEach(db => db.close()));

  it("configures a serial plan and runs it in the background", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-automation-routes-")), "rich.db"));
    databases.push(db);
    seedDictionaryTable(db);
    const repo = new SqliteProjectAutomationRepo(db);
    const app = projectAutomationRoutes({} as never, repo, {
      stepExecutorFactory: () => async (_item, step) => step === "extract" ? { affectedRows: 31 } : {},
    });

    const planResponse = await app.request("http://localhost/project-a/automation/plans", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "每日取数" }),
    });
    expect(planResponse.status).toBe(201);
    const plan = await planResponse.json() as { id: string };
    const groupResponse = await app.request(`http://localhost/project-a/automation/plans/${plan.id}/groups`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "贴源层" }),
    });
    const group = await groupResponse.json() as { id: string };
    const itemResponse = await app.request(`http://localhost/project-a/automation/plans/${plan.id}/groups/${group.id}/items`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tableId: "table-a" }),
    });
    expect(itemResponse.status).toBe(201);

    const startResponse = await app.request(`http://localhost/project-a/automation/plans/${plan.id}/runs`, { method: "POST" });
    expect(startResponse.status).toBe(202);
    const started = await startResponse.json() as { id: string };
    const completed = await waitForRun(app, started.id);

    expect(completed).toMatchObject({ status: "success", items: [{ tableId: "table-a", affectedRows: 31 }] });
  });

  it("checks required parameters before execution and accepts them when starting a run", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-automation-routes-")), "rich.db"));
    databases.push(db);
    seedDictionaryTable(db);
    const repo = new SqliteProjectAutomationRepo(db);
    const received: Array<Record<string, unknown> | undefined> = [];
    const app = projectAutomationRoutes({} as never, repo, {
      stepExecutorFactory: () => (async (_item: unknown, _step: unknown, context: { runtimeParams?: Record<string, unknown> }) => {
        received.push(context.runtimeParams);
        return {};
      }) as never,
      planInspectorFactory: () => async () => ({
        ready: true,
        runtimeParamNames: ["businessDate"],
        runtimeParamTypes: { businessDate: "DATE" },
        message: "检查完成",
      }),
    } as never);

    const planResponse = await app.request("http://localhost/project-a/automation/plans", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "每日取数" }),
    });
    const plan = await planResponse.json() as { id: string };
    const groupResponse = await app.request(`http://localhost/project-a/automation/plans/${plan.id}/groups`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "贴源层" }),
    });
    const group = await groupResponse.json() as { id: string };
    await app.request(`http://localhost/project-a/automation/plans/${plan.id}/groups/${group.id}/items`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tableId: "table-a" }),
    });

    const checkResponse = await app.request(`http://localhost/project-a/automation/plans/${plan.id}/check`, { method: "POST" });
    expect(checkResponse.status).toBe(200);
    await expect(checkResponse.json()).resolves.toMatchObject({
      ready: true,
      parameters: [{ name: "businessDate", types: ["DATE"], tableIds: ["table-a"] }],
    });

    const startResponse = await app.request(`http://localhost/project-a/automation/plans/${plan.id}/runs`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ runtimeParams: { businessDate: "2026-08-25" } }),
    });
    expect(startResponse.status).toBe(202);
    const started = await startResponse.json() as { id: string };
    await waitForRun(app, started.id);
    expect(received.every(params => params?.businessDate === "2026-08-25")).toBe(true);
  });
});

async function waitForRun(app: ReturnType<typeof projectAutomationRoutes>, runId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await app.request(`http://localhost/project-a/automation/runs/${runId}`);
    const run = await response.json() as { status: string };
    if (run.status !== "running") return run;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error("automation run did not finish");
}

function seedDictionaryTable(db: ReturnType<typeof openDb>) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO pm_data_systems (id, project_id, code, name, extra, created_at, updated_at) VALUES ('system-a', 'project-a', 'SAFE', 'SAFE', '{}', ?, ?)`)
    .run(now, now);
  db.prepare(`INSERT INTO pm_data_tables (id, project_id, system_id, table_name, extra, created_at, updated_at) VALUES ('table-a', 'project-a', 'system-a', 'ods_customer', '{}', ?, ?)`)
    .run(now, now);
}
