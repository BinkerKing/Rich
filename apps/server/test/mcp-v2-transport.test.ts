import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { Element } from "@ke/domain";
import { openDb } from "../src/db/sqlite.js";
import { mountMcpV2 } from "../src/mcp-v2/transport.js";
import { EmptyProjectManagementRepo } from "../src/repos/EmptyProjectManagementRepo.js";
import { SqliteMcpOperationRepo } from "../src/repos/SqliteMcpOperationRepo.js";
import { SqliteMcpTaskRepo } from "../src/repos/SqliteMcpTaskRepo.js";

const tempDirs: string[] = [];
afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function makeApp(options: { onDepsRegistryBuilt?: (count: number) => void; onOptionsRegistryBuilt?: (count: number) => void } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "rich-mcp-v2-http-"));
  tempDirs.push(directory);
  const db = openDb(join(directory, "rich.db"));
  const elements = new Map<string, Element>();
  const app = new Hono();
  mountMcpV2(app, {
    elements: {
      async list() { return Array.from(elements.values()); },
      async get(id) { return elements.get(id) ?? null; },
      async put(element) { elements.set(element.id, element); },
      async removeMany(ids) { for (const id of ids) elements.delete(id); },
    } as never,
    projectManagement: new EmptyProjectManagementRepo(),
    operationRepo: new SqliteMcpOperationRepo(db),
    taskRepo: new SqliteMcpTaskRepo(db),
    onRegistryBuilt: options.onDepsRegistryBuilt,
  }, { onRegistryBuilt: options.onOptionsRegistryBuilt });
  return { app, db };
}

async function rpc(app: Hono, body: Record<string, unknown>) {
  const response = await app.request("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  });
  expect(response.status).toBe(200);
  return response.json() as Promise<Record<string, any>>;
}

describe("MCP 2.0 Streamable HTTP transport", () => {
  it("initializes as Rich MCP 2.0", async () => {
    const { app, db } = makeApp();
    const result = await rpc(app, {
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
    });
    expect(result.result).toMatchObject({ serverInfo: { name: "rich", version: "2.0.0" } });
    db.close();
  });

  it("lists only the compact rich_ tool surface", async () => {
    const { app, db } = makeApp();
    const result = await rpc(app, { id: 2, method: "tools/list", params: {} });
    const names = result.result.tools.map((tool: { name: string }) => tool.name);
    expect(names.length).toBeGreaterThan(10);
    expect(names.length).toBeLessThanOrEqual(40);
    expect(names.every((name: string) => name.startsWith("rich_"))).toBe(true);
    expect(names).toContain("rich_project_organize_conversation");
    expect(names).not.toContain("create_element");
    db.close();
  });

  it("returns the uniform Rich envelope from tools/call", async () => {
    const { app, db } = makeApp();
    const result = await rpc(app, {
      id: 3,
      method: "tools/call",
      params: { name: "rich_context_get_overview", arguments: {} },
    });
    const envelope = JSON.parse(result.result.content[0].text);
    expect(envelope).toMatchObject({ ok: true, action: "rich_context_get_overview", data: { knowledge: { total: 0 } } });
    db.close();
  });

  it("calls dependency and mount registry callbacks in order", () => {
    const calls: string[] = [];
    const { db } = makeApp({
      onDepsRegistryBuilt: count => calls.push(`deps:${count}`),
      onOptionsRegistryBuilt: count => calls.push(`options:${count}`),
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^deps:\d+$/);
    expect(calls[1]).toMatch(/^options:\d+$/);
    db.close();
  });
});
