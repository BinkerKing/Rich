import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { AgentConversationService, type AgentConversationEvent } from "../agent-conversations/AgentConversationService.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";
import type { DeliverableCodexConversationRepo, DeliverableCodexMode } from "../repos/DeliverableCodexConversationRepo.js";
import type { DeliverableCodexContextService } from "../deliverable-codex/DeliverableCodexContextService.js";

const modes: DeliverableCodexMode[] = ["free", "task", "bug"];

export function deliverableCodexRoutes(deps: {
  conversations: DeliverableCodexConversationRepo;
  chats: ChatConversationsRepo;
  context: DeliverableCodexContextService;
  agents: AgentConversationService;
}): Hono {
  const r = new Hono();
  const scopeKey = (projectId: string, deliverableId: string) => `deliverable:${projectId}:${deliverableId}`;

  r.get("/:projectId/:deliverableId/conversations", async c => {
    return c.json({ conversations: await deps.conversations.listActive(scopeKey(c.req.param("projectId"), c.req.param("deliverableId"))) });
  });

  r.post("/:projectId/:deliverableId/conversations", async c => {
    const body = await c.req.json().catch(() => null) as { title?: unknown; mode?: unknown } | null;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const mode = body?.mode;
    if (!title || !modes.includes(mode as DeliverableCodexMode)) return c.json({ error: "title and a valid mode are required" }, 400);
    const projectId = c.req.param("projectId");
    const deliverableId = c.req.param("deliverableId");
    try {
      const context = await deps.context.build({ projectId, deliverableId, mode: mode as DeliverableCodexMode });
      const now = new Date().toISOString();
      const id = randomUUID();
      const conversationId = `deliverable-codex:${id}`;
      await deps.chats.ensureConversation({ id: conversationId, title, surface: "deliverable-codex", now });
      await deps.chats.appendMessage({ id: randomUUID(), conversationId, role: "system", content: `${context.systemInstruction}\n\n${context.initialContext}`, createdAt: now });
      await deps.conversations.create({ id, conversationId, scopeKey: context.scopeKey, projectId, deliverableId, title, mode: mode as DeliverableCodexMode, executor: "codex", status: "active", contextVersion: context.contextVersion, createdAt: now, updatedAt: now, lastActiveAt: now });
      const session = await deps.agents.start(conversationId, { fresh: true, executor: "codex" });
      return c.json({ conversation: { ...(await deps.conversations.get(id))!, resumed: session.resumed, allowedMcpTools: context.allowedMcpTools } }, 201);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  });

  r.post("/conversations/:id/archive", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing) return c.json({ error: "Conversation not found" }, 404);
    const archived = await deps.conversations.archive(existing.id, new Date().toISOString());
    await deps.agents.exit(existing.conversationId);
    return c.json({ conversation: archived });
  });

  r.post("/conversations/:id/stream", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing || existing.status !== "active") return c.json({ error: "Active conversation not found" }, 404);
    const body = await c.req.json().catch(() => null) as { content?: unknown; clientRequestId?: unknown; userMessageId?: unknown } | null;
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const clientRequestId = typeof body?.clientRequestId === "string" ? body.clientRequestId : "";
    const userMessageId = typeof body?.userMessageId === "string" ? body.userMessageId : "";
    if (!content || !clientRequestId || !userMessageId) return c.json({ error: "content, clientRequestId and userMessageId are required" }, 400);
    await deps.chats.appendMessage({ id: userMessageId, conversationId: existing.conversationId, role: "user", content, createdAt: new Date().toISOString() });
    await deps.conversations.touch(existing.id, new Date().toISOString());
    return streamSSE(c, async stream => {
      const write = async (event: AgentConversationEvent) => {
        const name = event.type === "delta" ? "text" : event.type === "done" ? "done" : event.type;
        const data = event.type === "delta" ? { chunk: event.text, turnId: event.turnId } : event;
        await stream.writeSSE({ event: name, data: JSON.stringify(data) });
      };
      try {
        const result = await deps.agents.sendMessage(existing.conversationId, { clientRequestId, userMessageId, content }, write);
        const sessionId = result.turn.runtimeSessionId;
        if (sessionId) await deps.conversations.setCodexThread(existing.id, sessionId, existing.contextVersion, new Date().toISOString());
      } catch (error) {
        await stream.writeSSE({ event: "error", data: JSON.stringify({ message: error instanceof Error ? error.message : String(error) }) });
      }
    });
  });

  return r;
}
