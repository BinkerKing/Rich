import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AgentConversationService } from "../agent-conversations/AgentConversationService.js";
import type { DictionaryCodexContextService } from "../project-dictionary-codex/DictionaryCodexContextService.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { ProjectDictionaryCodexConversationRepo } from "../repos/ProjectDictionaryCodexConversationRepo.js";
import { createBoundContextCard, isBoundContextCard } from "../codex/BoundContextCard.js";

export function projectDictionaryCodexRoutes(deps: {
  conversations: ProjectDictionaryCodexConversationRepo;
  chats: ChatConversationsRepo;
  context: DictionaryCodexContextService;
  projects: Pick<ElementsRepo, "get">;
  agents: AgentConversationService;
}): Hono {
  const r = new Hono();
  const createBoundConversation = async (projectId: string) => {
    const project = await deps.projects.get(projectId);
    if (!project || project.type !== "project") throw new Error("项目不存在或不是项目记录。");
    const context = await deps.context.build(projectId);
    const now = new Date().toISOString();
    const id = randomUUID();
    const conversationId = `project-dictionary-codex:${id}`;
    const title = `${project.title} · 数据字典 · Codex`;
    await deps.chats.ensureConversation({ id: conversationId, title, surface: "project-dictionary-codex", now });
    await deps.conversations.create({ id, conversationId, projectId, title, executor: "codex", status: "active", isBound: true, createdAt: now, updatedAt: now, lastActiveAt: now });
    const conversation = await deps.conversations.bind(id, now);
    if (!conversation) throw new Error("Unable to bind project dictionary Codex conversation.");
    const session = await deps.agents.start(conversationId, { fresh: true, executor: "codex", workspaceRoot: context.workspaceRoot });
    return { conversation: { ...conversation, resumed: session.resumed, allowedMcpTools: context.allowedMcpTools }, context: context.initialContext };
  };

  r.get("/:projectId/conversations", async c => c.json({ conversations: await deps.conversations.listActive(c.req.param("projectId")) }));

  r.post("/:projectId/conversations/ensure-bound", async c => {
    const projectId = c.req.param("projectId");
    const existing = await deps.conversations.getBound(projectId);
    if (existing) return c.json({ conversation: existing, created: false });
    try {
      return c.json({ ...(await createBoundConversation(projectId)), created: true }, 201);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  });

  r.post("/:projectId/conversations/archive-bound", async c => {
    const bound = await deps.conversations.getBound(c.req.param("projectId"));
    if (!bound) return c.json({ archived: false });
    await deps.conversations.archive(bound.id, new Date().toISOString());
    await deps.agents.exit(bound.conversationId);
    return c.json({ archived: true });
  });

  r.get("/conversations/:id/messages", async c => {
    const conversation = await deps.conversations.get(c.req.param("id"));
    if (!conversation) return c.json({ error: "Conversation not found" }, 404);
    const savedMessages = await deps.chats.listMessages(conversation.conversationId, 200);
    const context = await deps.context.build(conversation.projectId);
    const bindingCard = savedMessages.some(isBoundContextCard)
      ? undefined
      : createBoundContextCard(conversation.conversationId, context);
    if (bindingCard) await deps.chats.appendMessage(bindingCard);
    return c.json({ messages: bindingCard ? [...savedMessages, bindingCard] : savedMessages });
  });

  r.get("/conversations/:id/status", async c => {
    const conversation = await deps.conversations.get(c.req.param("id"));
    if (!conversation || conversation.status !== "active") return c.json({ server: true, session: false, state: "session_lost", running: false }, 404);
    const connection = await deps.agents.connectionStatus(conversation.conversationId);
    return c.json({ ...connection, state: !connection.server ? "server_offline" : !connection.session ? "session_lost" : "connected", running: deps.agents.isRunning(conversation.conversationId) });
  });

  r.post("/conversations/:id/archive", async c => {
    const conversation = await deps.conversations.get(c.req.param("id"));
    if (!conversation) return c.json({ error: "Conversation not found" }, 404);
    const archived = await deps.conversations.archive(conversation.id, new Date().toISOString());
    await deps.agents.exit(conversation.conversationId);
    return c.json({ conversation: archived });
  });

  r.post("/conversations/:id/interrupt", async c => {
    const conversation = await deps.conversations.get(c.req.param("id"));
    if (!conversation || conversation.status !== "active") return c.json({ error: "Active conversation not found" }, 404);
    return c.json({ interrupted: await deps.agents.interrupt(conversation.conversationId) });
  });

  r.post("/conversations/:id/stream", async c => {
    const conversation = await deps.conversations.get(c.req.param("id"));
    if (!conversation || conversation.status !== "active") return c.json({ error: "Active conversation not found" }, 404);
    const body = await c.req.json().catch(() => null) as { content?: unknown; clientRequestId?: unknown; userMessageId?: unknown } | null;
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const clientRequestId = typeof body?.clientRequestId === "string" ? body.clientRequestId : "";
    const userMessageId = typeof body?.userMessageId === "string" ? body.userMessageId : "";
    if (!content || !clientRequestId || !userMessageId) return c.json({ error: "content, clientRequestId and userMessageId are required" }, 400);
    const context = await deps.context.build(conversation.projectId);
    const session = await deps.agents.start(conversation.conversationId, { executor: "codex", workspaceRoot: context.workspaceRoot });
    if (session.resumed && !(await deps.agents.connectionStatus(conversation.conversationId)).session) {
      await deps.agents.start(conversation.conversationId, { fresh: true, executor: "codex", workspaceRoot: context.workspaceRoot });
    }
    return streamSSE(c, async stream => {
      const write = async (event: { type: string; text?: string; content?: string; turnId?: string; message?: string; status?: string; name?: string }) => {
        const name = event.type === "delta" ? "text" : event.type;
        const data = event.type === "delta" ? { chunk: event.text, turnId: event.turnId } : event.type === "error" ? { message: event.message, turnId: event.turnId } : event;
        await stream.writeSSE({ event: name, data: JSON.stringify(data) });
      };
      try {
        const result = await deps.agents.sendMessage(conversation.conversationId, { clientRequestId, userMessageId, content, runtimeInstruction: `${context.systemInstruction}\n\n${context.initialContext}` }, write);
        if (result.turn.runtimeSessionId) await deps.conversations.setCodexThread(conversation.id, result.turn.runtimeSessionId, new Date().toISOString());
        await deps.conversations.touch(conversation.id, new Date().toISOString());
      } catch (error) {
        await stream.writeSSE({ event: "error", data: JSON.stringify({ message: error instanceof Error ? error.message : String(error) }) });
      }
    });
  });

  return r;
}
