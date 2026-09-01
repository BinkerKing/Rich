import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../src/index.js";
import { readAllOpRecords, readOpTrace } from "../src/ai/aiOpLog.js";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";

class GenericAdapter implements AIAdapter {
  readonly name = "bailian" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    yield { type: "delta", text: "Generic reply" };
    yield { type: "done", fullText: "Generic reply" };
  }
}

class CapturingGenericAdapter implements AIAdapter {
  readonly name = "bailian" as const;
  systemPrompts: string[] = [];
  async available() { return true; }
  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    this.systemPrompts.push(args.systemPrompt ?? "");
    yield { type: "done", fullText: "Generic agent reply" };
  }
}

class ThrowingGenericAdapter implements AIAdapter {
  readonly name = "bailian" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    throw new Error("Generic adapter exploded");
  }
}

class HermesAdapter implements AIAdapter {
  readonly name = "hermes" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {}
}

class CodexFallbackAdapter implements AIAdapter {
  readonly name = "codex" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    yield { type: "delta", text: "Fallback reply" };
    yield { type: "done", fullText: "Fallback reply" };
  }
}

class CapturingCodexFallbackAdapter extends CodexFallbackAdapter {
  systemPrompts: string[] = [];
  override async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    this.systemPrompts.push(args.systemPrompt ?? "");
    yield* super.stream(args);
  }
}

class FailingCodexFallbackAdapter implements AIAdapter {
  readonly name = "codex" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    yield { type: "delta", text: "Partial fallback reply" };
    yield { type: "error", message: "Codex fallback failed" };
  }
}

class SilentCodexFallbackAdapter implements AIAdapter {
  readonly name = "codex" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    yield { type: "done", fullText: "" };
  }
}

describe("chat observability", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("records an agent turn's Hermes tool progress in trace order", async () => {
    globalThis.fetch = vi.fn(async () => new Response([
      "event: hermes.tool.progress\n",
      'data: {"tool":"rich_context_get_overview","status":"running"}\n\n',
      'data: {"choices":[{"delta":{"content":"Done"}}]}\n\n',
      "data: [DONE]\n\n",
    ].join(""), { status: 200 })) as typeof fetch;
    const app = buildApp(mkdtempSync(join(tmpdir(), "ke-chat-observability-")));

    const response = await app.request("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: "chat-observability-agent",
        messages: [{ role: "user", content: "/task 修复 Rich MCP 工具" }],
      }),
    });

    expect(response.status).toBe(200);
    await response.text();
    const operation = (await readAllOpRecords()).filter(record => record.op === "chat-stream").at(-1);
    expect(operation).toBeDefined();
    expect((await readOpTrace(operation!.id)).map(event => ({ type: event.type, data: event.data }))).toEqual([
      { type: "turn.plan", data: undefined },
      { type: "adapter.selected", data: undefined },
      { type: "agent.started", data: undefined },
      { type: "mcp.tool", data: { tool: "rich_context_get_overview", status: "running" } },
      { type: "output", data: undefined },
    ]);
  });

  it("records a direct generic adapter response", async () => {
    const app = buildApp(mkdtempSync(join(tmpdir(), "ke-chat-observability-")), [new GenericAdapter()]);

    const response = await app.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }], model: "bailian" }),
    });

    expect(response.status).toBe(200);
    const operation = (await readAllOpRecords()).find(record => record.op === "chat");
    expect((await readOpTrace(operation!.id)).map(event => event.type)).toEqual([
      "turn.plan", "adapter.selected", "output",
    ]);
  });

  it("passes the opaque MCP token to agent-capable generic and fallback prompts", async () => {
    const generic = new CapturingGenericAdapter();
    const genericApp = buildApp(mkdtempSync(join(tmpdir(), "ke-chat-observability-")), [generic]);
    const genericResponse = await genericApp.request("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "/task 更新 Rich 项目" }], model: "bailian" }),
    });
    expect(genericResponse.status).toBe(200);
    await genericResponse.text();
    expect(generic.systemPrompts).toHaveLength(1);
    expect(generic.systemPrompts[0]).toMatch(/opaque token: mcp-[\w-]+/);

    const fallback = new CapturingCodexFallbackAdapter();
    globalThis.fetch = vi.fn(async () => new Response("unavailable", { status: 503, statusText: "Unavailable" })) as typeof fetch;
    const fallbackApp = buildApp(mkdtempSync(join(tmpdir(), "ke-chat-observability-")), [new HermesAdapter(), fallback]);
    const fallbackResponse = await fallbackApp.request("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "/task 更新 Rich 项目" }] }),
    });
    expect(fallbackResponse.status).toBe(200);
    await fallbackResponse.text();
    expect(fallback.systemPrompts).toHaveLength(1);
    expect(fallback.systemPrompts[0]).toMatch(/opaque token: mcp-[\w-]+/);
  });

  it("ends a thrown generic agent stream as one terminal error", async () => {
    const app = buildApp(mkdtempSync(join(tmpdir(), "ke-chat-observability-")), [new ThrowingGenericAdapter()]);
    const response = await app.request("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "/task 更新 Rich 项目" }], model: "bailian" }),
    });

    expect(response.status).toBe(200);
    const sse = await response.text();
    expect(sse.match(/event: error/g)).toHaveLength(1);
    expect(sse).not.toContain("event: done");
    const operation = (await readAllOpRecords()).filter(record => record.op === "chat-stream").at(-1);
    expect(operation?.status).toBe("error");
    expect((await readOpTrace(operation!.id)).map(event => event.type)).toEqual([
      "turn.plan", "adapter.selected", "agent.started", "error",
    ]);
  });

  it("records a single terminal fallback error", async () => {
    globalThis.fetch = vi.fn(async () => new Response("unavailable", { status: 503, statusText: "Unavailable" })) as typeof fetch;
    const app = buildApp(mkdtempSync(join(tmpdir(), "ke-chat-observability-")), [new HermesAdapter()]);

    const response = await app.request("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });

    expect(response.status).toBe(200);
    const sse = await response.text();
    expect(sse.match(/event: error/g)).toHaveLength(1);
    expect(sse).not.toContain("event: done");
    const operation = (await readAllOpRecords()).find(record => record.op === "chat-stream");
    expect((await readOpTrace(operation!.id)).map(event => event.type)).toEqual([
      "turn.plan", "adapter.selected", "fallback", "error",
    ]);
  });

  it("records a successful fallback output and one terminal done event", async () => {
    globalThis.fetch = vi.fn(async () => new Response("unavailable", { status: 503, statusText: "Unavailable" })) as typeof fetch;
    const app = buildApp(
      mkdtempSync(join(tmpdir(), "ke-chat-observability-")),
      [new HermesAdapter(), new CodexFallbackAdapter()],
    );

    const response = await app.request("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });

    expect(response.status).toBe(200);
    const sse = await response.text();
    expect(sse.match(/event: done/g)).toHaveLength(1);
    expect(sse).not.toContain("event: error");
    const operation = (await readAllOpRecords()).find(record => record.op === "chat-stream");
    expect((await readOpTrace(operation!.id)).map(event => event.type)).toEqual([
      "turn.plan", "adapter.selected", "fallback", "output",
    ]);
  });

  it("ends a partial Codex fallback failure with one error and no done", async () => {
    globalThis.fetch = vi.fn(async () => new Response("unavailable", { status: 503, statusText: "Unavailable" })) as typeof fetch;
    const app = buildApp(
      mkdtempSync(join(tmpdir(), "ke-chat-observability-")),
      [new HermesAdapter(), new FailingCodexFallbackAdapter()],
    );

    const response = await app.request("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });

    expect(response.status).toBe(200);
    const sse = await response.text();
    expect(sse.match(/event: error/g)).toHaveLength(1);
    expect(sse).not.toContain("event: done");
    const operations = (await readAllOpRecords()).filter(record => record.op === "chat-stream");
    expect(operations.at(-1)?.status).toBe("error");
    expect((await readOpTrace(operations[0]!.id)).map(event => event.type)).toEqual([
      "turn.plan", "adapter.selected", "fallback", "error",
    ]);
  });

  it("ends a silent Codex fallback with one error and no done", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("data: [DONE]\n\n", { status: 200 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503, statusText: "Unavailable" })) as typeof fetch;
    const app = buildApp(
      mkdtempSync(join(tmpdir(), "ke-chat-observability-")),
      [new HermesAdapter(), new SilentCodexFallbackAdapter()],
    );

    const response = await app.request("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });

    expect(response.status).toBe(200);
    const sse = await response.text();
    expect(sse.match(/event: error/g)).toHaveLength(1);
    expect(sse).not.toContain("event: done");
    const operations = (await readAllOpRecords()).filter(record => record.op === "chat-stream");
    expect(operations.at(-1)?.status).toBe("error");
    expect((await readOpTrace(operations[0]!.id)).map(event => event.type)).toEqual([
      "turn.plan", "adapter.selected", "fallback", "error",
    ]);
  });
});
