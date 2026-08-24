import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Element } from "@ke/domain";
import { buildApp } from "../src/index.js";
import { openDb } from "../src/db/sqlite.js";
import { SqliteElementsRepo } from "../src/repos/SqliteElementsRepo.js";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";

class NoopAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> { yield { type: "done", fullText: "{}" }; }
}

const elV = (richness: 1 | 2 | 3 | 4 | 5, sentence: string, updatedAt: string): Element => ({
  id: "x", type: "concept", title: "X",
  content: { oneSentence: sentence, coreExplain: "...", whyMatters: "..." },
  metadata: { createdAt: "2026-05-16T00:00:00Z", updatedAt, generatedBy: "ai", richness },
});

describe("SQLite element history", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "ke-history-"));
    const db = openDb(join(dataDir, "ke.db"));
    const repo = new SqliteElementsRepo(db);
    await repo.put(elV(2, "v1", "2026-05-16T00:00:00Z"));
    await repo.put(elV(3, "v2", "2026-05-16T00:00:01Z"));
    db.close();
    app = buildApp(dataDir, [new NoopAdapter()]);
  });

  it("lists prior versions", async () => {
    const res = await app.request("/api/elements/x/history");
    expect(res.status).toBe(200);
    const versions = await res.json();
    expect(versions).toHaveLength(1);
    expect(versions[0].element.content.oneSentence).toBe("v1");
  });

  it("restores a prior version", async () => {
    const versions = await (await app.request("/api/elements/x/history")).json();
    const res = await app.request("/api/elements/x/revert", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ timestamp: versions[0].timestamp }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).content.oneSentence).toBe("v1");
  });

  it("rejects a missing or unknown version", async () => {
    for (const body of [{}, { timestamp: "2099-01-01T00-00-00-000Z" }]) {
      const res = await app.request("/api/elements/x/revert", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      expect(res.status).toBe("timestamp" in body ? 404 : 400);
    }
  });
});
