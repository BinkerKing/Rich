import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import { buildChatSystemPrompt } from "../ai/prompts/chatSystem.js";
import { pickScenarioAdapter } from "../ai/pickAdapter.js";
import { normalizeAdapterName } from "../ai/modelRouter.js";
import type { AIScenario } from "../ai/modelRouter.js";
import { createAIContextProvider } from "../ai/contextProvider.js";
import { startOpRecord, type OpHandle } from "../ai/aiOpLog.js";
import { OperationCorrelationRegistry } from "../ai/operationCorrelation.js";
import { planChatTurn, planChatTurnWithModel } from "../ai/agentOrchestrator.js";
import type { AIContextProvider } from "../ai/contextProvider.js";
import type { ChatAttachmentsRepo } from "../repos/ChatAttachmentsRepo.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";
import type { AgentConversationConfigRepo } from "../repos/AgentConversationConfigRepo.js";
import type { AgentConversationTurn, AgentConversationTurnRepo } from "../repos/AgentConversationTurnRepo.js";
import { AgentConversationService } from "../agent-conversations/AgentConversationService.js";
import type { ChatAttachmentRef } from "@ke/domain";
import type { AIAdapter } from "../ai/adapter.js";

/** Hermes / OpenAI 兼容协议下的消息 content —— 可以是纯字符串或 multimodal part 数组 */
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type MessageContent = string | ContentPart[];
type Message = { role: string; content: MessageContent };
type CodexFallbackResult = { wroteText: boolean; fullText: string; error?: string };

const AGENT_TASK_INSTRUCTIONS = `
\n## 执行任务模式

这轮用户是在下达任务，不是只要建议。先判断任务是否足够明确：
- 明确且工具可完成时，立即调用可用的 Rich MCP 工具执行；先读取必要状态，再做最小范围的修改或创建。
- 信息不足或操作不可逆时，只问一个阻塞性问题；不要用泛泛的“我可以帮你”替代执行。
- 任务完成后，明确说明已执行的动作、结果，以及仍需要用户决定的事项。
- 不要声称已经完成任何未通过工具实际执行的动作。

Rich MCP 2.0 选择顺序：
1. 对象不明确时先用 rich_context_search / rich_context_get_overview。
2. 完整的“沉淀对话、整理项目、分析规划”优先用对应场景工具，不要拼多个原子写入。
3. 对象和变化都明确时才用 rich_*_manage；真实写入带唯一 context.requestId，删除/取消带 confirmDestructive。
4. 只有工作说明和验收标准明确时才用 rich_work_delegate；只要方案时不得委派。
5. 委派后按 Rich taskId 查询，完成后调用 rich_work_review_result，再按需 rich_learning_capture。
6. 检查统一响应里的 ok 和 verification.status；DEPENDENCY_UNAVAILABLE 表示执行后端未配置，不得伪造成功或任务。
`;

function turnSystemPrompt(requiresAgent = false, mcpRequestId?: string): string {
  const correlationInstruction = mcpRequestId
    ? `\n\n## MCP trace correlation\nFor every Rich MCP call in this agent turn, set context.requestId exactly to this opaque token: ${mcpRequestId}`
    : "";
  return `${buildChatSystemPrompt()}${requiresAgent ? AGENT_TASK_INSTRUCTIONS : ""}${correlationInstruction}`;
}

function contentToText(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content
    .map(part => part.type === "text" ? part.text : "[图片]")
    .join("\n");
}

function messagesToFallbackPrompt(messages: Message[]): string {
  return messages
    .filter(message => message.role !== "system")
    .map(message => `${message.role}: ${contentToText(message.content)}`)
    .join("\n\n");
}

function makeChatOpRecorder(handle: OpHandle | null, onTerminal?: () => void) {
  let recorded = false;
  let errorEventRecorded = false;
  return {
    async event(input: Parameters<OpHandle["recordEvent"]>[0]) {
      if (!handle || recorded) return;
      if (input.type === "error") {
        if (errorEventRecorded) return;
        errorEventRecorded = true;
      }
      await handle.recordEvent(input);
    },
    async done(output: string, sessionId?: string) {
      if (!handle || recorded) return;
      recorded = true;
      try { await handle.recordDone(output, sessionId); } finally { onTerminal?.(); }
    },
    async error(message: string) {
      if (!handle || recorded) return;
      recorded = true;
      try { await handle.recordError(message); } finally { onTerminal?.(); }
    },
  };
}

/**
 * 把 client 发来的 messages 注入 Rich 的 system prompt：
 *  - 如果 messages[0] 已经是 system，替换内容（保持单一 system）
 *  - 否则在最前面插入
 *
 * content 允许字符串或多模态 part 数组（OpenAI vision 协议），原样透传到 Hermes。
 */
function injectSystemPrompt(messages: Message[], requiresAgent = false, mcpRequestId?: string): Message[] {
  const basePrompt = turnSystemPrompt(requiresAgent, mcpRequestId);
  if (messages.length > 0 && messages[0].role === "system") {
    const extraContext = contentToText(messages[0].content).trim();
    return [{
      role: "system",
      content: extraContext ? `${basePrompt}\n\n${extraContext}` : basePrompt,
    }, ...messages.slice(1)];
  }
  const sys: Message = { role: "system", content: basePrompt };
  return [sys, ...messages];
}

function systemPromptWithContext(messages: Message[], requiresAgent = false, mcpRequestId?: string): string {
  const context = messages
    .filter(message => message.role === "system")
    .map(message => contentToText(message.content).trim())
    .filter(Boolean)
    .join("\n\n");
  const basePrompt = turnSystemPrompt(requiresAgent, mcpRequestId);
  return context ? `${basePrompt}\n\n${context}` : basePrompt;
}

/**
 * 给最后一条 user message 拼上图片 part —— 走 OpenAI 标准的 image_url + base64 data URL。
 * 服务端从 chat_attachments 表把字节拉出来 base64 编码，inline 进消息体。
 * 这样上游模型（Hermes 或它代理的 codex / claude）直接拿到完整内容。
 */
async function inlineAttachments(
  messages: Message[],
  refs: ChatAttachmentRef[],
  repo: ChatAttachmentsRepo,
): Promise<Message[]> {
  if (refs.length === 0) return messages;
  // 拉 byte
  const parts: ContentPart[] = [];
  for (const ref of refs) {
    const data = await repo.getData(ref.id);
    if (!data) continue;
    const b64 = Buffer.from(data.data).toString("base64");
    parts.push({
      type: "image_url",
      image_url: { url: `data:${data.mime};base64,${b64}` },
    });
  }
  if (parts.length === 0) return messages;
  // 找最后一条 user message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    const m = messages[i];
    const textContent: ContentPart[] = typeof m.content === "string"
      ? [{ type: "text", text: m.content }]
      : m.content;
    return [
      ...messages.slice(0, i),
      { role: "user", content: [...textContent, ...parts] },
      ...messages.slice(i + 1),
    ];
  }
  // 没找到 user message —— 兜底加一条
  return [...messages, { role: "user", content: parts }];
}

/**
 * Chat overlay backend — bridges the Spotlight-style chat UI to Hermes Agent.
 *
 * Wire format (in):
 *   POST /api/chat/stream
 *   { messages: [{ role: "user" | "assistant", content: string }, ...] }
 *
 * Wire format (out, SSE):
 *   event: text       data: { "chunk": "..." }
 *   event: tool       data: { "name": "mcp_rich_xxx", "status": "running" | "completed" }
 *   event: done       data: { "finish_reason": "stop" | ... }
 *   event: error      data: { "message": "..." }
 *
 * Why this bridge exists (instead of the UI hitting Hermes directly):
 *   1. Normalise Hermes's SSE format into our project-standard SSE format
 *   2. Hide the upstream URL/port so the UI only knows /api/*
 *   3. Future hook point for moderation, logging, conversation persistence
 */

const HERMES_BASE_URL = process.env.HERMES_BASE_URL || "http://127.0.0.1:8642";
const HERMES_API_KEY = process.env.HERMES_API_KEY;

function hermesJsonHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(HERMES_API_KEY ? { Authorization: `Bearer ${HERMES_API_KEY}` } : {}),
  };
}

export function chatRoutes(
  attachmentsRepo: ChatAttachmentsRepo | null = null,
  adapters: AIAdapter[] = [],
  conversationsRepo: ChatConversationsRepo | null = null,
  contextProvider: AIContextProvider = createAIContextProvider(conversationsRepo),
  operationCorrelations: OperationCorrelationRegistry = new OperationCorrelationRegistry(),
  agentConfigs: AgentConversationConfigRepo | null = null,
  agentTurns: AgentConversationTurnRepo | null = null,
): Hono {
  const r = new Hono();
  const codexFallback = adapters.find(adapter => adapter.name === "codex");
  const agentSessions = agentConfigs && conversationsRepo
    ? new AgentConversationService(agentConfigs, conversationsRepo)
    : null;

  function pickChatAdapter(scenario: AIScenario, preference?: unknown): AIAdapter | null {
    if (adapters.length === 0) return null;
    return pickScenarioAdapter(adapters, scenario, normalizeAdapterName(preference));
  }

  function pickSummaryAdapter(): AIAdapter | null {
    if (adapters.length === 0) return null;
    return pickScenarioAdapter(adapters, "analysis");
  }

  async function planTurn(messages: Message[], signal?: AbortSignal) {
    if (process.env.RICH_AI_TURN_PLANNER !== "llm") return planChatTurn(messages);
    const planner = pickSummaryAdapter();
    if (!planner) return planChatTurn(messages);
    return planChatTurnWithModel(planner, messages, signal);
  }

  function queueSummaryRefresh(conversationId: string): void {
    void contextProvider.refreshChatSummary(conversationId, pickSummaryAdapter())
      .catch(() => undefined);
  }

  function messageTitle(messages: Message[]): string {
    const firstUser = messages.find(message => message.role === "user");
    const text = firstUser ? contentToText(firstUser.content).replace(/\s+/g, " ").trim() : "";
    return text ? text.slice(0, 40) : "Rich 对话";
  }

  function lastUserMessage(messages: Message[]): Message | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i];
    }
    return undefined;
  }

  async function streamCodexFallback(
    stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
    messages: Message[],
    requiresAgent = false,
    mcpRequestId?: string,
  ): Promise<CodexFallbackResult> {
    let fullText = "";
    if (!codexFallback || !(await codexFallback.available())) {
      return { wroteText: false, fullText, error: "Hermes 没有可用凭证，且 Codex fallback 不可用。" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    let wroteText = false;
    try {
      for await (const event of codexFallback.stream({
        systemPrompt: systemPromptWithContext(messages, requiresAgent, mcpRequestId),
        prompt: messagesToFallbackPrompt(messages),
        signal: controller.signal,
      })) {
        if (event.type === "delta" && event.text) {
          wroteText = true;
          fullText += event.text;
          await stream.writeSSE({
            event: "text",
            data: JSON.stringify({ chunk: event.text }),
          });
        } else if (event.type === "error") {
          return { wroteText, fullText, error: event.message };
        }
      }
    } catch (e) {
      return { wroteText, fullText, error: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(timeout);
    }
    return { wroteText, fullText };
  }

  async function streamCodexFallbackWithProgress(
    stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
    messages: Message[],
    hermesMessage: string,
    requiresAgent = false,
    beforeError?: () => Promise<void>,
    mcpRequestId?: string,
  ): Promise<CodexFallbackResult> {
    await stream.writeSSE({
      event: "tool",
      data: JSON.stringify({ name: "codex-fallback", status: "running" }),
    });
    const result = await streamCodexFallback(stream, messages, requiresAgent, mcpRequestId);
    await stream.writeSSE({
      event: "tool",
      data: JSON.stringify({ name: "codex-fallback", status: "completed" }),
    });
    if (result.error || !result.wroteText) {
      const failure: CodexFallbackResult = result.error
        ? result
        : { ...result, error: hermesMessage };
      await beforeError?.();
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: failure.error }),
      });
      return failure;
    }
    return result;
  }

  async function streamGenericAdapter(
    stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
    adapter: AIAdapter,
    messages: Message[],
    scenario: AIScenario,
    signal?: AbortSignal,
    requiresAgent = false,
    mcpRequestId?: string,
  ): Promise<{ wroteText: boolean; fullText: string; sessionId?: string; error?: string }> {
    let wroteText = false;
    let fullText = "";
    let sessionId: string | undefined;
    for await (const event of adapter.stream({
      systemPrompt: systemPromptWithContext(messages, requiresAgent, mcpRequestId),
      prompt: messagesToFallbackPrompt(messages),
      scenario,
      signal,
    })) {
      if (event.type === "delta" && event.text) {
        wroteText = true;
        fullText += event.text;
        await stream.writeSSE({
          event: "text",
          data: JSON.stringify({ chunk: event.text }),
        });
      } else if (event.type === "done") {
        sessionId = event.sessionId;
      } else if (event.type === "error") {
        return { wroteText, fullText, sessionId, error: event.message };
      }
    }
    return { wroteText, fullText, sessionId };
  }

  // Non-streaming endpoint for GreatMe HQ conversations and any other caller
  // that just wants a single completed reply. Forwards to Hermes with
  // stream:false and returns the OpenAI-style JSON wrapped in
  // { message: { role, content } }.
  r.post("/", async (c) => {
    const body = await c.req.json().catch(() => null) as
      | { messages?: Array<{ role: string; content: string }>; model?: string; conversationId?: string; surface?: string }
      | null;
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: "messages[] required" }, 400);
    }
    const messages = body.messages;
    const conversationId = body.conversationId?.trim() || "rich-chat-default";
    const turnPlan = await planTurn(messages, c.req.raw.signal);
    const adapter = pickChatAdapter(turnPlan.scenario, body.model);
    const now = new Date().toISOString();
    let opRecorder: ReturnType<typeof makeChatOpRecorder> | null = null;
    try {
      await conversationsRepo?.ensureConversation({
        id: conversationId,
        title: messageTitle(messages),
        surface: body.surface?.trim() || "api-chat",
        now,
      });
      const contextMessages = await contextProvider.buildChatContext(conversationId, messages) as Message[];
      const operation = await startOpRecord({
        op: "chat",
        model: adapter?.name ?? "hermes",
        scenario: turnPlan.scenario,
        scope: { conversationId, surface: body.surface?.trim() || "api-chat", intent: turnPlan.intent, reason: turnPlan.reason },
        prompt: messagesToFallbackPrompt(contextMessages),
      });
      const mcpRequestId = turnPlan.requiresAgent ? operationCorrelations.issue(operation.id) : undefined;
      opRecorder = makeChatOpRecorder(operation, () => {
        if (mcpRequestId) operationCorrelations.release(mcpRequestId);
      });
      await opRecorder.event({ type: "turn.plan" });
      await opRecorder.event({ type: "adapter.selected" });
      if (turnPlan.requiresAgent) await opRecorder.event({ type: "agent.started" });
      let msg: { role: string; content: string } | null = null;
      let usedAdapter = adapter?.name ?? "hermes";
      if (!adapter || adapter.name === "hermes") {
        const upstream = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: hermesJsonHeaders(),
          body: JSON.stringify({
            model: "hermes-agent",
            stream: false,
            messages: injectSystemPrompt(contextMessages, turnPlan.requiresAgent, mcpRequestId),
          }),
        });
        if (!upstream.ok) {
          await opRecorder.event({ type: "error" });
          await opRecorder.error(`Hermes ${upstream.status}`);
          return c.json({ error: `Hermes ${upstream.status}` }, 502);
        }
        const json = await upstream.json() as { choices?: { message?: { role: string; content: string } }[] };
        msg = json.choices?.[0]?.message ?? null;
      } else {
        let content = "";
        for await (const event of adapter.stream({
          systemPrompt: systemPromptWithContext(contextMessages, turnPlan.requiresAgent, mcpRequestId),
          prompt: messagesToFallbackPrompt(contextMessages),
          scenario: turnPlan.scenario,
        })) {
          if (event.type === "delta") content += event.text;
          if (event.type === "error") {
            await opRecorder.event({ type: "error" });
            await opRecorder.error(event.message);
            return c.json({ error: event.message }, 502);
          }
        }
        msg = content.trim() ? { role: "assistant", content } : null;
        usedAdapter = adapter.name;
      }
      if (!msg) {
        await opRecorder.event({ type: "error" });
        await opRecorder.error("no message in response");
        return c.json({ error: "no message in response" }, 502);
      }
      const user = messages.at(-1);
      if (user?.role === "user") {
        await conversationsRepo?.appendMessage({
          id: randomUUID(),
          conversationId,
          role: "user",
          content: contentToText(user.content),
          createdAt: now,
        });
      }
      await conversationsRepo?.appendMessage({
        id: randomUUID(),
        conversationId,
        role: "assistant",
        content: msg.content,
        adapter: usedAdapter,
        createdAt: new Date().toISOString(),
      });
      await opRecorder.event({ type: "output" });
      await opRecorder.done(msg.content);
      queueSummaryRefresh(conversationId);
      return c.json({ conversationId, message: msg });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await opRecorder?.event({ type: "error" });
      await opRecorder?.error(message);
      return c.json({ error: message }, 503);
    }
  });

  r.post("/stream", async (c) => {
    const body = await c.req.json().catch(() => null) as
      | { messages?: Message[]; attachments?: ChatAttachmentRef[]; conversationId?: string; clientRequestId?: string; userMessageId?: string; surface?: string; model?: string }
      | null;
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: "messages[] required" }, 400);
    }
    const conversationId = body.conversationId?.trim() || "rich-chat-default";
    const activeAgentConfig = await agentSessions?.getActive(conversationId) ?? null;
    const turnPlan = activeAgentConfig
      ? { scenario: "chat" as const, intent: "answer" as const, requiresAgent: false, reason: "当前 Rich 对话已开启 Hermes Agent Session" }
      : await planTurn(body.messages, c.req.raw.signal);
    const now = new Date().toISOString();
    await conversationsRepo?.ensureConversation({
      id: conversationId,
      title: messageTitle(body.messages),
      surface: body.surface?.trim() || "chat-stream",
      now,
    });

    const originalUserMessage = lastUserMessage(body.messages);
    let agentTurn: AgentConversationTurn | null = null;
    if (activeAgentConfig && agentTurns) {
      const clientRequestId = body.clientRequestId?.trim();
      if (!clientRequestId) return c.json({ error: "clientRequestId required for Agent session" }, 400);
      const userMessageId = body.userMessageId?.trim();
      if (!userMessageId) return c.json({ error: "userMessageId required for Agent session" }, 400);
      if (!originalUserMessage) return c.json({ error: "Agent session requires a user message" }, 400);
      const admitted = await agentTurns.createOrGet({
        id: randomUUID(),
        conversationId,
        clientRequestId,
        userMessageId,
        content: contentToText(originalUserMessage.content),
        metadata: Array.isArray(body.attachments) && body.attachments.length > 0
          ? { attachments: body.attachments.map(ref => ({ id: ref.id, mime: ref.mime })) }
          : undefined,
        now,
      });
      if (!admitted.created) {
        return c.json({ error: "Agent request already admitted", conversationId, turn: admitted.turn }, 409);
      }
      const ownerId = randomUUID();
      agentTurn = await agentTurns.claim(admitted.turn.id, { ownerId, now, leaseMs: 120_000 });
      if (agentTurn?.status !== "running" || agentTurn.leaseOwner !== ownerId) {
        return c.json({ error: "Agent conversation turn already running", conversationId, turn: agentTurn }, 409);
      }
    } else if (originalUserMessage) {
      await conversationsRepo?.appendMessage({
        id: randomUUID(),
        conversationId,
        role: "user",
        content: contentToText(originalUserMessage.content),
        metadata: Array.isArray(body.attachments) && body.attachments.length > 0
          ? { attachments: body.attachments.map(ref => ({ id: ref.id, mime: ref.mime })) }
          : undefined,
        createdAt: now,
      });
    }

    let messages = await contextProvider.buildChatContext(conversationId, body.messages) as Message[];
    // 有图就把字节 inline 到最后一条 user message
    if (Array.isArray(body.attachments) && body.attachments.length > 0 && attachmentsRepo) {
      messages = await inlineAttachments(messages, body.attachments, attachmentsRepo);
    }
    const adapter = activeAgentConfig
      ? adapters.find(candidate => candidate.name === "hermes") ?? null
      : pickChatAdapter(turnPlan.scenario, body.model);

    // T02 — 首字 SLO 基础设施。
    // (1) 反代关 buffering：Nginx / Cloudflare 见到这个 header 不会攒 chunk
    // (2) 立即开启 SSE 流（不等 Hermes 连接成功）→ 第一帧就推一个 mascot:thinking
    //     事件，给前端 100ms 内就有 UI 反应（即便后端 Hermes 还没开始返回）
    // (3) Hermes 连接放在 stream callback 内，连不上时通过 'error' 事件推回去
    //     而不是 503 JSON（保持流式协议一致）
    c.header("X-Accel-Buffering", "no");
    c.header("Cache-Control", "no-cache, no-transform");

    return streamSSE(c, async (stream) => {
      const eventData = (payload: Record<string, unknown>) => JSON.stringify(
        agentTurn ? { ...payload, turnId: agentTurn.id } : payload,
      );
      // ① 先推一个 mascot 事件 —— 让前端立刻把 Mascot 切到 thinking 表情
      //    （这是首字 SLO L1 兜底：用户感知 < 100ms，AI 真实首字独立测）
      await stream.writeSSE({
        event: "mascot",
        data: eventData({ state: "thinking", ts: Date.now() }),
      });
      const operation = await startOpRecord({
        op: "chat-stream",
        model: adapter?.name ?? "hermes",
        scenario: turnPlan.scenario,
        scope: {
          conversationId,
          surface: body.surface?.trim() || "chat-stream",
          intent: turnPlan.intent,
          reason: turnPlan.reason,
          attachmentCount: Array.isArray(body.attachments) ? body.attachments.length : 0,
        },
        prompt: messagesToFallbackPrompt(messages),
      });
      const mcpRequestId = turnPlan.requiresAgent ? operationCorrelations.issue(operation.id) : undefined;
      const opRecorder = makeChatOpRecorder(operation, () => {
        if (mcpRequestId) operationCorrelations.release(mcpRequestId);
      });
      await opRecorder.event({ type: "turn.plan" });
      await opRecorder.event({ type: "adapter.selected" });
      if (turnPlan.requiresAgent) await opRecorder.event({ type: "agent.started" });

      // ② 现在才开始连 Hermes（连接耗时已经从首字延迟里抠出去了）
      if (adapter && adapter.name !== "hermes") {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000);
        try {
          let result;
          try {
            result = await streamGenericAdapter(stream, adapter, messages, turnPlan.scenario, controller.signal, turnPlan.requiresAgent, mcpRequestId);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await opRecorder.event({ type: "error" });
            await opRecorder.error(message);
            await stream.writeSSE({
              event: "error",
              data: eventData({ message, conversationId }),
            });
            return;
          }
          if (result.error) {
            await opRecorder.event({ type: "error" });
            await opRecorder.error(result.error);
            await stream.writeSSE({
              event: "error",
              data: eventData({ message: result.error, conversationId }),
            });
            return;
          }
          if (result.fullText.trim()) {
            await conversationsRepo?.appendMessage({
              id: randomUUID(),
              conversationId,
              role: "assistant",
              content: result.fullText,
              adapter: adapter.name,
              modelSessionId: result.sessionId,
              createdAt: new Date().toISOString(),
            });
            queueSummaryRefresh(conversationId);
          }
          await opRecorder.event({ type: "output" });
          await opRecorder.done(result.fullText, result.sessionId);
          await stream.writeSSE({
            event: "done",
            data: eventData({ finish_reason: "stop", conversationId, adapter: adapter.name }),
          });
          return;
        } finally {
          clearTimeout(timeout);
        }
      }

      // ② 现在才开始连 Hermes（连接耗时已经从首字延迟里抠出去了）
      let upstream: Response;
      try {
        upstream = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: hermesJsonHeaders(),
          body: JSON.stringify({
            model: "hermes-agent",
            stream: true,
            messages: injectSystemPrompt(messages, turnPlan.requiresAgent, mcpRequestId),
            session_id: activeAgentConfig?.modelSessionId,
          }),
        });
      } catch (e) {
        const message = `Hermes unreachable: ${e instanceof Error ? e.message : String(e)}`;
        if (activeAgentConfig) {
          await agentTurns?.finish(agentTurn!.id, { status: "failed", error: message, now: new Date().toISOString() });
          await opRecorder.event({ type: "error" });
          await opRecorder.error(message);
          await stream.writeSSE({
            event: "error",
            data: eventData({ message, conversationId }),
          });
          return;
        }
        await opRecorder.event({ type: "fallback" });
        const fallback = await streamCodexFallbackWithProgress(stream, messages, message, turnPlan.requiresAgent, () => opRecorder.event({ type: "error" }), mcpRequestId);
        if (fallback.error) {
          await opRecorder.error(fallback.error);
        } else if (fallback.wroteText) {
          await conversationsRepo?.appendMessage({
            id: randomUUID(),
            conversationId,
            role: "assistant",
            content: fallback.fullText,
            adapter: "codex",
            createdAt: new Date().toISOString(),
          });
          queueSummaryRefresh(conversationId);
          await opRecorder.event({ type: "output" });
          await opRecorder.done(fallback.fullText);
          await stream.writeSSE({
            event: "done",
            data: eventData({ finish_reason: "codex-fallback", conversationId }),
          });
        } else {
          await opRecorder.event({ type: "error" });
          await opRecorder.error(message);
        }
        return;
      }
      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => "");
        const message = `Hermes ${upstream.status} ${upstream.statusText}${detail ? `: ${detail}` : ""}`;
        if (activeAgentConfig) {
          await agentTurns?.finish(agentTurn!.id, { status: "failed", error: message, now: new Date().toISOString() });
          await opRecorder.event({ type: "error" });
          await opRecorder.error(message);
          await stream.writeSSE({
            event: "error",
            data: eventData({ message, conversationId }),
          });
          return;
        }
        await opRecorder.event({ type: "fallback" });
        const fallback = await streamCodexFallbackWithProgress(stream, messages, message, turnPlan.requiresAgent, () => opRecorder.event({ type: "error" }), mcpRequestId);
        if (fallback.error) {
          await opRecorder.error(fallback.error);
        } else if (fallback.wroteText) {
          await conversationsRepo?.appendMessage({
            id: randomUUID(),
            conversationId,
            role: "assistant",
            content: fallback.fullText,
            adapter: "codex",
            createdAt: new Date().toISOString(),
          });
          queueSummaryRefresh(conversationId);
          await opRecorder.event({ type: "output" });
          await opRecorder.done(fallback.fullText);
          await stream.writeSSE({
            event: "done",
            data: eventData({ finish_reason: "codex-fallback", conversationId }),
          });
        } else {
          await opRecorder.event({ type: "error" });
          await opRecorder.error(message);
        }
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let currentEvent: string | null = null;
      let sawText = false;
      let finishReason = "stop";
      let fullText = "";
      let usedAdapter = "hermes";
      let hermesSessionId = activeAgentConfig?.modelSessionId;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // SSE frames are separated by blank lines. Each frame is a sequence
          // of "field: value" lines; an "event:" line sets the event type
          // for the next "data:" payload.
          let nl;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).replace(/\r$/, "");
            buf = buf.slice(nl + 1);

            if (line === "") {
              // Frame boundary — reset the per-frame event name. (We process
              // events line-by-line above, so this is mostly bookkeeping.)
              currentEvent = null;
              continue;
            }
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
              continue;
            }
            if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              if (data === "[DONE]") {
                finishReason = "stop";
                continue;
              }
              let parsed: unknown;
              try { parsed = JSON.parse(data); } catch { continue; }

              if (currentEvent === "hermes.tool.progress") {
                // Hermes tool event — forward minimal shape to the client.
                const p = parsed as { tool?: string; status?: string };
                if (p.tool && p.status) {
                  await opRecorder.event({ type: "mcp.tool", data: { tool: p.tool, status: p.status } });
                  await stream.writeSSE({
                    event: "tool",
                    data: eventData({ name: p.tool, status: p.status }),
                  });
                }
                continue;
              }

              // OpenAI ChatCompletion chunk — pull out delta.content.
              const chunk = parsed as {
                session_id?: string;
                choices?: Array<{
                  delta?: { content?: string };
                  finish_reason?: string | null;
                }>;
              };
              if (chunk.session_id) hermesSessionId = chunk.session_id;
              const choice = chunk.choices?.[0];
              const text = choice?.delta?.content;
              if (typeof text === "string" && text.length > 0) {
                sawText = true;
                fullText += text;
                await stream.writeSSE({
                  event: "text",
                  data: eventData({ chunk: text }),
                });
              }
              if (choice?.finish_reason) {
                finishReason = choice.finish_reason;
              }
            }
            // Ignore other field types (id:, retry:, comments starting with `:`).
          }
        }
        if (!sawText) {
          const fallback = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
            method: "POST",
            headers: hermesJsonHeaders(),
            body: JSON.stringify({
              model: "hermes-agent",
              stream: false,
              messages: injectSystemPrompt(messages, turnPlan.requiresAgent, mcpRequestId),
              session_id: activeAgentConfig?.modelSessionId,
            }),
          });
          if (fallback.ok) {
            const json = await fallback.json() as {
              session_id?: string;
              choices?: Array<{ message?: { content?: string } }>;
            };
            if (json.session_id) hermesSessionId = json.session_id;
            const text = json.choices?.[0]?.message?.content;
            if (typeof text === "string" && text.length > 0) {
              sawText = true;
              fullText += text;
              await stream.writeSSE({
                event: "text",
                data: eventData({ chunk: text }),
              });
            }
          } else {
            const json = await fallback.json().catch(() => null) as { error?: { message?: string } } | null;
            const message = json?.error?.message ?? `Hermes ${fallback.status} ${fallback.statusText}`;
            if (/No Codex credentials stored|hermes auth|hermes model/i.test(message)) {
              await opRecorder.event({ type: "error" });
              await stream.writeSSE({
                event: "error",
                data: eventData({
                  message: `Hermes 需要重新授权：${message}`,
                }),
              });
              await opRecorder.error(`Hermes 需要重新授权：${message}`);
              if (agentTurn) await agentTurns?.finish(agentTurn.id, { status: "failed", error: message, now: new Date().toISOString() });
              return;
            }
            if (activeAgentConfig) {
              await agentTurns?.finish(agentTurn!.id, { status: "failed", error: message, now: new Date().toISOString() });
              await opRecorder.event({ type: "error" });
              await opRecorder.error(message);
              await stream.writeSSE({
                event: "error",
                data: eventData({ message, conversationId }),
              });
              return;
            }
            await opRecorder.event({ type: "fallback" });
            const fallbackResult = await streamCodexFallbackWithProgress(stream, messages, message, turnPlan.requiresAgent, () => opRecorder.event({ type: "error" }), mcpRequestId);
            if (fallbackResult.error) {
              await opRecorder.error(fallbackResult.error);
              return;
            }
            sawText = fallbackResult.wroteText;
            if (sawText) {
              usedAdapter = "codex";
              fullText += fallbackResult.fullText;
            }
          }
        }
        if (fullText.trim()) {
          await conversationsRepo?.appendMessage({
            id: randomUUID(),
            conversationId,
            role: "assistant",
            content: fullText,
            adapter: usedAdapter,
            modelSessionId: usedAdapter === "hermes" ? hermesSessionId : undefined,
            createdAt: new Date().toISOString(),
          });
          if (activeAgentConfig && usedAdapter === "hermes" && hermesSessionId) {
            await agentSessions?.recordModelSession(conversationId, hermesSessionId);
          }
          queueSummaryRefresh(conversationId);
        }
        await opRecorder.event({ type: "output" });
        await opRecorder.done(fullText);
        if (agentTurn) {
          await agentTurns?.finish(agentTurn.id, {
            status: "succeeded",
            runtimeSessionId: hermesSessionId,
            now: new Date().toISOString(),
          });
        }
        await stream.writeSSE({
          event: "done",
          data: eventData({ finish_reason: finishReason, conversationId }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        let fallback: CodexFallbackResult = { wroteText: false, fullText: "" };
        if (!sawText && !activeAgentConfig) {
          await opRecorder.event({ type: "fallback" });
          fallback = await streamCodexFallbackWithProgress(stream, messages, message, turnPlan.requiresAgent, () => opRecorder.event({ type: "error" }), mcpRequestId);
        }
        if (!sawText && fallback.error) {
          await opRecorder.error(fallback.error);
          return;
        }
        if (!sawText && fallback.wroteText) {
          usedAdapter = "codex";
          await conversationsRepo?.appendMessage({
            id: randomUUID(),
            conversationId,
            role: "assistant",
            content: fallback.fullText,
            adapter: usedAdapter,
            createdAt: new Date().toISOString(),
          });
          queueSummaryRefresh(conversationId);
          await opRecorder.event({ type: "output" });
          await opRecorder.done(fallback.fullText);
          await stream.writeSSE({
            event: "done",
            data: eventData({ finish_reason: "codex-fallback", conversationId }),
          });
          return;
        }
        await opRecorder.event({ type: "error" });
        await opRecorder.error(message);
        if (agentTurn) await agentTurns?.finish(agentTurn.id, { status: "failed", error: message, now: new Date().toISOString() });
        await stream.writeSSE({
          event: "error",
          data: eventData({ message }),
        });
      }
    });
  });

  r.get("/conversations", async (c) => {
    if (!conversationsRepo) return c.json({ conversations: [] });
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 30), 1), 100);
    return c.json({ conversations: await conversationsRepo.listConversations(limit) });
  });

  r.get("/conversations/:id/agent-session", async (c) => {
    const config = await agentSessions?.get(c.req.param("id"));
    return config ? c.json(config) : c.json({ error: "Agent session not found" }, 404);
  });

  r.post("/conversations/:id/agent-session", async (c) => {
    if (!agentSessions) return c.json({ error: "Agent sessions unavailable" }, 503);
    const result = await agentSessions.start(c.req.param("id"));
    return c.json({ ...result.config, resumed: result.resumed });
  });

  r.post("/conversations/:id/agent-session/new", async (c) => {
    if (!agentSessions) return c.json({ error: "Agent sessions unavailable" }, 503);
    const result = await agentSessions.start(c.req.param("id"), { fresh: true });
    return c.json({ ...result.config, resumed: false });
  });

  r.delete("/conversations/:id/agent-session", async (c) => {
    const config = await agentSessions?.exit(c.req.param("id"));
    return config ? c.json(config) : c.json({ error: "Agent session not found" }, 404);
  });

  r.get("/conversations/:id/messages", async (c) => {
    if (!conversationsRepo) return c.json({ messages: [] });
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 200);
    return c.json({ messages: await conversationsRepo.listMessages(c.req.param("id"), limit) });
  });

  return r;
}
