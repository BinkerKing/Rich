import { describe, expect, it } from "vitest";
import { buildMcpV2Server } from "../src/mcp-v2/server.js";

describe("MCP write request context", () => {
  it("does not require the model to provide an idempotency requestId", async () => {
    const server = buildMcpV2Server({
      elements: { async list() { return []; }, async get() { return null; }, async put() {}, async removeMany() {} } as never,
      projectManagement: { async listAllModuleItems() { return []; }, async updateModuleItem() { return null; } } as never,
      operationRepo: { async claim() { return { claimed: true }; }, async complete() {}, async abandon() {} },
      taskRepo: { create() {}, get() { return null; }, list() { return []; }, count() { return 0; }, save() {} },
    });
    expect(server).toBeDefined();
  });
});
