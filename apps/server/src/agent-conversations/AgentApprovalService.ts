import { randomUUID } from "node:crypto";

type Approval = {
  id: string;
  conversationId: string;
  turnId: string;
  toolCallId: string;
  argumentsDigest: string;
  expiresAt: string;
  consumed: boolean;
};
type ApprovalBinding = Omit<Approval, "id" | "expiresAt" | "consumed"> & { now: string; ttlMs?: number };
type ConsumeInput = Pick<Approval, "conversationId" | "turnId" | "toolCallId" | "argumentsDigest"> & { now: string };

export class AgentApprovalService {
  private readonly approvals = new Map<string, Approval>();

  create(input: ApprovalBinding): Approval {
    const approval: Approval = { ...input, id: randomUUID(), expiresAt: new Date(new Date(input.now).getTime() + (input.ttlMs ?? 300_000)).toISOString(), consumed: false };
    this.approvals.set(approval.id, approval);
    return approval;
  }

  consume(id: string, input: ConsumeInput): { approved: boolean } {
    const approval = this.approvals.get(id);
    if (!approval || approval.consumed || approval.expiresAt <= input.now) return { approved: false };
    if (approval.conversationId !== input.conversationId || approval.turnId !== input.turnId || approval.toolCallId !== input.toolCallId || approval.argumentsDigest !== input.argumentsDigest) return { approved: false };
    approval.consumed = true;
    return { approved: true };
  }
}
