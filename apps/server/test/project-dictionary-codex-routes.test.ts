import { describe, expect, it } from "vitest";
import { projectDictionaryCodexRoutes } from "../src/routes/projectDictionaryCodex.js";

describe("project dictionary Codex routes", () => {
  it("creates a named bound Session when a project has none", async () => {
    const values = new Map<string, Record<string, unknown>>();
    const started: Array<{ id: string; fresh?: boolean }> = [];
    const app = projectDictionaryCodexRoutes({
      conversations: {
        async getBound() { return null; },
        async create(value) { values.set(value.id, { ...value }); },
        async bind(id) { const value = values.get(id)!; Object.assign(value, { isBound: true }); return value as never; },
      } as never,
      chats: { async ensureConversation(input) { return input as never; } } as never,
      context: { async build(projectId) { return { scopeKey: `dictionary:${projectId}`, initialContext: "数据字典基线", workspaceRoot: "/workspace" }; } } as never,
      projects: { async get() { return { type: "project", title: "支付项目" }; } } as never,
      agents: { async start(id, options) { started.push({ id, fresh: options.fresh }); return { config: {} as never, resumed: false }; } } as never,
    });

    const response = await app.request("/project-1/conversations/ensure-bound", { method: "POST" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ created: true, context: "数据字典基线", conversation: { projectId: "project-1", isBound: true, title: "支付项目 · 数据字典 · Codex" } });
    expect(started).toHaveLength(1);
    expect(started[0].fresh).toBe(true);
  });

  it("creates a replacement Session after its bound Session is archived", async () => {
    let bound: Record<string, unknown> | null = { id: "old", conversationId: "chat-old", projectId: "project-1", status: "active", isBound: true };
    const app = projectDictionaryCodexRoutes({
      conversations: {
        async getBound() { return bound as never; },
        async archive() { bound = null; return null; },
      } as never,
      chats: {} as never,
      context: {} as never,
      projects: {} as never,
      agents: { async exit() { return null; } } as never,
    });

    const response = await app.request("/project-1/conversations/archive-bound", { method: "POST" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ archived: true });
    expect(bound).toBeNull();
  });

  it("creates a fresh bound Session after an archived binding", async () => {
    const values = new Map<string, Record<string, unknown>>();
    const started: Array<{ id: string; fresh?: boolean }> = [];
    const app = projectDictionaryCodexRoutes({
      conversations: {
        async getBound() { return [...values.values()].find(value => value.status === "active" && value.isBound) as never; },
        async create(value) { values.set(value.id, { ...value }); },
        async bind(id) { const value = values.get(id)!; Object.assign(value, { isBound: true }); return value as never; },
        async archive(id) { const value = values.get(id)!; Object.assign(value, { status: "archived", isBound: false }); return value as never; },
      } as never,
      chats: { async ensureConversation(input) { return input as never; } } as never,
      context: { async build(projectId) { return { scopeKey: `dictionary:${projectId}`, initialContext: "数据字典基线" }; } } as never,
      projects: { async get() { return { type: "project", title: "支付项目" }; } } as never,
      agents: { async start(id, options) { started.push({ id, fresh: options.fresh }); return { config: {} as never, resumed: false }; }, async exit() { return null; } } as never,
    });

    const first = await app.request("/project-1/conversations/ensure-bound", { method: "POST" });
    const firstId = (await first.json() as { conversation: { id: string } }).conversation.id;
    await app.request("/project-1/conversations/archive-bound", { method: "POST" });
    const second = await app.request("/project-1/conversations/ensure-bound", { method: "POST" });
    const secondId = (await second.json() as { conversation: { id: string } }).conversation.id;

    expect(second.status).toBe(201);
    expect(secondId).not.toBe(firstId);
    expect(started).toHaveLength(2);
    expect(started.every(item => item.fresh)).toBe(true);
  });

  it("lets the agent turn own the user-message write for a streamed request", async () => {
    let appended = 0;
    const app = projectDictionaryCodexRoutes({
      conversations: { async get() { return { id: "binding-1", projectId: "project-1", conversationId: "chat-1", status: "active" }; }, async setCodexThread() {}, async touch() {} } as never,
      chats: { async appendMessage() { appended += 1; } } as never,
      context: { async build() { return { systemInstruction: "dictionary", initialContext: "context" }; } } as never,
      projects: {} as never,
      agents: { async start() {}, async sendMessage() { return { turn: {}, events: [] }; } } as never,
    });

    const response = await app.request("/conversations/binding-1/stream", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "维护资料库", clientRequestId: "request-1", userMessageId: "message-1" }) });

    expect(response.status).toBe(200);
    await response.text();
    expect(appended).toBe(0);
  });
});
