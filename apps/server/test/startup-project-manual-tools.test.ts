import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerStartupProjectManualTools } from "../src/mcp-v2/resources/startupProjectManualTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import type { McpOperationRepo, McpOperationRecord } from "../src/repos/McpOperationRepo.js";

const roots: string[] = [];

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

class MemoryOperations implements McpOperationRepo {
  private readonly records = new Map<string, McpOperationRecord>();
  async claim(toolName: string, requestId: string, inputHash: string) {
    const key = `${toolName}:${requestId}`;
    const record = this.records.get(key);
    if (record) return { claimed: false as const, record };
    this.records.set(key, { toolName, requestId, inputHash, status: "pending", createdAt: new Date().toISOString() });
    return { claimed: true as const };
  }
  async complete(toolName: string, requestId: string, _inputHash: string, response: McpOperationRecord["response"]) {
    const key = `${toolName}:${requestId}`;
    const record = this.records.get(key)!;
    this.records.set(key, { ...record, status: "completed", response, completedAt: new Date().toISOString() });
  }
  async abandon(toolName: string, requestId: string) { this.records.delete(`${toolName}:${requestId}`); }
}

describe("startup project manual MCP tool", () => {
  it("writes and reads the AI manual from the startup project's stored configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "startup-manual-"));
    roots.push(root);
    await writeFile(join(root, "riking-projects.json"), JSON.stringify({ projects: [{ id: "etl", name: "ETL", location: "server", projectPath: "" }] }), "utf8");
    const registry = new RichToolRegistry();
    registerStartupProjectManualTools(registry, root, new MemoryOperations());

    const written = await registry.invoke("rich_startup_project_manual", {
      action: "write", projectId: "etl", content: "# ETL AI 使用手册\n\n先读取运行日志。", context: { requestId: "etl-manual-1" },
    });
    expect(written).toMatchObject({ ok: true, verification: { status: "verified" } });
    expect(JSON.parse(await readFile(join(root, "riking-projects.json"), "utf8")).projects[0].aiManual).toContain("先读取运行日志。");

    const read = await registry.invoke("rich_startup_project_manual", { action: "read", projectId: "etl" });
    expect(read).toMatchObject({ ok: true, data: { project: { id: "etl" }, content: "# ETL AI 使用手册\n\n先读取运行日志。" } });
  });
});
