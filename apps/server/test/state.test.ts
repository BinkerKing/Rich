import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonStateRepo } from "../src/repos/JsonStateRepo.js";
import { buildApp } from "../src/index.js";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";

class NoopAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    yield { type: "done", fullText: "{}" };
  }
}

const seedElement = (dir: string, id: string) => {
  writeFileSync(
    join(dir, "elements", `${id}.json`),
    JSON.stringify({
      id, type: "concept", title: id,
      content: { oneSentence: "x", coreExplain: "y", whyMatters: "z" },
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    }),
  );
};

describe("JsonStateRepo", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ke-state-")); });

  it("getCenter returns null on first run", async () => {
    const repo = new JsonStateRepo(dir);
    const c = await repo.getCenter();
    expect(c.elementId).toBeNull();
    expect(c.updatedAt).toBeNull();
  });

  it("setCenter persists current center", async () => {
    const repo = new JsonStateRepo(dir);
    await repo.setCenter("a");
    const c = await repo.getCenter();
    expect(c.elementId).toBe("a");
    expect(c.updatedAt).not.toBeNull();
  });

  it("setCenter records dwellMs from prior center", async () => {
    const repo = new JsonStateRepo(dir);
    await repo.setCenter("a");
    await new Promise(r => setTimeout(r, 20));
    const change = await repo.setCenter("b");
    expect(change.from).toBe("a");
    expect(change.to).toBe("b");
    expect(change.dwellMs).not.toBeNull();
    expect(change.dwellMs!).toBeGreaterThanOrEqual(10);
  });

  it("first setCenter has null from + null dwellMs", async () => {
    const repo = new JsonStateRepo(dir);
    const change = await repo.setCenter("a");
    expect(change.from).toBeNull();
    expect(change.dwellMs).toBeNull();
  });

  it("recentChanges returns newest first, capped by limit", async () => {
    const repo = new JsonStateRepo(dir);
    for (const id of ["a", "b", "c", "d"]) {
      await repo.setCenter(id);
      await new Promise(r => setTimeout(r, 5));
    }
    const recent = await repo.recentChanges(3);
    expect(recent.map(r => r.to)).toEqual(["d", "c", "b"]);
  });

  it("atomic write leaves no .tmp- file", async () => {
    const repo = new JsonStateRepo(dir);
    await repo.setCenter("a");
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(join(dir, "state"));
    expect(files.some(f => f.includes(".tmp-"))).toBe(false);
  });
});

describe("/api/state/center HTTP", () => {
  let dataDir: string;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "ke-state-http-"));
    mkdirSync(join(dataDir, "elements"), { recursive: true });
    seedElement(dataDir, "a");
    seedElement(dataDir, "b");
    app = buildApp(dataDir, [new NoopAdapter()]);
  });

  it("GET returns null when not yet set", async () => {
    const res = await app.request("/api/state/center");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).toBeNull();
    expect(body.recent).toEqual([]);
  });

  it("POST rejects unknown element with 404", async () => {
    const res = await app.request("/api/state/center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: "nope" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST rejects empty body with 400", async () => {
    const res = await app.request("/api/state/center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("POST sets center and GET reflects it", async () => {
    const post = await app.request("/api/state/center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: "a" }),
    });
    expect(post.status).toBe(200);
    const get = await app.request("/api/state/center");
    const body = await get.json();
    expect(body.current).toBe("a");
    expect(body.recent).toEqual(["a"]);
  });

  it("POST records user.changed_center signal", async () => {
    await app.request("/api/state/center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: "a" }),
    });
    const signalsFile = join(dataDir, "signals.jsonl");
    expect(existsSync(signalsFile)).toBe(true);
    const lines = readFileSync(signalsFile, "utf8").split("\n").filter(l => l.trim());
    const types = lines.map(l => JSON.parse(l).type);
    expect(types).toContain("user.changed_center");
  });

  it("Subsequent POST records dwellMs", async () => {
    await app.request("/api/state/center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: "a" }),
    });
    await new Promise(r => setTimeout(r, 10));
    const res = await app.request("/api/state/center", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: "b" }),
    });
    const body = await res.json();
    expect(body.change.from).toBe("a");
    expect(body.change.to).toBe("b");
    expect(body.change.dwellMs).toBeGreaterThanOrEqual(5);
  });
});
