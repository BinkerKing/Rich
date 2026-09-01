import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import { SqliteAgentConversationTurnRepo } from "../src/repos/SqliteAgentConversationTurnRepo.js";
import { SqliteChatConversationsRepo } from "../src/repos/SqliteChatConversationsRepo.js";

function setup() {
  const db = openDb(join(mkdtempSync(join(tmpdir(), "rich-agent-turn-")), "rich.db"));
  const conversations = new SqliteChatConversationsRepo(db);
  const turns = new SqliteAgentConversationTurnRepo(db);
  return { db, conversations, turns };
}

describe("SqliteAgentConversationTurnRepo", () => {
  it("returns the original turn for an idempotent client retry", async () => {
    const { conversations, turns } = setup();
    const now = "2026-09-01T00:00:00.000Z";
    await conversations.ensureConversation({ id: "c1", now });

    const first = await turns.createOrGet({ id: "t1", conversationId: "c1", clientRequestId: "r1", userMessageId: "m1", now });
    const retry = await turns.createOrGet({ id: "t2", conversationId: "c1", clientRequestId: "r1", userMessageId: "m2", now });

    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.turn.id).toBe("t1");
    expect(retry.turn.userMessageId).toBe("m1");
  });

  it("rejects a competing turn while a database lease is active", async () => {
    const { conversations, turns } = setup();
    const now = "2026-09-01T00:00:00.000Z";
    await conversations.ensureConversation({ id: "c1", now });
    await turns.createOrGet({ id: "t1", conversationId: "c1", clientRequestId: "r1", userMessageId: "m1", now });
    expect(await turns.claim("t1", { ownerId: "worker-a", now, leaseMs: 30_000 })).toEqual(expect.objectContaining({ status: "running", leaseOwner: "worker-a" }));

    await expect(turns.createOrGet({ id: "t2", conversationId: "c1", clientRequestId: "r2", userMessageId: "m2", now }))
      .rejects.toThrow(/turn already running/i);
  });

  it("expires an abandoned lease before admitting the next turn", async () => {
    const { conversations, turns } = setup();
    await conversations.ensureConversation({ id: "c1", now: "2026-09-01T00:00:00.000Z" });
    await turns.createOrGet({ id: "t1", conversationId: "c1", clientRequestId: "r1", userMessageId: "m1", now: "2026-09-01T00:00:00.000Z" });
    await turns.claim("t1", { ownerId: "worker-a", now: "2026-09-01T00:00:00.000Z", leaseMs: 1_000 });

    const second = await turns.createOrGet({ id: "t2", conversationId: "c1", clientRequestId: "r2", userMessageId: "m2", now: "2026-09-01T00:00:02.000Z" });

    expect(second.created).toBe(true);
    expect((await turns.get("t1"))?.status).toBe("failed");
    expect((await turns.get("t1"))?.error).toMatch(/lease expired/i);
  });
});
