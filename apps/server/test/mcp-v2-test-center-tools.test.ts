import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";
import { registerTestCenterTools } from "../src/mcp-v2/resources/testCenterTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import type { McpOperationClaim, McpOperationRecord, McpOperationRepo } from "../src/repos/McpOperationRepo.js";
import { TestCenterSqliteRepo } from "../src/test-center/TestCenterSqliteRepo.js";

class MemoryOperationRepo implements McpOperationRepo {
  private readonly records = new Map<string, McpOperationRecord>();
  claim(toolName: string, requestId: string, inputHash: string): McpOperationClaim {
    const key = `${toolName}:${requestId}`; const record = this.records.get(key);
    if (record) return { claimed: false, record };
    this.records.set(key, { toolName, requestId, inputHash, status: "pending", createdAt: new Date().toISOString() });
    return { claimed: true };
  }
  complete(toolName: string, requestId: string, inputHash: string, response: Parameters<McpOperationRepo["complete"]>[3]) { this.records.set(`${toolName}:${requestId}`, { toolName, requestId, inputHash, status: "completed", response, createdAt: new Date().toISOString() }); }
  abandon(toolName: string, requestId: string) { this.records.delete(`${toolName}:${requestId}`); }
}

describe("rich_test_center_manage", () => {
  it("creates a case idempotently and exposes its report", async () => {
    const db = new Database(":memory:"); db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
    const registry = new RichToolRegistry();
    registerTestCenterTools(registry, new TestCenterSqliteRepo(db), new MemoryOperationRepo());
    const input = { action: "create_case", projectId: "p1", input: { code: "TC-101", title: "登录", objective: "校验登录", type: "functional", priority: "high" }, context: { requestId: "create-test-case-1" } };

    const created = await registry.invoke("rich_test_center_manage", input);
    const replay = await registry.invoke("rich_test_center_manage", input);
    const report = await registry.invoke("rich_test_center_manage", { action: "get_report", projectId: "p1" });

    expect(created).toMatchObject({ ok: true, data: { code: "TC-101" }, verification: { status: "verified" } });
    expect(replay).toEqual(created);
    expect(report).toMatchObject({ ok: true, data: { report: { totalCases: 1, draftCases: 1 } } });
    db.close();
  });
});
