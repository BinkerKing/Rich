import Database from "better-sqlite3";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";
import { SqliteDeliverablesRepo } from "../src/repos/SqliteDeliverablesRepo.js";
import { deliverablesRoutes } from "../src/routes/deliverables.js";

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

describe("standalone deliverable file actions", () => {
  it("rejects a file action that escapes the deliverable directory", async () => {
    const folder = await mkdtemp(join(tmpdir(), "rich-standalone-deliverable-"));
    try {
      await writeFile(join(folder, "reply.md"), "reply");
      const app = deliverablesRoutes({
        list: async () => [],
        get: async () => ({ id: "delivery-1", title: "客户信息", content: { folderPath: folder }, createdAt: "", updatedAt: "" }),
        create: async () => { throw new Error("not used"); },
        update: async () => null,
        remove: async () => false,
      });
      const response = await app.request("/delivery-1/files/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: join(folder, "..", "outside.md") }),
      });
      expect(response.status).toBe(400);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
