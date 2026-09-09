import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { AgentCapabilityGateway } from "../src/agent-conversations/AgentCapabilityGateway.js";
import { AgentApprovalService } from "../src/agent-conversations/AgentApprovalService.js";
import { AgentConversationService } from "../src/agent-conversations/AgentConversationService.js";
import { AgentToolCallService } from "../src/agent-conversations/AgentToolCallService.js";
import type { AgentRuntimeEvent, AgentRuntimePort, AgentRuntimeTurnInput, AgentRuntimeToolResult } from "../src/agent-conversations/AgentRuntimePort.js";
import type { AgentRuntimeCapabilities } from "../src/agent-conversations/types.js";
import { SqliteAgentConversationConfigRepo } from "../src/repos/SqliteAgentConversationConfigRepo.js";
import { SqliteAgentConversationTurnRepo } from "../src/repos/SqliteAgentConversationTurnRepo.js";
import { SqliteAgentApprovalRepo } from "../src/repos/SqliteAgentApprovalRepo.js";
import { SqliteAgentToolCallRepo } from "../src/repos/SqliteAgentToolCallRepo.js";
import { SqliteChatConversationsRepo } from "../src/repos/SqliteChatConversationsRepo.js";

class FakeRuntime implements AgentRuntimePort {
  calls: AgentRuntimeTurnInput[] = [];
  responses: AgentRuntimeEvent[][] = [];
  block: Promise<void> | null = null;
  onStart?: () => void;
  afterFirstEvent?: Promise<void>;
  onFirstEventConsumed?: () => void;
  capabilities: AgentRuntimeCapabilities = {
    profiles: ["chat_only", "workspace_agent"],
    enforcesToolSelection: true,
    enforcesWorkspaceRoot: true,
    supportsResumableToolCalls: true,
  };

  agentRuntimeCapabilities() { return this.capabilities; }

  async *startTurn(input: AgentRuntimeTurnInput): AsyncGenerator<AgentRuntimeEvent, void, AgentRuntimeToolResult | undefined> {
    this.calls.push(structuredClone(input));
    this.onStart?.();
    if (this.block) await this.block;
    let index = 0;
    for (const event of this.responses.shift() ?? []) {
      yield event;
      if (index === 0 && this.afterFirstEvent) {
        this.onFirstEventConsumed?.();
        await this.afterFirstEvent;
      }
      index += 1;
    }
  }
}

async function setup() {
  const base = mkdtempSync(join(tmpdir(), "rich-agent-service-"));
  const workspace = join(base, "workspace");
  mkdirSync(workspace);
  const db = openDb(join(base, "rich.db"));
  const conversations = new SqliteChatConversationsRepo(db);
  const configs = new SqliteAgentConversationConfigRepo(db);
  const turns = new SqliteAgentConversationTurnRepo(db);
  const toolCallRepo = new SqliteAgentToolCallRepo(db);
  const runtime = new FakeRuntime();
  const runtimes: Partial<Record<"hermes" | "codex", AgentRuntimePort>> = { hermes: runtime };
  const gateway = new AgentCapabilityGateway("test-secret", (turnId, now) => turns.hasActiveLease(turnId, now));
  const approvals = new AgentApprovalService(new SqliteAgentApprovalRepo(db));
  const toolCalls = new AgentToolCallService(toolCallRepo, gateway, async () => ({ ok: true }), approvals);
  const service = new AgentConversationService(configs, conversations, { turns, toolCallRepo, toolCalls, runtime, runtimes, gateway, workspaceRoot: workspace });
  await service.start("c1");
  return { service, runtime, runtimes, turns, toolCallRepo, configs, conversations, workspace };
}

describe("AgentConversationService execution", () => {
  it("continues Hermes with the latest stored session", async () => {
    const { service, runtime } = await setup();
    runtime.responses.push(
      [{ type: "delta", text: "first" }, { type: "done", fullText: "first", sessionId: "hermes-session-1" }],
      [{ type: "done", fullText: "second", sessionId: "hermes-session-1" }],
    );

    await service.sendMessage("c1", { clientRequestId: "r1", userMessageId: "m1", content: "first" });
    await service.sendMessage("c1", { clientRequestId: "r2", userMessageId: "m2", content: "continue" });

    expect(runtime.calls[1]?.sessionId).toBe("hermes-session-1");
  });

  it("selects the persisted Codex executor and resumes its saved thread", async () => {
    const { service, configs, runtimes } = await setup();
    const codex = new FakeRuntime();
    const config = await configs.get("c1");
    await configs.save({
      ...config!, executor: "codex", modelSessionId: "codex-thread-1", updatedAt: new Date().toISOString(),
    });
    codex.responses.push([{ type: "done", fullText: "continued", sessionId: "codex-thread-1" }]);
    runtimes.codex = codex;

    await service.sendMessage("c1", { clientRequestId: "r-codex", userMessageId: "m-codex", content: "continue" });

    expect(codex.calls[0]?.sessionId).toBe("codex-thread-1");
  });

  it("does not fall back to Hermes when the configured Codex runtime is unavailable", async () => {
    const { service, configs, runtimes } = await setup();
    const config = await configs.get("c1");
    await configs.save({ ...config!, executor: "codex", updatedAt: new Date().toISOString() });
    delete runtimes.codex;

    await expect(service.sendMessage("c1", { clientRequestId: "r-unavailable", userMessageId: "m-unavailable", content: "continue" }))
      .rejects.toThrow("Agent runtime is not configured for codex");
  });

  it("builds a bounded recovery context from the summary and recent transcript", async () => {
    const { service, runtime, conversations } = await setup();
    const now = new Date().toISOString();
    for (let index = 0; index < 45; index += 1) {
      await conversations.appendMessage({
        id: `history-${index}`, conversationId: "c1", role: index % 2 === 0 ? "user" : "assistant",
        content: `history ${index}`, createdAt: now,
      });
    }
    await conversations.upsertSummary({
      conversationId: "c1", summary: "Earlier decisions and goals", messageCount: 45,
      lastMessageId: "history-44", updatedAt: now,
    });
    runtime.responses.push([{ type: "done", fullText: "continued", sessionId: "s1" }]);

    await service.sendMessage("c1", { clientRequestId: "r1", userMessageId: "m1", content: "continue" });

    expect(runtime.calls[0]?.messages[0]).toEqual(expect.objectContaining({ role: "system", content: expect.stringContaining("Earlier decisions and goals") }));
    expect(runtime.calls[0]?.messages.length).toBeLessThanOrEqual(41);
    expect(runtime.calls[0]?.messages.at(-1)).toEqual(expect.objectContaining({ role: "user", content: "continue" }));
  });

  it("emits text deltas before the runtime turn completes", async () => {
    const { service, runtime } = await setup();
    let firstConsumed!: () => void;
    let release!: () => void;
    const didConsumeFirst = new Promise<void>(resolve => { firstConsumed = resolve; });
    runtime.afterFirstEvent = new Promise<void>(resolve => { release = resolve; });
    runtime.onFirstEventConsumed = firstConsumed;
    runtime.responses.push([
      { type: "delta", text: "early" },
      { type: "done", fullText: "early done", sessionId: "s1" },
    ]);
    const observed: string[] = [];

    const pending = service.sendMessage(
      "c1",
      { clientRequestId: "r1", userMessageId: "m1", content: "start" },
      async event => { observed.push(event.type); },
    );
    await didConsumeFirst;
    const beforeCompletion = [...observed];
    release();
    await pending;

    expect(beforeCompletion).toContain("delta");
    expect(beforeCompletion).not.toContain("done");
  });

  it("serializes turns in the same conversation", async () => {
    const { service, runtime } = await setup();
    let started!: () => void;
    let release!: () => void;
    const didStart = new Promise<void>(resolve => { started = resolve; });
    runtime.block = new Promise<void>(resolve => { release = resolve; });
    runtime.onStart = started;
    runtime.responses.push([{ type: "done", fullText: "one", sessionId: "s1" }]);

    const first = service.sendMessage("c1", { clientRequestId: "r1", userMessageId: "m1", content: "one" });
    await didStart;
    await expect(service.sendMessage("c1", { clientRequestId: "r2", userMessageId: "m2", content: "two" }))
      .rejects.toThrow(/turn already running/i);
    release();
    await first;
  });

  it("interrupts an active Codex turn before accepting its next message", async () => {
    const { service, configs, runtimes } = await setup();
    const codex = new FakeRuntime();
    const config = await configs.get("c1");
    await configs.save({ ...config!, executor: "codex", modelSessionId: "codex-thread-1", updatedAt: new Date().toISOString() });
    runtimes.codex = codex;
    let release!: () => void;
    let started!: () => void;
    codex.block = new Promise<void>(resolve => { release = resolve; });
    const didStart = new Promise<void>(resolve => { started = resolve; });
    codex.onStart = started;
    codex.interrupt = async (threadId: string, turnId: string) => {
      expect(threadId).toBe("codex-thread-1");
      expect(turnId).toBeTruthy();
      release();
    };
    codex.responses.push([{ type: "done", fullText: "stopped", sessionId: "codex-thread-1" }]);

    const first = service.sendMessage("c1", { clientRequestId: "r1", userMessageId: "m1", content: "first" });
    await didStart;
    expect(service.isRunning("c1")).toBe(true);
    await expect(service.interrupt("c1")).resolves.toBe(true);
    await first;
    expect(service.isRunning("c1")).toBe(false);
  });

  it("retries a stale session once when no tool call was dispatched", async () => {
    const { service, runtime, configs } = await setup();
    await configs.setModelSessionId("c1", "stale", new Date().toISOString());
    runtime.responses.push(
      [{ type: "error", code: "stale_session", message: "session not found" }],
      [{ type: "done", fullText: "recovered", sessionId: "fresh" }],
    );

    await service.sendMessage("c1", { clientRequestId: "r1", userMessageId: "m1", content: "continue" });

    expect(runtime.calls).toHaveLength(2);
    expect(runtime.calls[0]?.sessionId).toBe("stale");
    expect(runtime.calls[1]?.sessionId).toBeUndefined();
    expect((await configs.get("c1"))?.modelSessionId).toBe("fresh");
  });

  it("pauses after a tool call instead of replaying the turn", async () => {
    const { service, runtime, turns, configs, workspace } = await setup();
    const config = await configs.get("c1");
    await configs.save({ ...config!, permissionProfile: "workspace_agent", workspaceRoot: workspace, updatedAt: new Date().toISOString() });
    runtime.responses.push([{
      type: "tool_call",
      runtimeCallId: "runtime-call-1",
      idempotencyKey: "idem-1",
      name: "git.push",
      arguments: { remote: "origin" },
      action: { family: "shell", action: "git.push" },
    }]);

    const result = await service.sendMessage("c1", { clientRequestId: "r1", userMessageId: "m1", content: "push this branch" });

    expect(runtime.calls).toHaveLength(1);
    expect(result.events.at(-1)?.type).toBe("approval_required");
    expect((await turns.getByClientRequest("c1", "r1"))?.status).toBe("waiting_approval");
  });

  it("executes only the exact approved paused tool call", async () => {
    const { service, runtime, turns, toolCallRepo, configs, workspace } = await setup();
    const config = await configs.get("c1");
    await configs.save({ ...config!, permissionProfile: "workspace_agent", workspaceRoot: workspace, updatedAt: new Date().toISOString() });
    runtime.responses.push([{
      type: "tool_call", runtimeCallId: "runtime-call-1", idempotencyKey: "idem-1", name: "git.push",
      arguments: { remote: "origin" }, action: { family: "shell", action: "git.push" },
    }]);
    const result = await service.sendMessage("c1", { clientRequestId: "r1", userMessageId: "m1", content: "push this branch" });
    const approval = result.events.find(event => event.type === "approval_required");
    if (!approval || approval.type !== "approval_required") throw new Error("Expected approval request");
    const call = await toolCallRepo.get(approval.callId);
    if (!call) throw new Error("Expected persisted tool call");

    await service.resolveApproval("c1", {
      approvalId: approval.approvalId, turnId: approval.turnId, toolCallId: approval.callId,
      argumentsDigest: call.argumentsDigest, approved: true,
    });

    expect((await toolCallRepo.get(approval.callId))?.status).toBe("succeeded");
    expect((await turns.getByClientRequest("c1", "r1"))?.status).toBe("failed");
  });
});
