export type AgentConversationTurnStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface AgentConversationTurn {
  id: string;
  conversationId: string;
  clientRequestId: string;
  userMessageId: string;
  sequence: number;
  status: AgentConversationTurnStatus;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  runtimeSessionId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentConversationTurnInput {
  id: string;
  conversationId: string;
  clientRequestId: string;
  userMessageId: string;
  content: string;
  metadata?: Record<string, unknown>;
  now: string;
}

export interface ClaimAgentConversationTurnInput {
  ownerId: string;
  now: string;
  leaseMs: number;
}

export interface AgentConversationTurnRepo {
  get(id: string): Promise<AgentConversationTurn | null>;
  getByClientRequest(conversationId: string, clientRequestId: string): Promise<AgentConversationTurn | null>;
  createOrGet(input: CreateAgentConversationTurnInput): Promise<{ turn: AgentConversationTurn; created: boolean }>;
  claim(id: string, input: ClaimAgentConversationTurnInput): Promise<AgentConversationTurn | null>;
  finish(id: string, input: { status: "succeeded" | "failed" | "cancelled"; now: string; runtimeSessionId?: string; error?: string }): Promise<AgentConversationTurn | null>;
}
