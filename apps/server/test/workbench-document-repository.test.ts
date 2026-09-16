import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import type { WorkbenchDocument } from "@ke/domain";
import { SqliteWorkbenchDocumentRepo, WORKBENCH_DOCUMENT_SCHEMA } from "../src/workbench-document/repository.js";

function document(version = 1): WorkbenchDocument {
  return {
    id: "document-1",
    conversationId: "conversation-1",
    title: "工作台",
    version,
    cards: [],
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: `2026-09-16T00:00:0${version}.000Z`,
  };
}

describe("workbench document repository", () => {
  let db: Database.Database;
  let repo: SqliteWorkbenchDocumentRepo;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(WORKBENCH_DOCUMENT_SCHEMA);
    repo = new SqliteWorkbenchDocumentRepo(db);
  });
  afterEach(() => db.close());

  it("reads back an atomically created document and rejects a lost update", async () => {
    expect(await repo.save(document(), 0)).toBe(true);
    expect(await repo.get("document-1")).toEqual(document());
    expect(await repo.save(document(2), 99)).toBe(false);
    expect(await repo.get("document-1")).toEqual(document());
  });

  it("keeps exactly the current save and three newest historical snapshots", async () => {
    expect(await repo.save(document(), 0)).toBe(true);
    for (let version = 2; version <= 6; version++) expect(await repo.save(document(version), version - 1)).toBe(true);

    expect((await repo.history("document-1")).map(item => item.version)).toEqual([6, 5, 4]);
  });
});
