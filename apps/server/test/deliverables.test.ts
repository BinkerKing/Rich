import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";
import { SqliteDeliverablesRepo } from "../src/repos/SqliteDeliverablesRepo.js";

describe("standalone deliverables", () => {
  it("persists a deliverable and its fixed directory independently of a project", async () => {
    const db = new Database(":memory:");
    try {
      db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
      const repo = new SqliteDeliverablesRepo(db);
      const content = { recordType: "deliverable", folderPath: "/Users/rich/交付/UAT" };
      const created = await repo.create({ title: "验收报告", content });
      expect(created.id).toBeTruthy();
      expect((await repo.get(created.id))?.content).toEqual(content);
      expect((await repo.update(created.id, { title: "最终验收报告" }))?.title).toBe("最终验收报告");
      expect(await repo.remove(created.id)).toBe(true);
    } finally {
      db.close();
    }
  });
});
