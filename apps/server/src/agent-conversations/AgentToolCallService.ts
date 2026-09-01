import { createHash, randomUUID } from "node:crypto";
import type { AgentToolCall, AgentToolCallRepo } from "../repos/AgentToolCallRepo.js";
import type { AgentCapabilityAction } from "./types.js";
import { AgentCapabilityGateway } from "./AgentCapabilityGateway.js";

export interface AgentToolCallRequest {
  id: string;
  turnId: string;
  runtimeCallId: string;
  idempotencyKey: string;
  name: string;
  arguments: Record<string, unknown>;
  action: AgentCapabilityAction;
  capabilityToken: string;
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
      return this.repo.update(stored.call.id, { status: "waiting_approval", approvalId: randomUUID(), now: input.now });
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
}
