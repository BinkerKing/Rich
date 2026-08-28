import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSqliteMulticaWorkbenchSnapshotRepo } from "../src/mcp-v2/delegation/multica/SqliteMulticaWorkbenchSnapshotRepo.js";

describe("SQLite Multica workbench snapshots", () => {
  it("persists snapshots and connection state", async () => {
    const directory = mkdtempSync(join(tmpdir(), "rich-multica-workbench-"));
    const repo = openSqliteMulticaWorkbenchSnapshotRepo(join(directory, "multica-workbench.db"));
    await repo.save({ richProjectId: "vtb", key: "board", payload: { issues: [{ id: "issue-1" }] }, updatedAt: "2026-08-28T08:00:00.000Z" });
    await repo.saveSyncState({ richProjectId: "vtb", status: "connected", lastAttemptAt: "2026-08-28T08:00:00.000Z", lastSuccessAt: "2026-08-28T08:00:00.000Z" });

    expect(await repo.get("vtb", "board")).toMatchObject({ payload: { issues: [{ id: "issue-1" }] } });
    expect(await repo.getSyncState("vtb")).toMatchObject({ status: "connected", lastSuccessAt: "2026-08-28T08:00:00.000Z" });
    await repo.deleteByPrefixes("vtb", ["board"]);
    expect(await repo.get("vtb", "board")).toBeNull();
    repo.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
