import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";
import { AgentApprovalService } from "../src/agent-conversations/AgentApprovalService.js";
import { AgentCapabilityGateway } from "../src/agent-conversations/AgentCapabilityGateway.js";
import { AgentConversationService } from "../src/agent-conversations/AgentConversationService.js";
import { AgentToolCallService } from "../src/agent-conversations/AgentToolCallService.js";
import { ConversationPromotionService } from "../src/agent-conversations/ConversationPromotionService.js";
import { HermesAgentRuntime } from "../src/agent-conversations/HermesAgentRuntime.js";
import { openDb } from "../src/db/sqlite.js";
import { SqliteAgentApprovalRepo } from "../src/repos/SqliteAgentApprovalRepo.js";
import { SqliteAgentConversationConfigRepo } from "../src/repos/SqliteAgentConversationConfigRepo.js";
import { SqliteAgentConversationTurnRepo } from "../src/repos/SqliteAgentConversationTurnRepo.js";
import { SqliteAgentToolCallRepo } from "../src/repos/SqliteAgentToolCallRepo.js";
import { SqliteChatConversationsRepo } from "../src/repos/SqliteChatConversationsRepo.js";

describe("unified Agent interaction modes", () => {
  it("keeps Hermes chat-only while a confirmed promotion enters the normal task path once", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-agent-e2e-")), "rich.db"));
    const conversations = new SqliteChatConversationsRepo(db);
    const configs = new SqliteAgentConversationConfigRepo(db);
    const turns = new SqliteAgentConversationTurnRepo(db);
    const toolCalls = new SqliteAgentToolCallRepo(db);
    const adapterCalls: GenerateArgs[] = [];
    const adapter: AIAdapter = {
      name: "hermes",
      async available() { return true; },
      async *stream(input: GenerateArgs): AsyncIterable<StreamEvent> {
        adapterCalls.push(input);
        yield { type: "done", fullText: "会话已记录", sessionId: "hermes-session-1" };
      },
    };
    const gateway = new AgentCapabilityGateway("test-secret", (turnId, now) => turns.hasActiveLease(turnId, now));
    const service = new AgentConversationService(configs, conversations, {
      turns, toolCallRepo: toolCalls,
      toolCalls: new AgentToolCallService(toolCalls, gateway, async () => ({ ok: true }), new AgentApprovalService(new SqliteAgentApprovalRepo(db))),
      runtime: new HermesAgentRuntime(adapter), gateway,
    });

    await service.start("c1");
    await service.sendMessage("c1", { clientRequestId: "r1", userMessageId: "m1", content: "讨论交付物结论" });
    await service.sendMessage("c1", { clientRequestId: "r2", userMessageId: "m2", content: "继续" });

    expect(adapterCalls).toHaveLength(2);
    expect(adapterCalls.every(call => call.disableTools === true)).toBe(true);
    expect(adapterCalls[1]?.sessionId).toBe("hermes-session-1");

    const publish = vi.fn(async request => ({ id: "task-1", status: "queued", request }));
    const promotions = new ConversationPromotionService(conversations, null, async () => ({
      version: 1, createdAt: "2026-09-01T00:00:00.000Z", deliverable: { folderPath: "deliverable", requirementHtml: "需求" }, records: [], files: [], history: [],
    }), publish);
    const preview = await promotions.preview({
      conversationId: "c1", scenario: "deliverable_analysis", target: { projectId: "p1", deliverableId: "d1" },
      selectedMessageIds: ["m1"], executor: "hermes", instructions: "整理为报告",
    });

    expect(publish).not.toHaveBeenCalled();
    expect(preview.request.contextSnapshot.selectedMessages?.map(message => message.id)).toEqual(["m1"]);
    await promotions.publish(preview.confirmationToken);
    await expect(promotions.publish(preview.confirmationToken)).rejects.toThrow(/already used|missing/i);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
