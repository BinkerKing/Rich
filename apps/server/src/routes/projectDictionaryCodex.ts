import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { AgentConversationService } from "../agent-conversations/AgentConversationService.js";
import type { DictionaryCodexContextService } from "../project-dictionary-codex/DictionaryCodexContextService.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { ProjectDictionaryCodexConversationRepo } from "../repos/ProjectDictionaryCodexConversationRepo.js";

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

  return r;
}
