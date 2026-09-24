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
});
