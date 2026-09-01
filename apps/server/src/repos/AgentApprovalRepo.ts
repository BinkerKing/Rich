export interface CreateAgentApprovalInput {
  id: string;
  conversationId: string;
  turnId: string;
  toolCallId: string;
  argumentsDigest: string;
  expiresAt: string;
  now: string;
}

export type ConsumeAgentApprovalInput = Omit<CreateAgentApprovalInput, "id" | "expiresAt">;

export interface AgentApprovalRepo {
  create(input: CreateAgentApprovalInput): Promise<void>;
  consume(id: string, input: ConsumeAgentApprovalInput): Promise<{ consumedAt: string } | null>;
  deny(id: string, input: ConsumeAgentApprovalInput): Promise<{ consumedAt: string } | null>;
}
