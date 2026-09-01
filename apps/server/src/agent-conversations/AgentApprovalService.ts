import { randomUUID } from "node:crypto";
import type { AgentApprovalRepo } from "../repos/AgentApprovalRepo.js";

export type AgentApproval = {
  id: string;
  conversationId: string;
  turnId: string;
  toolCallId: string;
  argumentsDigest: string;
  expiresAt: string;
  consumed: boolean;
};
type ApprovalBinding = Omit<AgentApproval, "id" | "expiresAt" | "consumed"> & { now: string; ttlMs?: number };
type ConsumeInput = Pick<AgentApproval, "conversationId" | "turnId" | "toolCallId" | "argumentsDigest"> & { now: string };

export class AgentApprovalService {
  constructor(private readonly repo: AgentApprovalRepo) {}

  async create(input: ApprovalBinding): Promise<AgentApproval> {
    const approval: AgentApproval = { ...input, id: randomUUID(), expiresAt: new Date(new Date(input.now).getTime() + (input.ttlMs ?? 300_000)).toISOString(), consumed: false };
    await this.repo.create({ ...approval, now: input.now });
    return approval;
  }

  async consume(id: string, input: ConsumeInput): Promise<{ approved: boolean }> {
    return { approved: Boolean(await this.repo.consume(id, input)) };
  }

  async deny(id: string, input: ConsumeInput): Promise<{ denied: boolean }> {
    return { denied: Boolean(await this.repo.deny(id, input)) };
  }
}
