import { describe, expect, it } from "vitest";
import {
  InMemoryDictionaryExecutionJobStore,
  dictionaryDatabaseCapabilities,
  type DictionaryExecutionJob,
} from "../src/modules/project-dictionary/index.js";
import { projectManagementRoutes } from "../src/routes/projectManagement.js";
import type { ProjectManagementRepo } from "../src/repos/ProjectManagementRepo.js";
import { quoteDictionaryEntityIdentifier } from "../src/modules/project-dictionary/sql-engine/dialect.js";

describe("project dictionary foundation", () => {
  it("declares capabilities by database dialect instead of leaking branches to callers", () => {
    expect(dictionaryDatabaseCapabilities("postgresql")).toMatchObject({
      dialect: "postgresql",
      supportsSchema: true,
      supportsExplain: true,
    });
    expect(dictionaryDatabaseCapabilities("sqlserver")).toMatchObject({
      dialect: "sqlserver",
      supportsSchema: true,
      supportsExplain: true,
    });
  });

  it("quotes identifiers with the selected dialect's escaping rules", () => {
    expect(quoteDictionaryEntityIdentifier('customer"name', "postgresql")).toBe('"customer""name"');
    expect(quoteDictionaryEntityIdentifier("customer]name", "sqlserver")).toBe("[customer]]name]");
  });

  it("keeps execution jobs scoped to their project and table", async () => {
    const store = new InMemoryDictionaryExecutionJobStore();
    const job: DictionaryExecutionJob = {
      ok: true,
      id: "job-1",
      projectId: "project-a",
      tableId: "table-a",
      status: "running",
      message: "started",
      startedAt: "2026-08-24T00:00:00.000Z",
    };

    await store.create(job);
    await store.update("job-1", { status: "success", message: "done", finishedAt: "2026-08-24T00:01:00.000Z" });

    await expect(store.get("project-a", "table-a", "job-1")).resolves.toMatchObject({ status: "success", message: "done" });
    await expect(store.get("project-b", "table-a", "job-1")).resolves.toBeNull();
    await expect(store.get("project-a", "table-b", "job-1")).resolves.toBeNull();
  });

  it("reads an extraction job through the existing HTTP path with an injected store", async () => {
    const store = new InMemoryDictionaryExecutionJobStore();
    await store.create({
      ok: true,
      id: "job-2",
      projectId: "project-a",
      tableId: "table-a",
      status: "success",
      message: "done",
      startedAt: "2026-08-24T00:00:00.000Z",
    });
    const app = projectManagementRoutes({} as ProjectManagementRepo, { executionJobs: store });

    const response = await app.request("http://localhost/project-a/dictionary/tables/table-a/entity/extract/job-2");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: "job-2", status: "success" });
  });
});
