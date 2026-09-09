import { describe, expect, it } from "vitest";
import { deliverableCodexRoutes } from "../src/routes/deliverableCodex.js";

describe("deliverable Codex routes", () => {
  it("renders changed task rules with variables and publishes the policy card before starting Codex", async () => {
    const chats: Array<Record<string, unknown>> = [{
      type: "message", conversationId: "chat-1", role: "system", content: "旧规则",
      metadata: { type: "task-mode-policy-updated", promptRevision: "old-revision", policyContent: "共有规则\n旧规则\n项目=p1;交付物=d1;资料=交付物资料;指令=" }, createdAt: "2026-09-04T00:00:00.000Z",
    }];
    let ruleWasSavedBeforeCodex = false;
    const app = deliverableCodexRoutes({
      conversations: {
        async get() { return { id: "c1", conversationId: "chat-1", projectId: "p1", deliverableId: "d1", status: "active", contextVersion: "ctx-v1" } as never; },
        async touch() {}, async setCodexThread() {},
      } as never,
      chats: {
        async listMessages() { return chats.filter(item => item.type === "message") as never; },
        async appendMessage(message) { chats.push({ type: "message", ...message }); },
      } as never,
      context: { async build() { return { workspaceRoot: "/workspace", initialContext: "交付物资料", contextVersion: "ctx-v1" }; } } as never,
      prompts: {
        async revision() { return "new-revision"; },
        async render(_key, variables) { return { content: `共有规则\n新规则\n项目=${variables.projectId};交付物=${variables.deliverableId};资料=${variables.deliverableContext};指令=${variables.userMessage}`, template: {} as never, included: [] }; },
      } as never,
      agents: {
        async start() { return { config: {} as never, resumed: true }; },
        async sendMessage(_conversationId, input, onEvent) {
          ruleWasSavedBeforeCodex = chats.some(item => item.metadata && (item.metadata as { type?: string }).type === "task-mode-policy-updated");
          expect(input.content).toBe("共有规则\n新规则\n项目=p1;交付物=d1;资料=交付物资料;指令=继续试一下");
          await onEvent?.({ type: "done", turnId: "turn-1", content: "完成" });
          return { turn: { runtimeSessionId: "thread-1" }, events: [] };
        },
      } as never,
      attachments: null,
    });

    const response = await app.request("/conversations/c1/stream", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "继续试一下", clientRequestId: "request-1", userMessageId: "message-1" }) });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("event: policy");
    const policy = chats.findLast(item => item.metadata && (item.metadata as { type?: string }).type === "task-mode-policy-updated");
    expect(policy?.content).toBe("新规则");
    expect((policy?.metadata as { policyContent?: string }).policyContent).toContain("共有规则\n新规则");
    expect(ruleWasSavedBeforeCodex).toBe(true);
  });

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
    expect(firstJson.conversation).toMatchObject({ mode: "free", allowedMcpTools: [] });
    expect((await (await app.request("/p1/d1/conversations")).json() as { conversations: unknown[] }).conversations).toHaveLength(2);
    expect((await (await app.request(`/conversations/${firstJson.conversation.id}/messages`)).json() as { messages: unknown[] }).messages).toHaveLength(0);
    const event = await app.request(`/conversations/${firstJson.conversation.id}/events/task-mode-started`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: "start-general", startedAt: new Date().toISOString(), mode: { id: "general-task", label: "任务模式" }, location: { page: ["任务工作台"] } }) });
    expect(event.status).toBe(201);
    expect((await (await app.request(`/conversations/${firstJson.conversation.id}/messages`)).json() as { messages: unknown[] }).messages).toHaveLength(1);

    const archived = await app.request(`/conversations/${firstJson.conversation.id}/archive`, { method: "POST" });
    expect(archived.status).toBe(200);
    expect((await (await app.request("/p1/d1/conversations")).json() as { conversations: unknown[] }).conversations).toHaveLength(1);
    expect(chats.filter(item => item.type === "message")).toHaveLength(1);
    expect(agents.some(value => value.startsWith("exit:"))).toBe(true);
  });
});
