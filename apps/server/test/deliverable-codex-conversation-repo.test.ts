import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { SqliteChatConversationsRepo } from "../src/repos/SqliteChatConversationsRepo.js";
import { SqliteDeliverableCodexConversationRepo } from "../src/repos/SqliteDeliverableCodexConversationRepo.js";

const at = "2026-09-02T00:00:00.000Z";

function conversation(id: string, lastActiveAt = at) {
  return {
    id,
    conversationId: `chat-${id}`,
    scopeKey: "deliverable:project-1:deliverable-1",
    projectId: "project-1",
    deliverableId: "deliverable-1",
    title: `Conversation ${id}`,
    mode: "task" as const,
    executor: "codex" as const,
    status: "active" as const,
    createdAt: at,
    updatedAt: at,
    lastActiveAt,
  };
}

describe("SqliteDeliverableCodexConversationRepo", () => {
  it("lists multiple active conversations for one deliverable by recent activation", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-deliverable-codex-")), "rich.db"));
    const repo = new SqliteDeliverableCodexConversationRepo(db);
    const chats = new SqliteChatConversationsRepo(db);
    await chats.ensureConversation({ id: "chat-older", now: at });
    await chats.ensureConversation({ id: "chat-newer", now: at });
    await repo.create(conversation("older", "2026-09-02T00:01:00.000Z"));
    await repo.create({ ...conversation("newer", "2026-09-02T00:02:00.000Z"), mode: "bug" });

    expect(await repo.listActive("deliverable:project-1:deliverable-1")).toEqual([
      expect.objectContaining({ id: "newer", mode: "bug", executor: "codex", status: "active" }),
      expect.objectContaining({ id: "older", mode: "task", executor: "codex", status: "active" }),
    ]);
  });

  it("activates one conversation and archives only that conversation", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-deliverable-codex-")), "rich.db"));
    const repo = new SqliteDeliverableCodexConversationRepo(db);
    const chats = new SqliteChatConversationsRepo(db);
    await chats.ensureConversation({ id: "chat-first", now: at });
    await chats.ensureConversation({ id: "chat-second", now: at });
    await repo.create(conversation("first", "2026-09-02T00:01:00.000Z"));
    await repo.create(conversation("second", "2026-09-02T00:02:00.000Z"));

    await repo.touch("first", "2026-09-02T00:03:00.000Z");
    await repo.archive("first", "2026-09-02T00:04:00.000Z");

    expect(await repo.listActive("deliverable:project-1:deliverable-1")).toEqual([
      expect.objectContaining({ id: "second", status: "active" }),
    ]);
    expect(await repo.get("first")).toEqual(expect.objectContaining({
      status: "archived",
      lastActiveAt: "2026-09-02T00:03:00.000Z",
    }));
  });

  it("binds one active conversation per deliverable and persists its context cursor", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-deliverable-codex-")), "rich.db"));
    const repo = new SqliteDeliverableCodexConversationRepo(db);
    const chats = new SqliteChatConversationsRepo(db);
    await chats.ensureConversation({ id: "chat-first", now: at });
    await chats.ensureConversation({ id: "chat-second", now: at });
    await repo.create(conversation("first"));
    await repo.create(conversation("second"));

    await repo.bind("first", "2026-09-02T00:01:00.000Z");
    await repo.bind("second", "2026-09-02T00:02:00.000Z");
    await repo.markContextSynced("second", "2026-09-02T00:03:00.000Z");

    expect(await repo.getBound("deliverable:project-1:deliverable-1")).toEqual(expect.objectContaining({
      id: "second",
      isBound: true,
      lastContextSyncAt: "2026-09-02T00:03:00.000Z",
    }));
    expect(await repo.get("first")).toEqual(expect.objectContaining({ isBound: false }));
  });
});
