import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../src/index.js";
import { openDb } from "../src/db/sqlite.js";
import { SqliteElementsRepo } from "../src/repos/SqliteElementsRepo.js";
import { SqliteStateRepo } from "../src/repos/SqliteStateRepo.js";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";

class NoopAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> { yield { type: "done", fullText: "{}" }; }
}

const element = (id: string) => ({
  id, type: "concept" as const, title: id,
  content: { oneSentence: "x", coreExplain: "y", whyMatters: "z" },
  metadata: { createdAt: "", updatedAt: "", generatedBy: "ai" as const, richness: 2 as const },
});

describe("SqliteStateRepo", () => {
  let db: ReturnType<typeof openDb>;
  let repo: SqliteStateRepo;

  beforeEach(() => {
    db = openDb(join(mkdtempSync(join(tmpdir(), "ke-state-")), "ke.db"));
    repo = new SqliteStateRepo(db);
  });

  it("getCenter returns null on first run", async () => {
    expect(await repo.getCenter()).toEqual({ elementId: null, updatedAt: null });
  });

  it("setCenter persists the current center and dwell time", async () => {
    await repo.setCenter("a");
    await new Promise(r => setTimeout(r, 10));
    const change = await repo.setCenter("b");
    expect(change.from).toBe("a");
    expect(change.to).toBe("b");
    expect(change.dwellMs).toBeGreaterThanOrEqual(5);
    expect((await repo.recentChanges(1))[0].to).toBe("b");
  });
});

describe("/api/state/center HTTP", () => {
  let dataDir: string;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "ke-state-http-"));
    const db = openDb(join(dataDir, "ke.db"));
    const elements = new SqliteElementsRepo(db);
    await elements.put(element("a"));
    await elements.put(element("b"));
    db.close();
    app = buildApp(dataDir, [new NoopAdapter()]);
  });

  it("GET returns null when not yet set", async () => {
    const res = await app.request("/api/state/center");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ current: null, recent: [] });
  });

  it("POST rejects invalid input", async () => {
    for (const body of [{ elementId: "nope" }, {}]) {
      const res = await app.request("/api/state/center", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      expect(res.status).toBe("elementId" in body ? 404 : 400);
    }
  });

  it("persists center changes and their signal", async () => {
    await app.request("/api/state/center", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ elementId: "a" }),
    });
    await new Promise(r => setTimeout(r, 10));
    const res = await app.request("/api/state/center", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ elementId: "b" }),
    });
    const body = await res.json();
    expect(body.change).toMatchObject({ from: "a", to: "b" });
    expect(body.change.dwellMs).toBeGreaterThanOrEqual(5);
    const db = openDb(join(dataDir, "ke.db"));
    expect(db.prepare("select count(*) as n from signals where type = 'user.changed_center'").get().n).toBe(2);
    db.close();
  });
});
