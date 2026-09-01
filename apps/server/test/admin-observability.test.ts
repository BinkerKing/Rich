import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adminRoutes } from "../src/routes/admin.js";
import { configureOpLog, startOpRecord } from "../src/ai/aiOpLog.js";
import { McpTransportState } from "../src/mcp-v2/transport.js";
import { createAIObservability, type ObservabilityDeps } from "../src/ai/observability.js";
import type { AIAdapter } from "../src/ai/adapter.js";
import type { McpTask } from "../src/repos/McpTaskRepo.js";
import type { PersistentTaskService } from "../src/mcp-v2/tasks/persistentTaskService.js";
import type { MulticaTaskSynchronizer } from "../src/mcp-v2/delegation/multica/MulticaTaskSynchronizer.js";

const now = () => new Date("2026-01-01T00:01:00.000Z");

function adapter(name: AIAdapter["name"], available: boolean): AIAdapter {
  return { name, available: async () => available, async *stream() { yield { type: "done", fullText: "" } as const; } };
}

function task(overrides: Partial<McpTask> = {}): McpTask {
  return {
    id: "task-1", type: "agent", title: "Private work", request: { secret: "do not expose" }, status: "running",
    backend: "multica-cli", externalTaskId: "external-1", progressSummary: "coding", resultRefs: [],
    conversationId: "conversation-1", requestId: "request-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:30.000Z",
    ...overrides,
  };
}

function observability(overrides: Partial<ObservabilityDeps> = {}) {
  const tasks = [task()];
  return createAIObservability({
    adapters: [adapter("codex", true)],
    mcpTransportState: new McpTransportState(),
    multicaTaskSynchronizer: { lastAttemptAt: undefined, lastSuccessAt: undefined, lastError: undefined, intervalMs: 30_000 } as MulticaTaskSynchronizer,
    multicaWorkTasks: { count: async () => tasks.length, list: async () => tasks } as PersistentTaskService,
    getMcpRegistryToolCount: () => 1,
    childRegistryCount: () => 0,
    now,
    ...overrides,
  });
}

function routes(overrides: Partial<ObservabilityDeps> = {}) {
  return adminRoutes({
    signals: { append: async () => {}, list: async () => [], count: async () => 0 },
    corpus: { getAll: async () => null, putAll: async () => {} }, aiDir: "/does-not-exist", adapters: [],
    observability: observability(overrides),
  });
}

describe("admin AI observability", () => {
  it("reports adapter offline, MCP lifecycle states, and Multica configuration without probing Multica", async () => {
    const mcp = new McpTransportState();
    const offline = await observability({ adapters: [adapter("codex", false)], mcpTransportState: mcp }).health();
    expect(offline).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "adapter:codex", state: "offline" }),
      expect.objectContaining({ id: "rich-mcp", state: "degraded" }),
      expect.objectContaining({ id: "multica", state: "degraded" }),
    ]));

    const configured = await observability({
      mcpTransportState: mcp,
      multicaTaskSynchronizer: { lastAttemptAt: undefined, lastSuccessAt: undefined, lastError: "DEPENDENCY_UNAVAILABLE: multica cli missing", intervalMs: 30_000 } as MulticaTaskSynchronizer,
    }).health();
    expect(configured).toEqual(expect.arrayContaining([expect.objectContaining({ id: "multica", state: "not_configured" })]));
  });

  it("treats a failed adapter availability check as offline without breaking health", async () => {
    const unavailable = adapter("codex", true);
    unavailable.available = async () => { throw new Error("adapter process unavailable with secret-token"); };
    const health = await observability({ adapters: [unavailable] }).health();
    expect(health).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "adapter:codex", state: "offline", lastError: "Adapter availability check failed." }),
    ]));
    expect(JSON.stringify(health)).not.toContain("secret-token");
  });

  it("bounds a hung adapter probe and marks it degraded", async () => {
    const hung = adapter("codex", true);
    hung.available = async () => new Promise<boolean>(resolve => setTimeout(() => resolve(true), 25));
    const health = await observability({ adapters: [hung], adapterTimeoutMs: 1 } as Partial<ObservabilityDeps>).health();
    expect(health).toEqual(expect.arrayContaining([expect.objectContaining({ id: "adapter:codex", state: "degraded" })]));
  });

  it("distinguishes degraded, healthy, and offline MCP transport states and a latest Multica error", async () => {
    const mcp = (snapshot: Record<string, unknown>) => ({ snapshot }) as McpTransportState;
    const healthy = await observability({
      mcpTransportState: mcp({ startedAt: now(), requestsTotal: 2, lastSuccessAt: new Date("2026-01-01T00:00:30.000Z") }),
      multicaTaskSynchronizer: { lastSuccessAt: "2026-01-01T00:00:30.000Z", lastError: undefined, intervalMs: 30_000 } as MulticaTaskSynchronizer,
    }).health();
    expect(healthy).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "rich-mcp", state: "healthy" }),
      expect.objectContaining({ id: "multica", state: "healthy" }),
    ]));
    const offline = await observability({
      mcpTransportState: mcp({ startedAt: now(), requestsTotal: 2, lastSuccessAt: new Date("2026-01-01T00:00:10.000Z"), lastErrorAt: new Date("2026-01-01T00:00:20.000Z"), lastError: "transport failed" }),
      multicaTaskSynchronizer: { lastSuccessAt: "2026-01-01T00:00:30.000Z", lastError: "sync failed", intervalMs: 30_000 } as MulticaTaskSynchronizer,
    }).health();
    expect(offline).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "rich-mcp", state: "offline", lastError: "Most recent MCP transport request failed." }),
      expect.objectContaining({ id: "multica", state: "degraded", lastError: "Multica synchronization failed." }),
    ]));
    expect(JSON.stringify(offline)).not.toContain("transport failed");
    expect(JSON.stringify(offline)).not.toContain("sync failed");
  });

  it("reports MCP offline when no registry tools are mounted", async () => {
    const health = await observability({ getMcpRegistryToolCount: () => 0 }).health();
    expect(health).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "rich-mcp", state: "offline" }),
    ]));
  });

  it("reports stale Multica success as degraded", async () => {
    const health = await observability({
      multicaTaskSynchronizer: { lastSuccessAt: "2026-01-01T00:00:00.000Z", lastError: undefined, intervalMs: 20_000 } as MulticaTaskSynchronizer,
    }).health();
    expect(health).toEqual(expect.arrayContaining([expect.objectContaining({ id: "multica", state: "degraded" })]));
  });

  it("keeps trace lists private, returns ordered trace detail, validates limits, and reports unknown ids", async () => {
    configureOpLog(mkdtempSync(join(tmpdir(), "rich-admin-observability-")));
    const chat = await startOpRecord({ op: "chat-stream", model: "codex", prompt: "private prompt" });
    await chat.recordEvent({ type: "turn.plan" });
    await chat.recordEvent({ type: "mcp.tool", data: { tool: "rich_read", status: "completed" } });
    await chat.recordDone("private output");
    const app = routes();

    const list = await app.request("http://test/ai-observability/traces?kind=chat&limit=1");
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual(expect.objectContaining({ items: [expect.objectContaining({ id: chat.id, kind: "chat" })] }));
    expect(JSON.stringify(await (await app.request("http://test/ai-observability/traces?kind=chat")).json())).not.toContain("private prompt");
    const detail = await (await app.request(`http://test/ai-observability/traces/${chat.id}`)).json() as Record<string, unknown>;
    expect(detail).toMatchObject({ id: chat.id, hasOutput: true, outputLength: "private output".length });
    expect(JSON.stringify(detail)).not.toContain("private output");
    expect(JSON.stringify(detail)).not.toContain("private prompt");
    expect(await app.request("http://test/ai-observability/traces?limit=0")).toHaveProperty("status", 400);
    expect(await app.request("http://test/ai-observability/traces/missing")).toHaveProperty("status", 404);
  });

  it("does not expose raw operation errors in trace detail", async () => {
    configureOpLog(mkdtempSync(join(tmpdir(), "rich-admin-observability-")));
    const failed = await startOpRecord({ op: "refine", model: "codex", prompt: "private prompt" });
    await failed.recordError("private backend error");
    const detail = await (await routes().request(`http://test/ai-observability/traces/${failed.id}`)).json();
    expect(JSON.stringify(detail)).not.toContain("private backend error");
  });

  it("classifies a chat trace with a delegate tool event as delegation", async () => {
    configureOpLog(mkdtempSync(join(tmpdir(), "rich-admin-observability-")));
    const op = await startOpRecord({ op: "chat-stream", model: "codex", prompt: "delegate private work" });
    await op.recordEvent({ type: "mcp.tool", data: { tool: "rich_work_delegate", status: "completed" } });
    await op.recordDone("done");
    const response = await routes().request("http://test/ai-observability/traces?kind=delegation");
    expect(await response.json()).toEqual(expect.objectContaining({ items: [expect.objectContaining({ id: op.id, kind: "delegation" })] }));
  });

  it("labels direct AI context workflows without inferring MCP activity and returns capped, redacted delegation summaries", async () => {
    const app = routes({ multicaWorkTasks: { count: async () => 1, list: async () => [task({ resultRefs: [{ type: "report", id: "result-1", label: "private Multica output excerpt" }] })] } as PersistentTaskService });
    const workflows = await (await app.request("http://test/ai-observability/workflows")).json() as { items: Array<{ operation: string; usesMcp: boolean }>; recentOperations: Array<{ op: string; total: number }> };
    expect(workflows.items.find(item => item.operation === "/api/ai/great-me")).toMatchObject({ usesMcp: false });
    expect(workflows.recentOperations).toEqual(expect.arrayContaining([expect.objectContaining({ op: "chat-stream", total: 1 })]));
    const delegations = await (await app.request("http://test/ai-observability/delegations")).json() as { total: number; items: Array<Record<string, unknown>> };
    expect(delegations.total).toBe(1);
    expect(delegations.items[0]).toMatchObject({ id: "task-1", title: "Private work", backend: "multica-cli" });
    expect(delegations.items[0]).not.toHaveProperty("request");
    expect(delegations.items[0]).not.toHaveProperty("reviewNotes");
    expect(delegations.items[0]).not.toHaveProperty("error");
    expect(delegations.items[0]).not.toHaveProperty("progressSummary");
    expect(delegations.items[0]).toMatchObject({ hasError: false, hasProgress: true });
    expect(delegations.items[0]).toMatchObject({ resultRefs: [{ type: "report", id: "result-1" }] });
    expect(JSON.stringify(delegations.items[0])).not.toContain("private Multica output excerpt");
  });

  it("caps delegation snapshots at fifty while preserving a redacted total", async () => {
    const tasks = Array.from({ length: 250 }, (_, index) => task({
      id: `task-${index}`,
      error: "private delegated error",
      progressSummary: "private delegated progress",
    }));
    const app = routes({ multicaWorkTasks: { count: async () => tasks.length, list: async options => tasks.slice(0, options?.limit ?? 50) } as PersistentTaskService });
    const result = await (await app.request("http://test/ai-observability/delegations")).json() as { total: number; items: Array<Record<string, unknown>> };
    expect(result.total).toBe(250);
    expect(result.items).toHaveLength(50);
    expect(JSON.stringify(result)).not.toContain("private delegated");
  });
});
