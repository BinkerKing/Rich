import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";
import { SqliteFlowchartsRepo } from "../src/repos/SqliteFlowchartsRepo.js";

describe("standalone flowcharts", () => {
  it("creates a dedicated flowcharts table", () => {
    const db = new Database(":memory:");
    try {
      db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
      const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'flowcharts'").get();
      expect(table).toBeDefined();
    } finally {
      db.close();
    }
  });

  it("persists standalone graphs independently of a project", async () => {
    const db = new Database(":memory:");
    try {
      db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
      const repo = new SqliteFlowchartsRepo(db);
      const graph = { version: 1, nodes: [{ id: "start" }], edges: [] };
      const created = await repo.create({ title: "登录流程", graph });
      expect(created.id).toBeTruthy();
      expect((await repo.list()).map(item => item.id)).toEqual([created.id]);
      expect((await repo.get(created.id))?.graph).toEqual(graph);
      expect((await repo.update(created.id, { title: "新版登录流程" }))?.title).toBe("新版登录流程");
      expect(await repo.remove(created.id)).toBe(true);
      expect(await repo.get(created.id)).toBeNull();
    } finally {
      db.close();
    }
  });
});
