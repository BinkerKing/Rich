import { afterEach, describe, expect, it, vi } from "vitest";
import { chatRoutes } from "../src/routes/chat.js";
import type { AgentConversationConfig, AgentConversationConfigRepo, AgentConversationStatus } from "../src/repos/AgentConversationConfigRepo.js";
import type { ChatConversation, ChatConversationSummary, ChatConversationsRepo, ChatMessageRecord } from "../src/repos/ChatConversationsRepo.js";
import type { AIAdapter } from "../src/ai/adapter.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../src/db/sqlite.js";
import { SqliteAgentConversationConfigRepo } from "../src/repos/SqliteAgentConversationConfigRepo.js";
import { SqliteAgentConversationTurnRepo } from "../src/repos/SqliteAgentConversationTurnRepo.js";
import { SqliteChatConversationsRepo } from "../src/repos/SqliteChatConversationsRepo.js";
import { buildApp } from "../src/index.js";
import { HermesAdapter as HttpHermesAdapter } from "../src/ai/hermes.js";

class MemoryAgentConfigs implements AgentConversationConfigRepo {
  rows = new Map<string, AgentConversationConfig>();
  async get(id: string) { return structuredClone(this.rows.get(id) ?? null); }
  async save(value: AgentConversationConfig) { this.rows.set(value.conversationId, structuredClone(value)); }
  async setStatus(id: string, status: AgentConversationStatus, updatedAt: string) {
    const row = this.rows.get(id); if (row) this.rows.set(id, { ...row, status, updatedAt });
  }
  async setModelSessionId(id: string, modelSessionId: string | undefined, updatedAt: string) {
    const row = this.rows.get(id); if (row) this.rows.set(id, { ...row, modelSessionId, updatedAt });
  }
}

class MemoryConversations implements ChatConversationsRepo {
  conversations = new Map<string, ChatConversation>();
  messages: ChatMessageRecord[] = [];
  async ensureConversation(input: { id: string; title?: string; surface?: string; now: string }) {
    const existing = this.conversations.get(input.id);
    const value = existing ?? { id: input.id, title: input.title ?? "Rich 对话", surface: input.surface ?? "chat", createdAt: input.now, updatedAt: input.now, lastMessageAt: input.now };
    this.conversations.set(input.id, value); return value;
  }
  async appendMessage(message: ChatMessageRecord) { this.messages.push(structuredClone(message)); }
  async listMessages(id: string, limit: number) { return this.messages.filter(message => message.conversationId === id).slice(-limit); }
  async listConversations(limit: number) { return [...this.conversations.values()].slice(0, limit); }
  async countMessages(id: string) { return this.messages.filter(message => message.conversationId === id).length; }
  async getSummary(_id: string): Promise<ChatConversationSummary | null> { return null; }
  async upsertSummary(_summary: ChatConversationSummary) {}
}

afterEach(() => vi.restoreAllMocks());

describe("chat Agent session routes", () => {
  it("starts, exits, resumes, and replaces a Hermes session", async () => {
    const configs = new MemoryAgentConfigs();
    const conversations = new MemoryConversations();
    const app = chatRoutes(null, [], conversations, undefined, undefined, configs);

    const started = await app.request("/conversations/c1/agent-session", { method: "POST" });
    expect(started.status).toBe(200);
    expect(await started.json()).toEqual(expect.objectContaining({ status: "active", resumed: false }));

    await configs.setModelSessionId("c1", "hs-1", new Date().toISOString());
    const exited = await app.request("/conversations/c1/agent-session", { method: "DELETE" });
    expect(exited.status).toBe(200);
    expect(await configs.get("c1")).toEqual(expect.objectContaining({ status: "inactive", modelSessionId: "hs-1" }));

    const resumed = await app.request("/conversations/c1/agent-session", { method: "POST" });
    expect(await resumed.json()).toEqual(expect.objectContaining({ status: "active", resumed: true, modelSessionId: "hs-1" }));

    const replaced = await app.request("/conversations/c1/agent-session/new", { method: "POST" });
    expect(await replaced.json()).toEqual(expect.objectContaining({ status: "active", resumed: false }));
    expect((await configs.get("c1"))?.modelSessionId).toBeUndefined();
  });

  it("continues an active Agent turn with Hermes session_id and stores the returned session", async () => {
    const configs = new MemoryAgentConfigs();
    const conversations = new MemoryConversations();
    const now = new Date().toISOString();
    await conversations.ensureConversation({ id: "c1", now });
    await configs.save({ conversationId: "c1", executor: "hermes", permissionProfile: "chat_only", allowedMcpServers: [], status: "active", modelSessionId: "hs-old", createdAt: now, updatedAt: now });
    const requests: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const body = 'data: {"session_id":"hs-new","choices":[{"delta":{"content":"done"}}]}\n\ndata: [DONE]\n\n';
      return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
    }));
    const app = chatRoutes(null, [], conversations, undefined, undefined, configs);

    const response = await app.request("/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "c1", surface: "home", messages: [{ role: "user", content: "continue" }] }),
    });
    await response.text();

    expect(requests[0]?.session_id).toBe("hs-old");
    expect(JSON.stringify(requests[0]?.messages)).not.toContain("执行任务模式");
    expect(await configs.get("c1")).toEqual(expect.objectContaining({ modelSessionId: "hs-new" }));
    expect(conversations.messages.at(-1)).toEqual(expect.objectContaining({ role: "assistant", modelSessionId: "hs-new" }));
  });

  it("does not silently switch an active Hermes session to Codex", async () => {
    const configs = new MemoryAgentConfigs();
    const conversations = new MemoryConversations();
    const now = new Date().toISOString();
    await conversations.ensureConversation({ id: "c1", now });
    await configs.save({ conversationId: "c1", executor: "hermes", permissionProfile: "chat_only", allowedMcpServers: [], status: "active", modelSessionId: "hs-old", createdAt: now, updatedAt: now });
    let codexCalls = 0;
    const codex: AIAdapter = {
      name: "codex",
      async available() { return true; },
      async *stream() {
        codexCalls += 1;
        yield { type: "delta", text: "wrong executor" };
      },
    };
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const app = chatRoutes(null, [codex], conversations, undefined, undefined, configs);

    const response = await app.request("/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "c1", surface: "home", messages: [{ role: "user", content: "continue" }] }),
    });
    const events = await response.text();

    expect(events).toContain("Hermes unreachable");
    expect(events).not.toContain("codex-fallback");
    expect(codexCalls).toBe(0);
    expect(await configs.get("c1")).toEqual(expect.objectContaining({ status: "active", modelSessionId: "hs-old" }));
  });

  it("retries a rejected Hermes session once without the stale session id", async () => {
    const configs = new MemoryAgentConfigs();
    const conversations = new MemoryConversations();
    const now = new Date().toISOString();
    await conversations.ensureConversation({ id: "c1", now });
    await configs.save({ conversationId: "c1", executor: "hermes", permissionProfile: "chat_only", allowedMcpServers: [], status: "active", modelSessionId: "stale", createdAt: now, updatedAt: now });
    const requests: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      if (requests.length === 1) return new Response(JSON.stringify({ error: { message: "session not found" } }), { status: 404 });
      return new Response('data: {"session_id":"fresh","choices":[{"delta":{"content":"recovered"}}]}\n\ndata: [DONE]\n\n', { status: 200, headers: { "content-type": "text/event-stream" } });
    }));
    const app = chatRoutes(null, [], conversations, undefined, undefined, configs);

    const response = await app.request("/stream", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: "c1", messages: [{ role: "user", content: "continue" }] }) });
    const events = await response.text();

    expect(events).toContain("recovered");
    expect(requests).toHaveLength(2);
    expect(requests[1]?.session_id).toBeUndefined();
    expect((await configs.get("c1"))?.modelSessionId).toBe("fresh");
  });

  it("admits an active Agent message as a durable turn and completes it", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-chat-agent-turn-")), "rich.db"));
    const conversations = new SqliteChatConversationsRepo(db);
    const configs = new SqliteAgentConversationConfigRepo(db);
    const turns = new SqliteAgentConversationTurnRepo(db);
    const now = "2026-09-01T00:00:00.000Z";
    await conversations.ensureConversation({ id: "c1", now });
    await configs.save({ conversationId: "c1", executor: "hermes", permissionProfile: "chat_only", allowedMcpServers: [], status: "active", createdAt: now, updatedAt: now });
    vi.stubGlobal("fetch", vi.fn(async () => {
      const body = 'data: {"session_id":"hs-new","choices":[{"delta":{"content":"done"}}]}\n\ndata: [DONE]\n\n';
      return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
    }));
    const app = chatRoutes(null, [], conversations, undefined, undefined, configs, turns);

    const response = await app.request("/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: "c1",
        clientRequestId: "request-1",
        userMessageId: "message-1",
        surface: "home",
        messages: [{ role: "user", content: "continue" }],
      }),
    });
    const events = await response.text();
    const turn = await turns.getByClientRequest("c1", "request-1");

    expect(events).toContain(`"turnId":"${turn?.id}"`);
    for (const line of events.split("\n").filter(line => line.startsWith("data: "))) {
      expect(JSON.parse(line.slice(6))).toEqual(expect.objectContaining({ turnId: turn?.id }));
    }
    expect(turn).toEqual(expect.objectContaining({ status: "succeeded", runtimeSessionId: "hs-new" }));
    expect(await conversations.listMessages("c1", 10)).toHaveLength(2);
  });

  it("streams active Agent text through AgentConversationService", async () => {
    const requests: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const body = 'data: {"session_id":"service-session","choices":[{"delta":{"content":"from service"}}]}\n\ndata: [DONE]\n\n';
      return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
    }));
    const app = buildApp(mkdtempSync(join(tmpdir(), "rich-agent-service-route-")), [new HttpHermesAdapter()]);
    await app.request("/api/chat/conversations/c1/agent-session", { method: "POST" });

    const response = await app.request("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: "c1", clientRequestId: "request-1", userMessageId: "message-1",
        surface: "home", messages: [{ role: "user", content: "continue" }],
      }),
    });
    const events = await response.text();

    expect(events).toContain("event: turn");
    expect(events).toContain("from service");
    expect(events).toContain("service-session");
    expect(requests[0]).toMatchObject({ tools: [], tool_choice: "none" });
  });
});
