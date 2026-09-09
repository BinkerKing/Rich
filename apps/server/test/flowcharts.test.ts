import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";

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
});
