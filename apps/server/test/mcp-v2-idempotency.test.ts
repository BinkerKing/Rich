import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import type { PgPool } from "../src/db/postgres.js";
import { executeIdempotently } from "../src/mcp-v2/registry/idempotency.js";
import { richFailure, richSuccess } from "../src/mcp-v2/registry/response.js";
import { PostgresMcpOperationRepo } from "../src/repos/PostgresMcpOperationRepo.js";
import { SqliteMcpOperationRepo } from "../src/repos/SqliteMcpOperationRepo.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function sqliteRepo() {
  const directory = mkdtempSync(join(tmpdir(), "rich-mcp-idempotency-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "rich.db");
  const db = openDb(path);
  return { db, path, repo: new SqliteMcpOperationRepo(db) };
}

describe("MCP 2.0 operation idempotency", () => {
  it("requires a request id before claiming an operation", async () => {
    const { db, repo } = sqliteRepo();
    const claim = vi.spyOn(repo, "claim");
    const response = await executeIdempotently(repo, {
      toolName: "rich_project_manage",
      requestId: "",
      input: { id: "project-1" },
    }, async () => richSuccess("rich_project_manage", { id: "project-1" }));
    db.close();

    expect(response).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", retryable: false },
    });
    expect(claim).not.toHaveBeenCalled();
  });

  it("returns the persisted response after the SQLite repository is recreated", async () => {
    const first = sqliteRepo();
    const write = vi.fn(async () => richSuccess("rich_project_manage", { id: "project-1" }));
    const request = {
      toolName: "rich_project_manage",
      requestId: "request-1",
      input: { action: "update", id: "project-1", input: { title: "Rich" } },
    };

    await executeIdempotently(first.repo, request, write);
    first.db.close();

    const reopenedDb = openDb(first.path);
    const replay = await executeIdempotently(
      new SqliteMcpOperationRepo(reopenedDb),
      request,
      write,
    );
    reopenedDb.close();

    expect(replay).toEqual(richSuccess("rich_project_manage", { id: "project-1" }));
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("rejects reuse of a request id with different input", async () => {
    const { db, repo } = sqliteRepo();
    const write = vi.fn(async () => richSuccess("rich_project_manage", { ok: true }));

    await executeIdempotently(repo, {
      toolName: "rich_project_manage",
      requestId: "request-2",
      input: { id: "project-1" },
    }, write);
    const conflict = await executeIdempotently(repo, {
      toolName: "rich_project_manage",
      requestId: "request-2",
      input: { id: "project-2" },
    }, write);
    db.close();

    expect(conflict).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", retryable: false },
    });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed responses unless they are explicitly final", async () => {
    const { db, repo } = sqliteRepo();
    const retryableFailure = richFailure("rich_project_manage", {
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Repository unavailable.",
      retryable: true,
    });
    const write = vi.fn()
      .mockResolvedValueOnce(retryableFailure)
      .mockResolvedValueOnce(richSuccess("rich_project_manage", { id: "project-1" }));
    const request = {
      toolName: "rich_project_manage",
      requestId: "request-3",
      input: { id: "project-1" },
    };

    expect(await executeIdempotently(repo, request, write)).toEqual(retryableFailure);
    expect(await executeIdempotently(repo, request, write)).toMatchObject({ ok: true });
    expect(write).toHaveBeenCalledTimes(2);

    const finalFailure = richFailure("rich_project_manage", {
      code: "VALIDATION_ERROR",
      message: "Invalid project.",
      retryable: false,
    });
    const finalWrite = vi.fn().mockResolvedValue(finalFailure);
    const finalRequest = { ...request, requestId: "request-4" };
    await executeIdempotently(repo, finalRequest, finalWrite, { cacheFailures: true });
    await executeIdempotently(repo, finalRequest, finalWrite, { cacheFailures: true });
    db.close();

    expect(finalWrite).toHaveBeenCalledTimes(1);
  });

  it("allows only one concurrent execution for the same request", async () => {
    const { db, repo } = sqliteRepo();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let started!: () => void;
    const didStart = new Promise<void>(resolve => { started = resolve; });
    const write = vi.fn(async () => {
      started();
      await gate;
      return richSuccess("rich_project_manage", { id: "project-1" });
    });
    const request = {
      toolName: "rich_project_manage",
      requestId: "request-5",
      input: { id: "project-1" },
    };

    const first = executeIdempotently(repo, request, write);
    await didStart;
    const concurrent = await executeIdempotently(repo, request, write);
    release();
    await first;
    db.close();

    expect(concurrent).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", retryable: true },
    });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("uses an atomic Postgres claim and hydrates an existing operation", async () => {
    const record = {
      tool_name: "rich_project_manage",
      request_id: "request-pg",
      input_hash: "hash-pg",
      status: "completed",
      response_json: JSON.stringify(richSuccess("rich_project_manage", { id: "project-1" })),
      created_at: "2026-08-28T00:00:00.000Z",
      completed_at: "2026-08-28T00:00:01.000Z",
    };
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [record] });
    const pg = { ready: Promise.resolve(), query } as unknown as PgPool;
    const repo = new PostgresMcpOperationRepo(pg);

    await expect(repo.claim("rich_project_manage", "request-pg", "hash-pg"))
      .resolves.toEqual({ claimed: true });
    await expect(repo.claim("rich_project_manage", "request-pg", "hash-pg"))
      .resolves.toMatchObject({ claimed: false, record: { status: "completed" } });

    expect(String(query.mock.calls[0][0])).toContain("ON CONFLICT");
  });
});
