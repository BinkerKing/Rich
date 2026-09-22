import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { AgentConversationService, type AgentConversationEvent } from "../agent-conversations/AgentConversationService.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";
import type { DeliverableCodexConversationRepo } from "../repos/DeliverableCodexConversationRepo.js";
import type { DeliverableCodexContextService } from "../deliverable-codex/DeliverableCodexContextService.js";
import type { ChatAttachmentsRepo } from "../repos/ChatAttachmentsRepo.js";
import type { PromptLibraryService } from "../prompt-library/PromptLibraryService.js";
import { workbenchInstruction } from "../task-workbench/instructions.js";

type TaskModeStart = { id?: unknown; label?: unknown };
type TaskModeLocation = { page?: unknown; project?: { title?: unknown }; business?: { kind?: unknown; title?: unknown } };

function changedPolicyRules(previous: string | undefined, current: string): string {
  if (!previous) return "规则已更新，本次起使用最新规则。";
  const priorLines = new Set(previous.split("\n").map(line => line.trim()).filter(Boolean));
  const changes = current.split("\n").filter(line => line.trim() && !priorLines.has(line.trim()));
  return changes.join("\n") || "规则已更新，本次起使用最新规则。";
}

async function taskModeStartupInstruction(prompts: PromptLibraryService, mode: TaskModeStart, location: TaskModeLocation, deliverableContext: string, projectId: string, deliverableId: string, projectFolder: string): Promise<string> {
  const label = typeof mode.label === "string" ? mode.label : "任务模式";
  const page = Array.isArray(location.page) ? location.page.filter((item): item is string => typeof item === "string").join(" / ") : "未标注页面";
  const project = typeof location.project?.title === "string" ? location.project.title : "未标注项目";
  const businessKind = typeof location.business?.kind === "string" ? location.business.kind : "业务";
  const businessTitle = typeof location.business?.title === "string" ? location.business.title : "未标注业务";
  const rendered = await prompts.render("codex.deliverable-analysis-start", { modeLabel: label, page, businessKind, businessTitle, project, projectId, deliverableId, deliverableContext, projectFolder });
  return `${rendered.content}\n\n## 项目文件访问\n- 项目根目录：${projectFolder}\n- 可读取、创建、修改、移动和删除任意本地文件。\n- 可使用 \`rich_deliverable_file_write\` 写入文本文件，或使用 \`rich_deliverable_file_copy\` 复制文件；两者均支持绝对路径。\n- Rich MCP 的目录与文件查询结果均包含绝对路径。`;
}

export function deliverableCodexRoutes(deps: {
  conversations: DeliverableCodexConversationRepo;
  chats: ChatConversationsRepo;
  context: DeliverableCodexContextService;
  agents: AgentConversationService;
  attachments: ChatAttachmentsRepo | null;
  prompts: PromptLibraryService;
  onTurnCompleted?: (input: { projectId: string; deliverableId: string; summary: string }) => Promise<void>;
}): Hono {
  const r = new Hono();
  const scopeKey = (projectId: string, deliverableId: string) => `deliverable:${projectId}:${deliverableId}`;
  const createBoundConversation = async (projectId: string, deliverableId: string, title: string) => {
    const context = await deps.context.build({ projectId, deliverableId, mode: "free" });
    const now = new Date().toISOString();
    const id = randomUUID();
    const conversationId = `deliverable-codex:${id}`;
    await deps.chats.ensureConversation({ id: conversationId, title, surface: "deliverable-codex", now });
    await deps.conversations.create({ id, conversationId, scopeKey: context.scopeKey, projectId, deliverableId, title, mode: "free", executor: "codex", status: "active", isBound: true, contextVersion: context.contextVersion, createdAt: now, updatedAt: now, lastActiveAt: now });
    const conversation = await deps.conversations.bind(id, now);
    if (!conversation) throw new Error("Unable to bind Codex conversation.");
    const session = await deps.agents.start(conversationId, { fresh: true, executor: "codex", workspaceRoot: context.workspaceRoot });
    return { conversation: { ...conversation, resumed: session.resumed, allowedMcpTools: context.allowedMcpTools }, context: context.initialContext };
  };

  r.get("/conversations", async c => c.json({ conversations: await deps.conversations.listAllActive() }));

  r.get("/:projectId/:deliverableId/conversations", async c => {
    return c.json({ conversations: await deps.conversations.listActive(scopeKey(c.req.param("projectId"), c.req.param("deliverableId"))) });
  });

  r.post("/:projectId/:deliverableId/conversations/ensure-bound", async c => {
    const body = await c.req.json().catch(() => null) as { title?: unknown } | null;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title is required" }, 400);
    const projectId = c.req.param("projectId");
    const deliverableId = c.req.param("deliverableId");
    const existing = await deps.conversations.getBound(scopeKey(projectId, deliverableId));
    if (existing) {
      const context = existing.lastContextSyncAt
        ? await deps.context.buildIncrementalContext({ projectId, deliverableId, since: existing.lastContextSyncAt })
        : (await deps.context.build({ projectId, deliverableId, mode: "free" })).initialContext;
      return c.json({ conversation: existing, created: false, ...(context ? { context } : {}) });
    }
    try {
      const created = await createBoundConversation(projectId, deliverableId, title);
      return c.json({ ...created, created: true }, 201);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  });

  r.post("/:projectId/:deliverableId/conversations/archive-bound", async c => {
    const bound = await deps.conversations.getBound(scopeKey(c.req.param("projectId"), c.req.param("deliverableId")));
    if (!bound) return c.json({ archived: false });
    await deps.conversations.archive(bound.id, new Date().toISOString());
    await deps.agents.exit(bound.conversationId);
    return c.json({ archived: true });
  });

  r.post("/:projectId/:deliverableId/conversations", async c => {
    const body = await c.req.json().catch(() => null) as { title?: unknown } | null;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title is required" }, 400);
    const projectId = c.req.param("projectId");
    const deliverableId = c.req.param("deliverableId");
    try {
      return c.json(await createBoundConversation(projectId, deliverableId, title), 201);
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

  r.post("/conversations/:id/context-synced", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing || existing.status !== "active") return c.json({ error: "Active conversation not found" }, 404);
    await deps.conversations.markContextSynced(existing.id, new Date().toISOString());
    return c.json({ ok: true });
  });

  r.patch("/conversations/:id", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    const body = await c.req.json().catch(() => null) as { title?: unknown } | null;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!existing || existing.status !== "active") return c.json({ error: "Active conversation not found" }, 404);
    if (!title || title.length > 120) return c.json({ error: "A title up to 120 characters is required" }, 400);
    const conversation = await deps.conversations.rename(existing.id, title, new Date().toISOString());
    return c.json({ conversation });
  });

  r.get("/conversations/:id/messages", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing) return c.json({ error: "Conversation not found" }, 404);
    const messages = await deps.chats.listMessages(existing.conversationId, 200);
    return c.json({ messages: await Promise.all(messages.map(async message => ({ ...message, attachments: deps.attachments ? await deps.attachments.byMessage(message.id) : [] }))) });
  });

  r.post("/conversations/:id/events/task-mode-started", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing || existing.status !== "active") return c.json({ error: "Active conversation not found" }, 404);
    const body = await c.req.json().catch(() => null) as { eventId?: unknown; mode?: unknown; location?: unknown; startedAt?: unknown } | null;
    const eventId = typeof body?.eventId === "string" ? body.eventId : "";
    const startedAt = typeof body?.startedAt === "string" ? body.startedAt : "";
    if (!eventId || !startedAt || !body?.mode || !body?.location) return c.json({ error: "eventId, mode, location and startedAt are required" }, 400);
    if ((body.mode as TaskModeStart).id === "general-task") {
      const instruction = workbenchInstruction(existing.id);
      await deps.chats.appendMessage({ id: eventId, conversationId: existing.conversationId, role: "system", content: "任务模式已启动", metadata: { type: "task-mode-started", mode: body.mode, location: body.location }, createdAt: startedAt });
      return c.json({ ok: true, instruction }, 201);
    }
    const context = await deps.context.build({ projectId: existing.projectId, deliverableId: existing.deliverableId, mode: "task" });
    await deps.agents.start(existing.conversationId, { executor: "codex", workspaceRoot: context.workspaceRoot });
    const instruction = await taskModeStartupInstruction(deps.prompts, body.mode as TaskModeStart, body.location as TaskModeLocation, context.initialContext, existing.projectId, existing.deliverableId, context.workspaceRoot!);
    const policyContent = (await deps.prompts.render("codex.deliverable-analysis-turn", { projectId: existing.projectId, deliverableId: existing.deliverableId, deliverableContext: context.initialContext, userMessage: "" })).content;
    await deps.chats.appendMessage({
      id: eventId,
      conversationId: existing.conversationId,
      role: "system",
      content: "任务模式已启动",
      metadata: { type: "task-mode-started", mode: body.mode, location: body.location, promptRevision: await deps.prompts.revision("codex.deliverable-analysis-turn"), policyContent },
      createdAt: startedAt,
    });
    await deps.conversations.touch(existing.id, startedAt);
    return c.json({ ok: true, instruction }, 201);
  });

  r.get("/conversations/:id/status", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing || existing.status !== "active") return c.json({ server: true, session: false, state: "session_lost" }, 404);
    const connection = await deps.agents.connectionStatus(existing.conversationId);
    const state = !connection.server ? "server_offline" : !connection.session ? "session_lost" : "connected";
    return c.json({ ...connection, state, running: deps.agents.isRunning(existing.conversationId) });
  });

  r.post("/conversations/:id/interrupt", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing || existing.status !== "active") return c.json({ error: "Active conversation not found" }, 404);
    return c.json({ interrupted: await deps.agents.interrupt(existing.conversationId) });
  });

  r.post("/conversations/:id/stream", async c => {
    const existing = await deps.conversations.get(c.req.param("id"));
    if (!existing || existing.status !== "active") return c.json({ error: "Active conversation not found" }, 404);
    const body = await c.req.json().catch(() => null) as { content?: unknown; clientRequestId?: unknown; userMessageId?: unknown; attachments?: unknown; metadata?: unknown } | null;
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const clientRequestId = typeof body?.clientRequestId === "string" ? body.clientRequestId : "";
    const userMessageId = typeof body?.userMessageId === "string" ? body.userMessageId : "";
    if (!content || !clientRequestId || !userMessageId) return c.json({ error: "content, clientRequestId and userMessageId are required" }, 400);
    const attachmentIds = Array.isArray(body?.attachments) ? body.attachments.flatMap(item => typeof item === "object" && item && typeof (item as { id?: unknown }).id === "string" ? [(item as { id: string }).id] : []) : [];
    const imageUrls = deps.attachments ? (await Promise.all(attachmentIds.map(async id => {
      const image = await deps.attachments!.getData(id);
      return image ? `data:${image.mime};base64,${Buffer.from(image.data).toString("base64")}` : undefined;
    }))).filter((url): url is string => Boolean(url)) : [];
    const metadata = typeof body?.metadata === "object" && body.metadata && !Array.isArray(body.metadata)
      ? body.metadata as Record<string, unknown>
      : undefined;
    const workbenchDocumentId = typeof metadata?.workbenchDocumentId === "string" ? metadata.workbenchDocumentId : undefined;
    const messages = await deps.chats.listMessages(existing.conversationId, 200);
    const lastMode = [...messages].reverse().find(message => (message.metadata as { type?: string } | undefined)?.type === "task-mode-started");
    const generalTaskMode = (lastMode?.metadata as { mode?: { id?: string } } | undefined)?.mode?.id === "general-task";
    if (generalTaskMode) {
      const context = await deps.context.build({ projectId: existing.projectId, deliverableId: existing.deliverableId, mode: "free" });
      await deps.agents.start(existing.conversationId, { executor: "codex", workspaceRoot: context.workspaceRoot });
    }
    const taskPromptStates = messages.flatMap(message => {
      const messageMetadata = message.metadata;
      if (!messageMetadata || typeof messageMetadata !== "object" || Array.isArray(messageMetadata)) return [];
      const value = messageMetadata as { type?: unknown; promptRevision?: unknown; policyContent?: unknown };
      return (value.type === "task-mode-started" || value.type === "task-mode-policy-updated") && typeof value.promptRevision === "string"
        ? [{ revision: value.promptRevision, policyContent: typeof value.policyContent === "string" ? value.policyContent : undefined }]
        : [];
    });
    const taskContext = !generalTaskMode && taskPromptStates.length > 0
      ? await deps.context.build({ projectId: existing.projectId, deliverableId: existing.deliverableId, mode: "task" })
      : undefined;
    if (taskContext) {
      await deps.agents.start(existing.conversationId, { executor: "codex", workspaceRoot: taskContext.workspaceRoot });
    }
    const currentPromptRevision = !generalTaskMode && taskPromptStates.length > 0 ? await deps.prompts.revision("codex.deliverable-analysis-turn") : undefined;
    const freeContext = taskContext
      ? undefined
      : await deps.context.build({ projectId: existing.projectId, deliverableId: existing.deliverableId, mode: "free" });
    const contextForTurn = freeContext
      ? existing.lastContextSyncAt
        ? await deps.context.buildIncrementalContext({ projectId: existing.projectId, deliverableId: existing.deliverableId, since: existing.lastContextSyncAt })
        : freeContext.initialContext
      : undefined;
    const turnContent = freeContext
      ? `${freeContext.systemInstruction}${contextForTurn ? `\n\n${contextForTurn}` : ""}\n\n## 本次 Codex 任务\n${content}`
      : content;
    const shouldSendRuleUpdate = Boolean(currentPromptRevision && taskPromptStates.at(-1)?.revision !== currentPromptRevision && metadata?.type !== "task-mode-instruction");
    const renderedPolicy = shouldSendRuleUpdate
      ? await deps.prompts.render("codex.deliverable-analysis-turn", {
        projectId: existing.projectId,
        deliverableId: existing.deliverableId,
        deliverableContext: taskContext!.initialContext,
        userMessage: "",
      })
      : undefined;
    const runtimeContent = renderedPolicy
      ? (await deps.prompts.render("codex.deliverable-analysis-turn", { projectId: existing.projectId, deliverableId: existing.deliverableId, deliverableContext: taskContext!.initialContext, userMessage: turnContent })).content
      : turnContent;
    const policyCardContent = renderedPolicy ? changedPolicyRules(taskPromptStates.at(-1)?.policyContent, renderedPolicy.content) : undefined;
    const policyCreatedAt = new Date().toISOString();
    if (shouldSendRuleUpdate && currentPromptRevision) {
      await deps.chats.appendMessage({
        id: randomUUID(), conversationId: existing.conversationId, role: "system", content: policyCardContent!,
        metadata: { type: "task-mode-policy-updated", promptRevision: currentPromptRevision, policyContent: renderedPolicy!.content }, createdAt: policyCreatedAt,
      });
    }
    await deps.conversations.touch(existing.id, new Date().toISOString());
    return streamSSE(c, async stream => {
      const write = async (event: AgentConversationEvent) => {
        const name = event.type === "delta" ? "text" : event.type === "done" ? "done" : event.type;
        const data = event.type === "delta" ? { chunk: event.text, turnId: event.turnId } : event;
        await stream.writeSSE({ event: name, data: JSON.stringify(data) });
      };
      try {
        if (policyCardContent) await stream.writeSSE({ event: "policy", data: JSON.stringify({ content: policyCardContent, createdAt: policyCreatedAt }) });
        if (deps.attachments) await Promise.all(attachmentIds.map(id => deps.attachments!.bindToMessage(id, userMessageId)));
        const runtimeInstruction = workbenchDocumentId
          ? `You are collaborating in Rich workbench document ${workbenchDocumentId}. Before any planning or implementation, use rich_workbench_document get for this document. Use rich_workbench_document outline only for empty heading cards. For all substantive plans, scripts, tables, validation or conclusions, use rich_workbench_document propose and wait for the user's acceptance. Do not create, edit, or test project files unless the user explicitly asks after accepting a workbench proposal. Do not bypass Rich through direct database writes.`
          : undefined;
        const result = await deps.agents.sendMessage(existing.conversationId, { clientRequestId, userMessageId, content: runtimeContent, runtimeInstruction, imageUrls, metadata }, write);
        const sessionId = result.turn.runtimeSessionId;
        if (sessionId) await deps.conversations.setCodexThread(existing.id, sessionId, existing.contextVersion, new Date().toISOString());
        if (contextForTurn) await deps.conversations.markContextSynced(existing.id, new Date().toISOString());
        await deps.onTurnCompleted?.({ projectId: existing.projectId, deliverableId: existing.deliverableId, summary: "已完成本次回复" });
      } catch (error) {
        await stream.writeSSE({ event: "error", data: JSON.stringify({ message: error instanceof Error ? error.message : String(error) }) });
      }
    });
  });

  return r;
}
