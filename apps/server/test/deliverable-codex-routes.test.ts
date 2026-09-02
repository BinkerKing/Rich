import { describe, expect, it } from "vitest";
import { deliverableCodexRoutes } from "../src/routes/deliverableCodex.js";

describe("deliverable Codex routes", () => {
  it("creates multiple scoped conversations and archives without deleting their chat history", async () => {
    const conversations = new Map<string, Record<string, unknown>>();
    const chats: Array<Record<string, unknown>> = [];
    const agents: string[] = [];
    const app = deliverableCodexRoutes({
      conversations: {
        async create(value) { conversations.set(value.id, { ...value }); },
        async get(id) { return (conversations.get(id) as never) ?? null; },
        async listActive(scopeKey) { return [...conversations.values()].filter(value => value.scopeKey === scopeKey && value.status === "active") as never; },
        async touch(id, at) { const value = conversations.get(id)!; Object.assign(value, { updatedAt: at, lastActiveAt: at }); return value as never; },
        async archive(id, at) { const value = conversations.get(id)!; Object.assign(value, { status: "archived", updatedAt: at }); return value as never; },
        async setCodexThread() {},
      },
      chats: {
        async ensureConversation(input) { chats.push({ type: "conversation", ...input }); return { ...input, title: input.title ?? "", surface: input.surface ?? "", createdAt: input.now, updatedAt: input.now, lastMessageAt: input.now }; },
        async appendMessage(message) { chats.push({ type: "message", ...message }); },
        async listMessages(conversationId) { return chats.filter(item => item.type === "message" && item.conversationId === conversationId) as never; },
      } as never,
      context: { async build(input) { return { scopeKey: `deliverable:${input.projectId}:${input.deliverableId}`, contextVersion: "ctx-v1", systemInstruction: "mode rules", initialContext: "deliverable context", allowedMcpTools: input.mode === "task" ? ["rich_task_report_result"] : [] }; } } as never,
      agents: { async start(id) { agents.push(`start:${id}`); return { config: {} as never, resumed: false }; }, async exit(id) { agents.push(`exit:${id}`); return null; } } as never,
      projects: { async listAllModuleItems() { return [{ id: "d1", content: { recordType: "deliverable", records: [] } }]; }, async updateModuleItem() { return null; } } as never,
    });

    const first = await app.request("/p1/d1/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "检查字段", mode: "task" }) });
    const second = await app.request("/p1/d1/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "自由讨论", mode: "free" }) });
    const firstJson = await first.json() as { conversation: { id: string; mode: string; allowedMcpTools: string[] } };
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(firstJson.conversation).toMatchObject({ mode: "task", allowedMcpTools: ["rich_task_report_result"] });
    expect((await (await app.request("/p1/d1/conversations")).json() as { conversations: unknown[] }).conversations).toHaveLength(2);
    expect((await (await app.request(`/conversations/${firstJson.conversation.id}/messages`)).json() as { messages: unknown[] }).messages).toHaveLength(1);
    expect((await app.request(`/conversations/${firstJson.conversation.id}/writeback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary: "已完成检查" }) })).status).toBe(201);
    const secondJson = await second.json() as { conversation: { id: string } };
    expect((await app.request(`/conversations/${secondJson.conversation.id}/writeback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary: "不应写入" }) })).status).toBe(403);

    const archived = await app.request(`/conversations/${firstJson.conversation.id}/archive`, { method: "POST" });
    expect(archived.status).toBe(200);
    expect((await (await app.request("/p1/d1/conversations")).json() as { conversations: unknown[] }).conversations).toHaveLength(1);
    expect(chats.filter(item => item.type === "message")).toHaveLength(2);
    expect(agents.some(value => value.startsWith("exit:"))).toBe(true);
  });
});
