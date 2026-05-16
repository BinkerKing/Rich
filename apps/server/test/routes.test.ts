import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../src/index.js";
import type { AIAdapter, StreamEvent, GenerateArgs } from "../src/ai/adapter.js";

class FakeAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    const tree = {
      rootId: "fake",
      elements: [{
        id: "fake", type: "topic", title: "Fake",
        content: { intro: "i", learningGoals: ["g"], coreModules: [{ id: "m", title: "M", description: "d" }], recommendedPaths: ["p"] },
        metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
      }],
      relations: [],
      paths: [],
    };
    const text = JSON.stringify(tree);
    yield { type: "delta", text };
    yield { type: "done", fullText: text };
  }
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ke-routes-"));
  mkdirSync(join(dir, "elements"), { recursive: true });
  writeFileSync(
    join(dir, "elements", "seed.json"),
    JSON.stringify({
      id: "seed",
      type: "concept",
      title: "Seed",
      content: { oneSentence: "x", coreExplain: "y", whyMatters: "z" },
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    }),
  );
});

describe("Core API routes", () => {
  it("GET /api/elements returns array", async () => {
    const app = buildApp(dir);
    const res = await app.request("/api/elements");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].id).toBe("seed");
  });

  it("GET /api/elements/:id returns one", async () => {
    const app = buildApp(dir);
    const res = await app.request("/api/elements/seed");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("seed");
  });

  it("GET /api/elements/:id 404 on missing", async () => {
    const app = buildApp(dir);
    const res = await app.request("/api/elements/nope");
    expect(res.status).toBe(404);
  });

  it("GET /api/health returns ok", async () => {
    const app = buildApp(dir);
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("POST /api/ai/generate-tree streams SSE with done event", async () => {
    const app = buildApp(dir, [new FakeAdapter()]);
    const res = await app.request("/api/ai/generate-tree", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "test" }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: done");
    expect(text).toContain('"rootId":"fake"');
  });

  it("POST /api/ai/generate-tree returns 400 on missing topic", async () => {
    const app = buildApp(dir, [new FakeAdapter()]);
    const res = await app.request("/api/ai/generate-tree", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
