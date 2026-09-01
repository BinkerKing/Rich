import { describe, expect, it } from "vitest";
import { AgentApprovalService } from "../src/agent-conversations/AgentApprovalService.js";
import { openDb } from "../src/db/sqlite.js";
import { SqliteAgentApprovalRepo } from "../src/repos/SqliteAgentApprovalRepo.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("AgentApprovalService", () => {
  it("approves an exact pending call once", async () => {
    const repo = new SqliteAgentApprovalRepo(openDb(join(mkdtempSync(join(tmpdir(), "rich-approval-service-")), "rich.db")));
    const approvals = new AgentApprovalService(repo);
    const approval = await approvals.create({ conversationId: "c1", turnId: "t1", toolCallId: "call-1", argumentsDigest: "digest", now: "2026-09-01T00:00:00.000Z" });
    const recoveredApprovals = new AgentApprovalService(repo);

    expect((await recoveredApprovals.consume(approval.id, { conversationId: "c1", turnId: "t1", toolCallId: "call-1", argumentsDigest: "digest", now: "2026-09-01T00:01:00.000Z" })).approved).toBe(true);
    expect((await recoveredApprovals.consume(approval.id, { conversationId: "c1", turnId: "t1", toolCallId: "call-1", argumentsDigest: "digest", now: "2026-09-01T00:01:01.000Z" })).approved).toBe(false);
  });
});

it("persists and consumes an approval once", async () => {
  const repo = new SqliteAgentApprovalRepo(openDb(join(mkdtempSync(join(tmpdir(), "rich-approval-")), "rich.db")));
  await repo.create({ id: "a1", conversationId: "c1", turnId: "t1", toolCallId: "call1", argumentsDigest: "digest", expiresAt: "2026-09-01T00:01:00.000Z", now: "2026-09-01T00:00:00.000Z" });
  expect((await repo.consume("a1", { conversationId: "c1", turnId: "t1", toolCallId: "call1", argumentsDigest: "digest", now: "2026-09-01T00:00:30.000Z" }))?.consumedAt).toBeTruthy();
  expect(await repo.consume("a1", { conversationId: "c1", turnId: "t1", toolCallId: "call1", argumentsDigest: "digest", now: "2026-09-01T00:00:31.000Z" })).toBeNull();
});
