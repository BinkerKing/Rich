import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ConversationPromotionService } from "../src/agent-conversations/ConversationPromotionService.js";
import { openDb } from "../src/db/sqlite.js";
import { SqliteChatConversationsRepo } from "../src/repos/SqliteChatConversationsRepo.js";

describe("ConversationPromotionService", () => {
  it("freezes only selected conversation evidence and publishes the preview once", async () => {
    const conversations = new SqliteChatConversationsRepo(openDb(join(mkdtempSync(join(tmpdir(), "rich-promotion-")), "rich.db")));
    const now = "2026-09-01T00:00:00.000Z";
    await conversations.ensureConversation({ id: "c1", now });
    await conversations.appendMessage({ id: "m1", conversationId: "c1", role: "user", content: "selected requirement", createdAt: now });
    await conversations.appendMessage({ id: "m2", conversationId: "c1", role: "assistant", content: "do not include", createdAt: "2026-09-01T00:00:01.000Z" });
    const publish = vi.fn(async request => ({ id: "task-1", request }));
    const service = new ConversationPromotionService(conversations, null, async () => ({
      version: 1, createdAt: now, deliverable: { folderPath: "07-交付/report", requirementHtml: "requirement" }, records: [], files: [], history: [],
    }), publish);

    const preview = await service.preview({
      conversationId: "c1", scenario: "deliverable_analysis", target: { projectId: "p1", deliverableId: "d1" },
      selectedMessageIds: ["m1"], executor: "hermes", instructions: "produce report",
    });

    expect(preview.request.contextSnapshot.selectedMessages?.map(message => message.id)).toEqual(["m1"]);
    expect(preview.request.contextSnapshot.sourceConversationId).toBe("c1");
    expect((await service.publish(preview.confirmationToken) as { id: string }).id).toBe("task-1");
    await expect(service.publish(preview.confirmationToken)).rejects.toThrow(/already used|missing/i);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown task scenario before freezing conversation content", async () => {
    const conversations = new SqliteChatConversationsRepo(openDb(join(mkdtempSync(join(tmpdir(), "rich-promotion-scenario-")), "rich.db")));
    const now = "2026-09-01T00:00:00.000Z";
    await conversations.ensureConversation({ id: "c1", now });
    await conversations.appendMessage({ id: "m1", conversationId: "c1", role: "user", content: "selected requirement", createdAt: now });
    const createContext = vi.fn(async () => ({
      version: 1, createdAt: now, deliverable: { folderPath: "07-交付/report", requirementHtml: "requirement" }, records: [], files: [], history: [],
    }));
    const service = new ConversationPromotionService(conversations, null, createContext, async () => ({ id: "task-1" }));

    await expect(service.preview({
      conversationId: "c1", scenario: "unknown", target: { projectId: "p1", deliverableId: "d1" },
      selectedMessageIds: ["m1"], executor: "hermes", instructions: "produce report",
    })).rejects.toThrow(/unknown.*scenario/i);
    expect(createContext).not.toHaveBeenCalled();
  });

  it("saves to an exact Rich destination only after one-time confirmation", async () => {
    const conversations = new SqliteChatConversationsRepo(openDb(join(mkdtempSync(join(tmpdir(), "rich-promotion-save-")), "rich.db")));
    const now = "2026-09-01T00:00:00.000Z";
    await conversations.ensureConversation({ id: "c1", now });
    const save = vi.fn(async input => ({ id: "report-1", ...input }));
    const service = new ConversationPromotionService(conversations, null, async () => ({
      version: 1, createdAt: now, deliverable: { folderPath: "07-交付/report", requirementHtml: "requirement" }, records: [], files: [], history: [],
    }), async () => ({ id: "task-1" }), undefined, undefined, save);

    const preview = await service.previewSave({
      conversationId: "c1", destination: { projectId: "p1", moduleKey: "reports", title: "评审结论" },
      content: { text: "已确认的结论" },
    });
    expect(save).not.toHaveBeenCalled();
    expect((await service.publishSave(preview.confirmationToken) as { id: string }).id).toBe("report-1");
    await expect(service.publishSave(preview.confirmationToken)).rejects.toThrow(/already used|missing/i);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
