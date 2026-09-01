import { describe, expect, it } from "vitest";
import { AgentApprovalService } from "../src/agent-conversations/AgentApprovalService.js";

describe("AgentApprovalService", () => {
  it("approves an exact pending call once", async () => {
    const approvals = new AgentApprovalService();
    const approval = approvals.create({ conversationId: "c1", turnId: "t1", toolCallId: "call-1", argumentsDigest: "digest", now: "2026-09-01T00:00:00.000Z" });

    expect(approvals.consume(approval.id, { conversationId: "c1", turnId: "t1", toolCallId: "call-1", argumentsDigest: "digest", now: "2026-09-01T00:01:00.000Z" }).approved).toBe(true);
    expect(approvals.consume(approval.id, { conversationId: "c1", turnId: "t1", toolCallId: "call-1", argumentsDigest: "digest", now: "2026-09-01T00:01:01.000Z" }).approved).toBe(false);
  });
});
