import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { SqliteAgentConversationConfigRepo } from "../src/repos/SqliteAgentConversationConfigRepo.js";
import { SqliteChatConversationsRepo } from "../src/repos/SqliteChatConversationsRepo.js";

describe("SqliteAgentConversationConfigRepo", () => {
  it("stores Agent policy separately from the conversation transcript", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-agent-session-")), "rich.db"));
    const conversations = new SqliteChatConversationsRepo(db);
    const configs = new SqliteAgentConversationConfigRepo(db);
    const now = "2026-09-01T00:00:00.000Z";

    await conversations.ensureConversation({ id: "c1", surface: "agent", now });
    await configs.save({
      conversationId: "c1",
      executor: "hermes",
      permissionProfile: "chat_only",
      allowedMcpServers: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    expect(await configs.get("c1")).toEqual(expect.objectContaining({
      conversationId: "c1",
      executor: "hermes",
      permissionProfile: "chat_only",
      status: "active",
    }));
    expect(await conversations.listMessages("c1", 10)).toEqual([]);
  });

  it("keeps the Hermes session id when Agent mode is exited", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-agent-session-")), "rich.db"));
    const conversations = new SqliteChatConversationsRepo(db);
    const configs = new SqliteAgentConversationConfigRepo(db);
    const now = "2026-09-01T00:00:00.000Z";

    await conversations.ensureConversation({ id: "c1", surface: "agent", now });
    await configs.save({ conversationId: "c1", executor: "hermes", permissionProfile: "chat_only", allowedMcpServers: [], status: "active", modelSessionId: "hs-1", createdAt: now, updatedAt: now });
    await configs.setStatus("c1", "inactive", "2026-09-01T00:01:00.000Z");

    expect(await configs.get("c1")).toEqual(expect.objectContaining({ status: "inactive", modelSessionId: "hs-1" }));
  });
});
