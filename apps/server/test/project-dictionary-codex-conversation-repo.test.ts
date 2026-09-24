import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { SqliteChatConversationsRepo } from "../src/repos/SqliteChatConversationsRepo.js";
import { SqliteProjectDictionaryCodexConversationRepo } from "../src/repos/SqliteProjectDictionaryCodexConversationRepo.js";

const at = "2026-09-24T00:00:00.000Z";

function conversation(id: string) {
  return {
    id,
    conversationId: `chat-${id}`,
    projectId: "project-1",
    title: `项目一 · 数据字典 · Codex ${id}`,
    executor: "codex" as const,
    status: "active" as const,
    createdAt: at,
    updatedAt: at,
    lastActiveAt: at,
  };
}

describe("SqliteProjectDictionaryCodexConversationRepo", () => {
  it("keeps one active binding per project and clears it when archived", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-dictionary-codex-")), "rich.db"));
    const chats = new SqliteChatConversationsRepo(db);
    const repo = new SqliteProjectDictionaryCodexConversationRepo(db);
    await chats.ensureConversation({ id: "chat-first", now: at });
    await chats.ensureConversation({ id: "chat-second", now: at });
    await repo.create(conversation("first"));
    await repo.create(conversation("second"));

    await repo.bind("first", "2026-09-24T00:01:00.000Z");
    await repo.bind("second", "2026-09-24T00:02:00.000Z");
    await repo.archive("second", "2026-09-24T00:03:00.000Z");

    expect(await repo.getBound("project-1")).toBeNull();
    expect(await repo.get("first")).toMatchObject({ isBound: false, status: "active" });
    expect(await repo.get("second")).toMatchObject({ isBound: false, status: "archived" });
  });
});
