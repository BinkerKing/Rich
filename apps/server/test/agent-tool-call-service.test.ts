import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { AgentCapabilityGateway } from "../src/agent-conversations/AgentCapabilityGateway.js";
import { AgentToolCallService } from "../src/agent-conversations/AgentToolCallService.js";
import { AgentApprovalService } from "../src/agent-conversations/AgentApprovalService.js";
import { SqliteAgentToolCallRepo } from "../src/repos/SqliteAgentToolCallRepo.js";
import { SqliteAgentApprovalRepo } from "../src/repos/SqliteAgentApprovalRepo.js";
import { SqliteAgentConversationTurnRepo } from "../src/repos/SqliteAgentConversationTurnRepo.js";
import { SqliteChatConversationsRepo } from "../src/repos/SqliteChatConversationsRepo.js";

async function setup() {
  const base = mkdtempSync(join(tmpdir(), "rich-agent-tool-"));
  const workspace = join(base, "workspace");
  mkdirSync(workspace);
  const db = openDb(join(base, "rich.db"));
  const conversations = new SqliteChatConversationsRepo(db);
  const turns = new SqliteAgentConversationTurnRepo(db);
  const now = "2026-09-01T00:00:00.000Z";
  await conversations.ensureConversation({ id: "c1", now });
  await turns.createOrGet({ id: "t1", conversationId: "c1", clientRequestId: "r1", userMessageId: "m1", content: "work", now });
  await turns.claim("t1", { ownerId: "worker", now, leaseMs: 30_000 });
  const gateway = new AgentCapabilityGateway("test-secret", async () => true);
  const grant = gateway.issue({ conversationId: "c1", turnId: "t1", profile: "workspace_agent", workspaceRoot: workspace, allowedMcpServers: ["rich"], now, ttlMs: 30_000 });
  return {
    gateway,
    grant,
    repo: new SqliteAgentToolCallRepo(db),
    approvals: new AgentApprovalService(new SqliteAgentApprovalRepo(db)),
    workspace,
  };
}

describe("AgentToolCallService", () => {
  it("persists an approval-required call without executing it", async () => {
    const { gateway, grant, repo, approvals } = await setup();
    const executed: string[] = [];
    const service = new AgentToolCallService(repo, gateway, async call => { executed.push(call.name); return { ok: true }; }, approvals);

    const call = await service.request({
      id: "call-1", conversationId: "c1", turnId: "t1", runtimeCallId: "runtime-1", idempotencyKey: "idem-1",
      name: "git.push", arguments: { remote: "origin" }, action: { family: "shell", action: "git.push", turnId: "t1" },
      capabilityToken: grant.token, now: "2026-09-01T00:00:01.000Z",
    });

    expect(call.status).toBe("waiting_approval");
    expect(call.approvalId).toBeTruthy();
    expect(executed).toEqual([]);
    expect(await repo.get("call-1")).toEqual(expect.objectContaining({ status: "waiting_approval" }));
    const approved = await service.executeApproved({
      approvalId: call.approvalId!, conversationId: "c1", turnId: "t1", toolCallId: call.id,
      argumentsDigest: call.argumentsDigest, now: "2026-09-01T00:00:02.000Z",
    });
    expect(approved).toEqual(expect.objectContaining({ status: "succeeded", result: { ok: true } }));
    expect(executed).toEqual(["git.push"]);

    await expect(service.executeApproved({
      approvalId: call.approvalId!, conversationId: "c1", turnId: "t1", toolCallId: call.id,
      argumentsDigest: call.argumentsDigest, now: "2026-09-01T00:00:03.000Z",
    })).rejects.toThrow(/not valid/i);
    expect(executed).toEqual(["git.push"]);
  });

  it("returns a stored result for duplicate runtime calls without re-executing", async () => {
    const { gateway, grant, repo, workspace } = await setup();
    let executions = 0;
    const service = new AgentToolCallService(repo, gateway, async () => { executions += 1; return { text: "ok" }; });
    const input = {
      id: "call-1", conversationId: "c1", turnId: "t1", runtimeCallId: "runtime-1", idempotencyKey: "idem-1",
      name: "filesystem.read", arguments: { path: join(workspace, "a.txt") },
      action: { family: "filesystem" as const, action: "read", turnId: "t1", path: join(workspace, "a.txt") },
      capabilityToken: grant.token, now: "2026-09-01T00:00:01.000Z",
    };

    const first = await service.request(input);
    const retry = await service.request({ ...input, id: "call-2", now: "2026-09-01T00:00:02.000Z" });

    expect(first.status).toBe("succeeded");
    expect(retry.id).toBe("call-1");
    expect(retry.result).toEqual({ text: "ok" });
    expect(executions).toBe(1);
  });

  it("rejects changed arguments for the same runtime call id", async () => {
    const { gateway, grant, repo, workspace } = await setup();
    const service = new AgentToolCallService(repo, gateway, async () => ({ ok: true }));
    const base = {
      id: "call-1", conversationId: "c1", turnId: "t1", runtimeCallId: "runtime-1", idempotencyKey: "idem-1",
      name: "filesystem.read", arguments: { path: join(workspace, "a.txt") },
      action: { family: "filesystem" as const, action: "read", turnId: "t1", path: join(workspace, "a.txt") },
      capabilityToken: grant.token, now: "2026-09-01T00:00:01.000Z",
    };
    await service.request(base);

    await expect(service.request({ ...base, id: "call-2", arguments: { path: join(workspace, "b.txt") } }))
      .rejects.toThrow(/arguments do not match/i);
  });
});
