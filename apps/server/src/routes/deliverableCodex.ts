import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { AgentConversationService, type AgentConversationEvent } from "../agent-conversations/AgentConversationService.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";
import type { DeliverableCodexConversationRepo, DeliverableCodexMode } from "../repos/DeliverableCodexConversationRepo.js";
import type { DeliverableCodexContextService } from "../deliverable-codex/DeliverableCodexContextService.js";
import type { ProjectManagementRepo } from "../repos/ProjectManagementRepo.js";
import type { ChatAttachmentsRepo } from "../repos/ChatAttachmentsRepo.js";

const modes: DeliverableCodexMode[] = ["free", "task", "bug"];

export function deliverableCodexRoutes(deps: {
  conversations: DeliverableCodexConversationRepo;
  chats: ChatConversationsRepo;
  context: DeliverableCodexContextService;
  agents: AgentConversationService;
  projects: Pick<ProjectManagementRepo, "listAllModuleItems" | "updateModuleItem">;
  attachments: ChatAttachmentsRepo | null;
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

  r.get("/conversations/:id/messages", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing) return c.json({ error: "Conversation not found" }, 404);
    const messages = await deps.chats.listMessages(existing.conversationId, 200);
    return c.json({ messages: await Promise.all(messages.map(async message => ({ ...message, attachments: deps.attachments ? await deps.attachments.byMessage(message.id) : [] }))) });
  });

  r.get("/conversations/:id/status", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing || existing.status !== "active") return c.json({ server: true, session: false, state: "session_lost" }, 404);
    const connection = await deps.agents.connectionStatus(existing.conversationId);
    const state = !connection.server ? "server_offline" : !connection.session ? "session_lost" : "connected";
    return c.json({ ...connection, state });
  });

  r.post("/conversations/:id/writeback", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    const body = await c.req.json().catch(() => null) as { summary?: unknown } | null;
    const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
    if (!existing || existing.status !== "active") return c.json({ error: "Active conversation not found" }, 404);
    if (existing.mode !== "task") return c.json({ error: "Writeback is available only in task mode" }, 403);
    if (!summary || summary.length > 2_000) return c.json({ error: "A summary up to 2000 characters is required" }, 400);
    const deliverable = (await deps.projects.listAllModuleItems(existing.projectId, "deliverables")).find(item => item.id === existing.deliverableId);
    if (!deliverable || deliverable.content.recordType !== "deliverable") return c.json({ error: "Deliverable not found" }, 404);
    const now = new Date().toISOString();
    const records = Array.isArray(deliverable.content.records) ? deliverable.content.records : [];
    const record = { id: randomUUID(), kind: "status", text: summary, createdAt: now, informationType: "information", attachments: [], author: "Codex" };
    await deps.projects.updateModuleItem(existing.projectId, deliverable.id, { content: { ...deliverable.content, records: [...records, record] } });
    return c.json({ record, status: "written" }, 201);
  });

  r.post("/conversations/:id/stream", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing || existing.status !== "active") return c.json({ error: "Active conversation not found" }, 404);
    const body = await c.req.json().catch(() => null) as { content?: unknown; clientRequestId?: unknown; userMessageId?: unknown; attachments?: unknown } | null;
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const clientRequestId = typeof body?.clientRequestId === "string" ? body.clientRequestId : "";
    const userMessageId = typeof body?.userMessageId === "string" ? body.userMessageId : "";
    if (!content || !clientRequestId || !userMessageId) return c.json({ error: "content, clientRequestId and userMessageId are required" }, 400);
    const attachmentIds = Array.isArray(body?.attachments) ? body.attachments.flatMap(item => typeof item === "object" && item && typeof (item as { id?: unknown }).id === "string" ? [(item as { id: string }).id] : []) : [];
    const imageUrls = deps.attachments ? (await Promise.all(attachmentIds.map(async id => {
      const image = await deps.attachments!.getData(id);
      return image ? `data:${image.mime};base64,${Buffer.from(image.data).toString("base64")}` : undefined;
    }))).filter((url): url is string => Boolean(url)) : [];
    await deps.conversations.touch(existing.id, new Date().toISOString());
    return streamSSE(c, async stream => {
      const write = async (event: AgentConversationEvent) => {
        const name = event.type === "delta" ? "text" : event.type === "done" ? "done" : event.type;
        const data = event.type === "delta" ? { chunk: event.text, turnId: event.turnId } : event;
        await stream.writeSSE({ event: name, data: JSON.stringify(data) });
      };
      try {
        const result = await deps.agents.sendMessage(existing.conversationId, { clientRequestId, userMessageId, content, imageUrls }, write);
        if (deps.attachments) await Promise.all(attachmentIds.map(id => deps.attachments!.bindToMessage(id, userMessageId)));
        const sessionId = result.turn.runtimeSessionId;
        if (sessionId) await deps.conversations.setCodexThread(existing.id, sessionId, existing.contextVersion, new Date().toISOString());
      } catch (error) {
        await stream.writeSSE({ event: "error", data: JSON.stringify({ message: error instanceof Error ? error.message : String(error) }) });
      }
    });
  });

  return r;
}
