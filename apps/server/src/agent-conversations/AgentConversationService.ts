import { randomUUID } from "node:crypto";
import type { AgentConversationConfig, AgentConversationExecutor, AgentConversationConfigRepo } from "../repos/AgentConversationConfigRepo.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";
import type { AgentConversationTurn, AgentConversationTurnRepo } from "../repos/AgentConversationTurnRepo.js";
import type { AgentToolCall, AgentToolCallRepo } from "../repos/AgentToolCallRepo.js";
import type { AgentRuntimeEvent, AgentRuntimePort, AgentRuntimeToolResult } from "./AgentRuntimePort.js";
import { AgentCapabilityGateway } from "./AgentCapabilityGateway.js";
import { AgentToolCallService } from "./AgentToolCallService.js";
import { assertRuntimeProfileSupported } from "./ConversationPermissionPolicy.js";
import { buildChatSystemPrompt } from "../ai/prompts/chatSystem.js";

interface AgentConversationExecutionDeps {
  turns: AgentConversationTurnRepo;
  toolCallRepo: AgentToolCallRepo;
  toolCalls: AgentToolCallService;
  runtime?: AgentRuntimePort;
  runtimes?: Partial<Record<AgentConversationExecutor, AgentRuntimePort>>;
  gateway: AgentCapabilityGateway;
  workspaceRoot?: string;
}

export type AgentConversationEvent =
  | { type: "turn"; turnId: string; status: AgentConversationTurn["status"] }
  | { type: "delta"; turnId: string; text: string }
  | { type: "tool"; turnId: string; callId: string; name: string; status: string }
  | { type: "approval_required"; turnId: string; callId: string; approvalId: string; name: string; arguments: Record<string, unknown>; argumentsDigest: string }
  | { type: "done"; turnId: string; content: string; sessionId?: string }
  | { type: "error"; turnId: string; message: string };

export interface ResolveAgentApprovalInput {
  approvalId: string;
  turnId: string;
  toolCallId: string;
  argumentsDigest: string;
  approved: boolean;
}

export class AgentConversationService {
  constructor(
    private readonly configs: AgentConversationConfigRepo,
    private readonly conversations: ChatConversationsRepo,
    private readonly execution?: AgentConversationExecutionDeps,
  ) {}

  async get(conversationId: string): Promise<AgentConversationConfig | null> {
    return this.configs.get(conversationId);
  }

  async getActive(conversationId: string): Promise<AgentConversationConfig | null> {
    const config = await this.configs.get(conversationId);
    return config?.status === "active" ? config : null;
  }

  async start(conversationId: string, options: { fresh?: boolean; executor?: AgentConversationExecutor } = {}): Promise<{ config: AgentConversationConfig; resumed: boolean }> {
    const now = new Date().toISOString();
    await this.conversations.ensureConversation({ id: conversationId, surface: "agent", now });
    const existing = await this.configs.get(conversationId);
    const modelSessionId = options.fresh ? undefined : existing?.modelSessionId;
    const config: AgentConversationConfig = {
      conversationId,
      executor: options.executor ?? existing?.executor ?? "hermes",
      permissionProfile: existing?.permissionProfile ?? "chat_only",
      workspaceRoot: existing?.workspaceRoot,
      allowedMcpServers: existing?.allowedMcpServers ?? [],
      status: "active",
      modelSessionId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.configs.save(config);
    return { config, resumed: Boolean(modelSessionId) };
  }

  async exit(conversationId: string): Promise<AgentConversationConfig | null> {
    const existing = await this.configs.get(conversationId);
    if (!existing) return null;
    const updatedAt = new Date().toISOString();
    await this.configs.setStatus(conversationId, "inactive", updatedAt);
    return { ...existing, status: "inactive", updatedAt };
  }

  async recordModelSession(conversationId: string, modelSessionId: string): Promise<void> {
    await this.configs.setModelSessionId(conversationId, modelSessionId, new Date().toISOString());
  }

  async resolveApproval(conversationId: string, input: ResolveAgentApprovalInput): Promise<AgentToolCall> {
    if (!this.execution) throw new Error("Agent conversation execution is not configured");
    const turn = await this.execution.turns.get(input.turnId);
    if (!turn || turn.conversationId !== conversationId || turn.status !== "waiting_approval") {
      throw new Error("Agent approval does not belong to this conversation turn");
    }
    const now = new Date().toISOString();
    const call = input.approved
      ? await this.execution.toolCalls.executeApproved({ ...input, conversationId, now })
      : await this.execution.toolCalls.denyApproved({ ...input, conversationId, now });
    await this.execution.turns.finish(input.turnId, {
      status: "failed",
      error: input.approved
        ? "Approved tool action completed; this runtime cannot resume the paused model turn"
        : "Tool action denied by user",
      runtimeSessionId: turn.runtimeSessionId,
      now,
    });
    return call;
  }

  async sendMessage(
    conversationId: string,
    input: { clientRequestId: string; userMessageId: string; content: string; metadata?: Record<string, unknown> },
    onEvent?: (event: AgentConversationEvent) => Promise<void> | void,
  ): Promise<{ turn: AgentConversationTurn; events: AgentConversationEvent[] }> {
    if (!this.execution) throw new Error("Agent conversation execution is not configured");
    const config = await this.getActive(conversationId);
    if (!config) throw new Error("Agent conversation is not active");
    const runtime = this.runtimeFor(config.executor);
    assertRuntimeProfileSupported(runtime.agentRuntimeCapabilities(), config.permissionProfile);

    const now = new Date().toISOString();
    await this.conversations.ensureConversation({ id: conversationId, surface: "agent", now });
    const admitted = await this.execution.turns.createOrGet({
      id: randomUUID(),
      conversationId,
      clientRequestId: input.clientRequestId,
      userMessageId: input.userMessageId,
      content: input.content,
      metadata: input.metadata,
      now,
    });
    if (!admitted.created) {
      if (["queued", "running", "waiting_approval"].includes(admitted.turn.status)) {
        throw new Error("Agent conversation turn already running");
      }
      const event: AgentConversationEvent = { type: "turn", turnId: admitted.turn.id, status: admitted.turn.status };
      await onEvent?.(event);
      return { turn: admitted.turn, events: [event] };
    }

    const ownerId = randomUUID();
    const claimed = await this.execution.turns.claim(admitted.turn.id, { ownerId, now, leaseMs: 120_000 });
    if (!claimed || claimed.status !== "running" || claimed.leaseOwner !== ownerId) {
      throw new Error("Agent conversation turn already running");
    }

    const events: AgentConversationEvent[] = [];
    const publish = async (event: AgentConversationEvent) => {
      events.push(event);
      await onEvent?.(event);
    };
    await publish({ type: "turn", turnId: claimed.id, status: "running" });
    const grant = this.execution.gateway.issue({
      conversationId,
      turnId: claimed.id,
      profile: config.permissionProfile,
      workspaceRoot: config.workspaceRoot ?? this.execution.workspaceRoot,
      allowedMcpServers: config.allowedMcpServers,
      now,
      ttlMs: 120_000,
    });
    const summary = await this.conversations.getSummary(conversationId);
    const recent = (await this.conversations.listMessages(conversationId, 40)).map(message => ({
      role: message.role,
      content: message.content,
    }));
    const summaryContext = summary
      ? `\n\n## Persistent conversation recovery context\nSummary version: ${summary.updatedAt}\nLast summarized message: ${summary.lastMessageId ?? "unknown"}\n${summary.summary}`
      : "";
    const transcript = [
      { role: "system" as const, content: `${buildChatSystemPrompt()}${summaryContext}` },
      ...recent,
    ];

    try {
      const outcome = await this.runRuntimeTurn(runtime, {
        conversationId,
        turnId: claimed.id,
        sessionId: config.modelSessionId,
        messages: transcript,
        capabilityToken: grant.token,
      }, publish);
      if (outcome.waitingApproval) {
        const turn = await this.execution.turns.waitForApproval(claimed.id, {
          now: new Date().toISOString(),
          runtimeSessionId: outcome.sessionId,
        }) ?? claimed;
        return { turn, events };
      }
      await this.conversations.appendMessage({
        id: randomUUID(),
        conversationId,
        role: "assistant",
        content: outcome.fullText,
        adapter: config.executor,
        modelSessionId: outcome.sessionId,
        createdAt: new Date().toISOString(),
      });
      if (outcome.sessionId) await this.recordModelSession(conversationId, outcome.sessionId);
      const turn = await this.execution.turns.finish(claimed.id, {
        status: "succeeded",
        runtimeSessionId: outcome.sessionId,
        now: new Date().toISOString(),
      }) ?? claimed;
      await publish({ type: "done", turnId: claimed.id, content: outcome.fullText, sessionId: outcome.sessionId });
      return { turn, events };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const turn = await this.execution.turns.finish(claimed.id, { status: "failed", error: message, now: new Date().toISOString() }) ?? claimed;
      await publish({ type: "error", turnId: claimed.id, message });
      throw Object.assign(new Error(message), { turn, events });
    }
  }

  private async runRuntimeTurn(
    runtime: AgentRuntimePort,
    input: Parameters<AgentRuntimePort["startTurn"]>[0],
    publish: (event: AgentConversationEvent) => Promise<void>,
  ): Promise<{ fullText: string; sessionId?: string; waitingApproval?: boolean }> {
    let attempt = 0;
    let sessionId = input.sessionId;
    while (attempt < 2) {
      const iterator = runtime.startTurn({ ...input, sessionId });
      let fullText = "";
      let toolResult: AgentRuntimeToolResult | undefined;
      let shouldRetry = false;
      while (true) {
        const next = await iterator.next(toolResult);
        toolResult = undefined;
        if (next.done) break;
        const event = next.value as AgentRuntimeEvent;
        if (event.type === "delta") {
          fullText += event.text;
          await publish({ type: "delta", turnId: input.turnId, text: event.text });
          continue;
        }
        if (event.type === "done") {
          return { fullText: event.fullText || fullText, sessionId: event.sessionId ?? sessionId };
        }
        if (event.type === "error") {
          const hasToolCalls = (await this.execution!.toolCallRepo.listByTurn(input.turnId)).length > 0;
          if (event.code === "stale_session" && sessionId && attempt === 0 && !hasToolCalls) {
            shouldRetry = true;
            break;
          }
          throw new Error(event.message);
        }

        const call = await this.execution!.toolCalls.request({
          id: randomUUID(),
          conversationId: input.conversationId,
          turnId: input.turnId,
          runtimeCallId: event.runtimeCallId,
          idempotencyKey: event.idempotencyKey,
          name: event.name,
          arguments: event.arguments,
          action: { ...event.action, turnId: input.turnId },
          capabilityToken: input.capabilityToken,
          now: new Date().toISOString(),
        });
        await publish({ type: "tool", turnId: input.turnId, callId: call.id, name: call.name, status: call.status });
        if (call.status === "waiting_approval" && call.approvalId) {
          await publish({
            type: "approval_required",
            turnId: input.turnId,
            callId: call.id,
            approvalId: call.approvalId,
            name: call.name,
            arguments: call.arguments,
            argumentsDigest: call.argumentsDigest,
          });
          return { fullText, sessionId: event.sessionId ?? sessionId, waitingApproval: true };
        }
        toolResult = call.status === "succeeded"
          ? { runtimeCallId: event.runtimeCallId, result: call.result }
          : { runtimeCallId: event.runtimeCallId, error: call.error ?? `Tool call ${call.status}` };
      }
      if (!shouldRetry) return { fullText, sessionId };
      attempt += 1;
      sessionId = undefined;
    }
    throw new Error("Hermes session recovery failed");
  }

  private runtimeFor(executor: AgentConversationExecutor): AgentRuntimePort {
    const runtime = this.execution?.runtimes
      ? this.execution.runtimes[executor]
      : this.execution?.runtime;
    if (!runtime) throw new Error(`Agent runtime is not configured for ${executor}`);
    return runtime;
  }
}
