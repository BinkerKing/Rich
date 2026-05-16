import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Element } from "@ke/domain";
import { JsonElementsRepo } from "../src/repos/JsonElementsRepo.js";
import { buildApp } from "../src/index.js";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";

class NoopAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    yield { type: "done", fullText: "{}" };
  }
}

let dir: string;
const elV = (richness: 1 | 2 | 3 | 4 | 5, sentence: string): Element => ({
  id: "x", type: "concept", title: "X",
  content: { oneSentence: sentence, coreExplain: "...", whyMatters: "..." },
  metadata: { createdAt: "2026-05-16T00:00:00Z", updatedAt: "2026-05-16T00:00:00Z", generatedBy: "ai", richness },
});

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ke-history-")); });

describe("JsonElementsRepo history", () => {
  it("first put has no history", async () => {
    const repo = new JsonElementsRepo(dir);
    await repo.put(elV(2, "v1"));
    expect(await repo.listVersions("x")).toEqual([]);
  });

  it("subsequent puts archive prior versions, newest first", async () => {
    const repo = new JsonElementsRepo(dir);
    await repo.put(elV(2, "v1"));
    await new Promise(r => setTimeout(r, 10));
    await repo.put(elV(3, "v2"));
    await new Promise(r => setTimeout(r, 10));
    await repo.put(elV(4, "v3"));
    const versions = await repo.listVersions("x");
    expect(versions).toHaveLength(2);
    // newest first; v2 was archived when v3 was put
    expect((versions[0].element.content as { oneSentence: string }).oneSentence).toBe("v2");
    expect((versions[1].element.content as { oneSentence: string }).oneSentence).toBe("v1");
  });

  it("revertTo restores a prior version (and archives current)", async () => {
    const repo = new JsonElementsRepo(dir);
    await repo.put(elV(2, "v1"));
    await new Promise(r => setTimeout(r, 10));
    await repo.put(elV(3, "v2"));
    const versions = await repo.listVersions("x");
    const v1stamp = versions[0].timestamp;
    const restored = await repo.revertTo("x", v1stamp);
    expect((restored.content as { oneSentence: string }).oneSentence).toBe("v1");
    const current = await repo.get("x");
    expect((current!.content as { oneSentence: string }).oneSentence).toBe("v1");
    // Current archives included v2 (just-replaced)
    const after = await repo.listVersions("x");
    const sentences = after.map(v => (v.element.content as { oneSentence: string }).oneSentence);
    expect(sentences).toContain("v2");
  });

  it("revertTo with unknown timestamp throws no-such-version", async () => {
    const repo = new JsonElementsRepo(dir);
    await repo.put(elV(2, "v1"));
    await expect(repo.revertTo("x", "2099-01-01T00-00-00-000Z")).rejects.toThrow(/no such version/);
  });

  it("listVersions for unknown id returns []", async () => {
    const repo = new JsonElementsRepo(dir);
    expect(await repo.listVersions("nope")).toEqual([]);
  });

  it("history dir is excluded from list()", async () => {
    const repo = new JsonElementsRepo(dir);
    await repo.put(elV(2, "v1"));
    await repo.put(elV(3, "v2"));
    const list = await repo.list();
    expect(list.map(e => e.id)).toEqual(["x"]);
  });
});

describe("history HTTP routes", () => {
  let app: ReturnType<typeof buildApp>;
  let dataDir: string;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "ke-hist-routes-"));
    const repo = new JsonElementsRepo(dataDir);
    await repo.put(elV(2, "v1"));
    await new Promise(r => setTimeout(r, 10));
    await repo.put(elV(3, "v2"));
    app = buildApp(dataDir, [new NoopAdapter()]);
  });

  it("GET /api/elements/:id/history returns versions", async () => {
    const res = await app.request("/api/elements/x/history");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
  });

  it("GET /api/elements/:id/history 404 when element missing", async () => {
    const res = await app.request("/api/elements/nope/history");
    expect(res.status).toBe(404);
  });

  it("POST /api/elements/:id/revert restores", async () => {
    const histRes = await app.request("/api/elements/x/history");
    const versions = await histRes.json();
    const stamp = versions[0].timestamp;
    const res = await app.request("/api/elements/x/revert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timestamp: stamp }),
    });
    expect(res.status).toBe(200);
    const restored = await res.json();
    expect(restored.content.oneSentence).toBe("v1");
  });

  it("POST /api/elements/:id/revert 400 on missing timestamp", async () => {
    const res = await app.request("/api/elements/x/revert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/elements/:id/revert 404 on unknown timestamp", async () => {
    const res = await app.request("/api/elements/x/revert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timestamp: "2099-01-01T00-00-00-000Z" }),
    });
    expect(res.status).toBe(404);
  });
});
