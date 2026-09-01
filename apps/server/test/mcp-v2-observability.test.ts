import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Element } from "@ke/domain";
import { openDb } from "../src/db/sqlite.js";
import { mountMcpV2, McpTransportState } from "../src/mcp-v2/transport.js";
import { EmptyProjectManagementRepo } from "../src/repos/EmptyProjectManagementRepo.js";
import { SqliteMcpOperationRepo } from "../src/repos/SqliteMcpOperationRepo.js";
import { SqliteMcpTaskRepo } from "../src/repos/SqliteMcpTaskRepo.js";
import { buildApp } from "../src/index.js";
import { configureOpLog, readOpTrace, recordTraceForExistingOp, startOpRecord } from "../src/ai/aiOpLog.js";
import { OperationCorrelationRegistry } from "../src/ai/operationCorrelation.js";

const tempDirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function makeMcpApp(onToolEvent?: (event: unknown) => (() => void | Promise<void>) | void) {
  const directory = mkdtempSync(join(tmpdir(), "rich-mcp-v2-observability-"));
  tempDirs.push(directory);
  const db = openDb(join(directory, "rich.db"));
  const elements = new Map<string, Element>();
  const app = new Hono();
  const events: unknown[] = [];
  const state = new McpTransportState();
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
    onToolEvent: event => onToolEvent?.(event) ?? (() => { events.push(event); }),
  }, { state });
  return { app, db, events, state };
}

async function rpc(app: Hono, body: Record<string, unknown>) {
  return app.request("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  });
}

describe("MCP observability", () => {
  it("records safe started and completed tool events without changing the response envelope", async () => {
    const { app, db, events } = makeMcpApp();
    const response = await rpc(app, {
      id: 1,
      method: "tools/call",
      params: {
        name: "rich_context_get_overview",
        arguments: { context: { requestId: "op-1", conversationId: "chat-1" } },
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(JSON.parse(body.result.content[0].text)).toMatchObject({ ok: true, action: "rich_context_get_overview" });
    expect(events).toEqual([
      { type: "mcp.tool", data: { phase: "started", tool: "rich_context_get_overview", requestId: "op-1", conversationId: "chat-1" } },
      { type: "mcp.tool", data: { phase: "completed", tool: "rich_context_get_overview", requestId: "op-1", conversationId: "chat-1", ok: true } },
    ]);
    db.close();
  });

  it("records an error event for a non-OK registry response", async () => {
    const { app, db, events } = makeMcpApp();
    const response = await rpc(app, {
      id: 2,
      method: "tools/call",
      params: {
        name: "rich_work_delegate",
        arguments: {
          projectId: "project-1",
          title: "Fail safely",
          instructions: "The unconfigured adapter should fail.",
          context: { requestId: "op-2" },
        },
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(body.result.isError).toBe(true);
    expect(JSON.parse(body.result.content[0].text)).toMatchObject({
      ok: false,
      action: "rich_work_delegate",
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    });
    expect(events).toEqual([
      { type: "mcp.tool", data: { phase: "started", tool: "rich_work_delegate", requestId: "op-2" } },
      { type: "mcp.tool", data: { phase: "error", tool: "rich_work_delegate", requestId: "op-2", ok: false } },
    ]);
    db.close();
  });

  it("tracks successful requests and caught transport errors", async () => {
    const { app, db, state } = makeMcpApp();
    expect(state.snapshot.requestsTotal).toBe(0);
    expect(state.snapshot.lastRequestAt).toBeUndefined();
    expect(state.snapshot.lastSuccessAt).toBeUndefined();
    expect(state.snapshot.lastError).toBeUndefined();

    const success = await rpc(app, { id: 3, method: "tools/list", params: {} });
    expect(success.status).toBe(200);
    expect(state.snapshot).toMatchObject({ requestsTotal: 1 });
    expect(state.snapshot.lastRequestAt).toBeInstanceOf(Date);
    expect(state.snapshot.lastSuccessAt).toBeInstanceOf(Date);

    vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "handleRequest").mockRejectedValueOnce(new Error("transport failed"));
    const failure = await rpc(app, { id: 4, method: "tools/list", params: {} });
    expect(failure.status).toBe(500);
    expect(state.snapshot).toMatchObject({ requestsTotal: 2, lastError: "transport failed" });
    db.close();
  });

  it("does not attach an uncorrelated MCP event to an AI operation", async () => {
    const directory = mkdtempSync(join(tmpdir(), "rich-mcp-v2-uncorrelated-"));
    tempDirs.push(directory);
    const app = buildApp(directory);
    const operation = await startOpRecord({ op: "chat", model: "test", prompt: "keep this trace empty" });

    const response = await rpc(app, {
      id: 5,
      method: "tools/call",
      params: { name: "rich_context_get_overview", arguments: { context: { requestId: operation.id } } },
    });

    expect(response.status).toBe(200);
    expect(await readOpTrace(operation.id)).toEqual([]);
  });

  it("attaches an issued token's events to only its bound operation", async () => {
    const directory = mkdtempSync(join(tmpdir(), "rich-mcp-v2-issued-token-"));
    tempDirs.push(directory);
    configureOpLog(directory);
    const operation = await startOpRecord({ op: "chat", model: "test", prompt: "trace MCP" });
    const correlations = new OperationCorrelationRegistry();
    const token = correlations.issue(operation.id);
    const traceDb = openDb(join(directory, "trace.db"));
    const traceTasksDb = openDb(join(directory, "trace-tasks.db"));
    // Re-mount an isolated observer that resolves opaque tokens, not op ids.
    const traced = new Hono();
    mountMcpV2(traced, {
      elements: { async list() { return []; } } as never,
      projectManagement: new EmptyProjectManagementRepo(),
      operationRepo: new SqliteMcpOperationRepo(traceDb),
      taskRepo: new SqliteMcpTaskRepo(traceTasksDb),
      onToolEvent: event => {
        const opId = event.data.requestId ? correlations.resolve(event.data.requestId) : undefined;
        if (opId) return () => recordTraceForExistingOp(opId, { type: event.type, data: { tool: event.data.tool, status: event.data.phase } });
      },
    });
    const response = await rpc(traced, {
      id: 6,
      method: "tools/call",
      params: { name: "rich_context_get_overview", arguments: { context: { requestId: token } } },
    });

    expect(response.status).toBe(200);
    await vi.waitFor(async () => {
      expect((await readOpTrace(operation.id)).map(event => ({ type: event.type, data: event.data }))).toEqual([
        { type: "mcp.tool", data: { tool: "rich_context_get_overview", status: "started" } },
        { type: "mcp.tool", data: { tool: "rich_context_get_overview", status: "completed" } },
      ]);
    });
    correlations.release(token);
    expect(correlations.resolve(token)).toBeUndefined();
    traceDb.close();
    traceTasksDb.close();
  });

  it("keeps queued trace deliveries bound after the token is released", async () => {
    const directory = mkdtempSync(join(tmpdir(), "rich-mcp-v2-release-race-"));
    tempDirs.push(directory);
    configureOpLog(directory);
    const operation = await startOpRecord({ op: "chat", model: "test", prompt: "trace MCP" });
    const correlations = new OperationCorrelationRegistry();
    const token = correlations.issue(operation.id);
    const db = openDb(join(directory, "rich.db"));
    const tasksDb = openDb(join(directory, "tasks.db"));
    let releaseFirst!: () => void;
    const firstDelivery = new Promise<void>(resolve => { releaseFirst = resolve; });
    const app = new Hono();
    mountMcpV2(app, {
      elements: { async list() { return []; } } as never,
      projectManagement: new EmptyProjectManagementRepo(),
      operationRepo: new SqliteMcpOperationRepo(db),
      taskRepo: new SqliteMcpTaskRepo(tasksDb),
      onToolEvent: event => {
        const opId = event.data.requestId ? correlations.resolve(event.data.requestId) : undefined;
        if (!opId) return;
        return async () => {
          if (event.data.phase === "started") await firstDelivery;
          await recordTraceForExistingOp(opId, { type: event.type, data: { tool: event.data.tool, status: event.data.phase } });
        };
      },
    });

    const response = await rpc(app, {
      id: 10,
      method: "tools/call",
      params: { name: "rich_context_get_overview", arguments: { context: { requestId: token } } },
    });
    expect(response.status).toBe(200);
    correlations.release(token);
    releaseFirst();
    await vi.waitFor(async () => {
      expect((await readOpTrace(operation.id)).map(event => event.data)).toEqual([
        { tool: "rich_context_get_overview", status: "started" },
        { tool: "rich_context_get_overview", status: "completed" },
      ]);
    });
    db.close();
    tasksDb.close();
  });

  it("expires unreleased correlation tokens", () => {
    vi.useFakeTimers();
    const correlations = new OperationCorrelationRegistry({ ttlMs: 10 });
    const token = correlations.issue("op-expiring");
    expect(correlations.resolve(token)).toBe("op-expiring");
    vi.advanceTimersByTime(10);
    expect(correlations.resolve(token)).toBeUndefined();
    vi.useRealTimers();
  });

  it("does not wait for throwing or hung observers", async () => {
    const thrownEvents: string[] = [];
    const { app, db } = makeMcpApp(event => () => {
      const phase = (event as { data: { phase: string } }).data.phase;
      thrownEvents.push(phase);
      if (phase === "started") throw new Error("observer failed");
    });
    const throwingResponse = await rpc(app, { id: 7, method: "tools/call", params: { name: "rich_context_get_overview", arguments: {} } });
    expect(throwingResponse.status).toBe(200);
    await vi.waitFor(() => expect(thrownEvents).toEqual(["started", "completed"]));
    const directory = mkdtempSync(join(tmpdir(), "rich-mcp-v2-hung-observer-"));
    tempDirs.push(directory);
    const hungDb = openDb(join(directory, "rich.db"));
    const hungTasksDb = openDb(join(directory, "tasks.db"));
    const throwing = new Hono();
    mountMcpV2(throwing, {
      elements: { async list() { return []; } } as never,
      projectManagement: new EmptyProjectManagementRepo(),
      operationRepo: new SqliteMcpOperationRepo(hungDb),
      taskRepo: new SqliteMcpTaskRepo(hungTasksDb),
      onToolEvent: () => () => new Promise<void>(() => undefined),
    });
    const response = await Promise.race([
      rpc(throwing, { id: 8, method: "tools/call", params: { name: "rich_context_get_overview", arguments: {} } }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("observer blocked response")), 100)),
    ]);
    expect(response.status).toBe(200);
    db.close();
    hungDb.close();
    hungTasksDb.close();
  });

  it("serializes async observer invocation order without delaying the response", async () => {
    const observed: string[] = [];
    let releaseStarted!: () => void;
    const started = new Promise<void>(resolve => { releaseStarted = resolve; });
    const { app, db } = makeMcpApp(event => async () => {
      const phase = (event as { data: { phase: string } }).data.phase;
      observed.push(`${phase}:invoked`);
      if (phase === "started") await started;
      observed.push(`${phase}:finished`);
    });

    const response = await rpc(app, { id: 9, method: "tools/call", params: { name: "rich_context_get_overview", arguments: {} } });
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(observed).toEqual(["started:invoked"]));
    releaseStarted();
    await vi.waitFor(() => expect(observed).toEqual([
      "started:invoked", "started:finished", "completed:invoked", "completed:finished",
    ]));
    db.close();
  });
});
