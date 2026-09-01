import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { AgentCapabilityGateway } from "../src/agent-conversations/AgentCapabilityGateway.js";
import { AgentConversationService } from "../src/agent-conversations/AgentConversationService.js";
import { AgentToolCallService } from "../src/agent-conversations/AgentToolCallService.js";
import type { AgentRuntimeEvent, AgentRuntimePort, AgentRuntimeTurnInput, AgentRuntimeToolResult } from "../src/agent-conversations/AgentRuntimePort.js";
import type { AgentRuntimeCapabilities } from "../src/agent-conversations/types.js";
import { SqliteAgentConversationConfigRepo } from "../src/repos/SqliteAgentConversationConfigRepo.js";
import { SqliteAgentConversationTurnRepo } from "../src/repos/SqliteAgentConversationTurnRepo.js";
import { SqliteAgentToolCallRepo } from "../src/repos/SqliteAgentToolCallRepo.js";
import { SqliteChatConversationsRepo } from "../src/repos/SqliteChatConversationsRepo.js";

class FakeRuntime implements AgentRuntimePort {
  calls: AgentRuntimeTurnInput[] = [];
  responses: AgentRuntimeEvent[][] = [];
  block: Promise<void> | null = null;
  onStart?: () => void;
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
    for (const event of this.responses.shift() ?? []) yield event;
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
  const gateway = new AgentCapabilityGateway("test-secret", (turnId, now) => turns.hasActiveLease(turnId, now));
  const toolCalls = new AgentToolCallService(toolCallRepo, gateway, async () => ({ ok: true }));
  const service = new AgentConversationService(configs, conversations, { turns, toolCallRepo, toolCalls, runtime, gateway, workspaceRoot: workspace });
  await service.start("c1");
  return { service, runtime, turns, configs, workspace };
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
});
