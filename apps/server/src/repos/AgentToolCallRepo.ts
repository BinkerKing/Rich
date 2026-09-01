export type AgentToolCallStatus = "requested" | "waiting_approval" | "executing" | "succeeded" | "failed" | "denied";

export interface AgentToolCall {
  id: string;
  turnId: string;
  runtimeCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  argumentsDigest: string;
  idempotencyKey: string;
  status: AgentToolCallStatus;
  result?: unknown;
  error?: string;
  approvalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentToolCallInput {
  id: string;
  turnId: string;
  runtimeCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  argumentsDigest: string;
  idempotencyKey: string;
  now: string;
}

export interface AgentToolCallRepo {
  get(id: string): Promise<AgentToolCall | null>;
  createOrGet(input: CreateAgentToolCallInput): Promise<{ call: AgentToolCall; created: boolean }>;
  update(id: string, input: { status: AgentToolCallStatus; now: string; result?: unknown; error?: string; approvalId?: string }): Promise<AgentToolCall>;
}
