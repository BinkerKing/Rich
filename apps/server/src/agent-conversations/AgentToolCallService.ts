import { createHash } from "node:crypto";
import type { AgentToolCall, AgentToolCallRepo } from "../repos/AgentToolCallRepo.js";
import type { AgentCapabilityAction } from "./types.js";
import { AgentCapabilityGateway } from "./AgentCapabilityGateway.js";
import { AgentApprovalService } from "./AgentApprovalService.js";

export interface AgentToolCallRequest {
  id: string;
  conversationId: string;
  turnId: string;
  runtimeCallId: string;
  idempotencyKey: string;
  name: string;
  arguments: Record<string, unknown>;
  action: AgentCapabilityAction;
  capabilityToken: string;
  now: string;
}

export interface ExecuteApprovedAgentToolCallInput {
  approvalId: string;
  conversationId: string;
  turnId: string;
  toolCallId: string;
  argumentsDigest: string;
  now: string;
}

type ToolExecutor = (call: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function digestArguments(value: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export class AgentToolCallService {
  constructor(
    private readonly repo: AgentToolCallRepo,
    private readonly gateway: AgentCapabilityGateway,
    private readonly execute: ToolExecutor,
    private readonly approvals?: AgentApprovalService,
  ) {}

  async request(input: AgentToolCallRequest): Promise<AgentToolCall> {
    const stored = await this.repo.createOrGet({
      id: input.id,
      turnId: input.turnId,
      runtimeCallId: input.runtimeCallId,
      name: input.name,
      arguments: input.arguments,
      argumentsDigest: digestArguments(input.arguments),
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    });
    if (!stored.created) return stored.call;

    const decision = await this.gateway.authorize(input.capabilityToken, input.action, input.now);
    if (!decision.allowed) {
      return this.repo.update(stored.call.id, { status: "denied", error: decision.reason, now: input.now });
    }
    if (decision.requiresApproval) {
      if (!this.approvals) {
        return this.repo.update(stored.call.id, { status: "denied", error: "Agent approval service is unavailable", now: input.now });
      }
      const approval = await this.approvals.create({
        conversationId: input.conversationId,
        turnId: input.turnId,
        toolCallId: stored.call.id,
        argumentsDigest: stored.call.argumentsDigest,
        now: input.now,
      });
      return this.repo.update(stored.call.id, { status: "waiting_approval", approvalId: approval.id, now: input.now });
    }

    await this.repo.update(stored.call.id, { status: "executing", now: input.now });
    try {
      const result = await this.execute({ name: input.name, arguments: input.arguments });
      return this.repo.update(stored.call.id, { status: "succeeded", result, now: input.now });
    } catch (error) {
      return this.repo.update(stored.call.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        now: input.now,
      });
    }
  }

  async executeApproved(input: ExecuteApprovedAgentToolCallInput): Promise<AgentToolCall> {
    if (!this.approvals) throw new Error("Agent approval service is unavailable");
    const call = await this.repo.get(input.toolCallId);
    if (!call
      || call.turnId !== input.turnId
      || call.status !== "waiting_approval"
      || call.approvalId !== input.approvalId
      || call.argumentsDigest !== input.argumentsDigest) {
      throw new Error("Agent approval is not valid for this tool call");
    }
    const approval = await this.approvals.consume(input.approvalId, {
      conversationId: input.conversationId,
      turnId: input.turnId,
      toolCallId: input.toolCallId,
      argumentsDigest: input.argumentsDigest,
      now: input.now,
    });
    if (!approval.approved) throw new Error("Agent approval is not valid for this tool call");

    await this.repo.update(call.id, { status: "executing", now: input.now });
    try {
      const result = await this.execute({ name: call.name, arguments: call.arguments });
      return this.repo.update(call.id, { status: "succeeded", result, now: input.now });
    } catch (error) {
      return this.repo.update(call.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        now: input.now,
      });
    }
  }
}
